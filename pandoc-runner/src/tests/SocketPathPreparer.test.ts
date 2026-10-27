import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  prepareSocketPath,
  SocketPathKind,
  SocketPathOperations,
  SocketProbeResult,
} from '../SocketPathPreparer';

/** 種類・接続結果を指定でき、remove の呼び出しを記録する SocketPathOperations のスタブ */
class StubPathOperations implements SocketPathOperations {
  removed: string[] = [];
  probed: string[] = [];

  constructor(
    private kind: SocketPathKind,
    private probeResult: SocketProbeResult = { kind: 'stale' },
    private removeError?: Error
  ) {}

  kindOf(): SocketPathKind {
    return this.kind;
  }

  async probe(socketPath: string): Promise<SocketProbeResult> {
    this.probed.push(socketPath);
    return this.probeResult;
  }

  remove(socketPath: string): void {
    if (this.removeError) {
      throw this.removeError;
    }
    this.removed.push(socketPath);
  }
}

const PATH = '/run/test.sock';

describe('prepareSocketPath', () => {
  it('succeeds without probing or removing when nothing exists', async () => {
    const ops = new StubPathOperations('missing');
    assert.deepStrictEqual(await prepareSocketPath(PATH, ops), { ok: true });
    assert.deepStrictEqual(ops.probed, []);
    assert.deepStrictEqual(ops.removed, []);
  });

  it('refuses to remove a non-socket file', async () => {
    // 以前は種類を確認せずに unlink していた
    const ops = new StubPathOperations('other');
    const result = await prepareSocketPath(PATH, ops);
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(ops.removed, []);
  });

  it('refuses to remove a socket another server is listening on', async () => {
    const ops = new StubPathOperations('socket', { kind: 'live' });
    const result = await prepareSocketPath(PATH, ops);
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(ops.removed, []);
  });

  it('refuses to remove a socket whose state is unknown', async () => {
    const ops = new StubPathOperations('socket', {
      kind: 'unknown',
      message: 'EACCES',
    });
    const result = await prepareSocketPath(PATH, ops);
    assert.ok(!result.ok);
    assert.match(result.message, /EACCES/);
    assert.deepStrictEqual(ops.removed, []);
  });

  it('removes a stale socket', async () => {
    const ops = new StubPathOperations('socket', { kind: 'stale' });
    assert.deepStrictEqual(await prepareSocketPath(PATH, ops), { ok: true });
    assert.deepStrictEqual(ops.removed, [PATH]);
  });

  it('reports a failure to remove a stale socket', async () => {
    const ops = new StubPathOperations(
      'socket',
      { kind: 'stale' },
      new Error('EPERM')
    );
    const result = await prepareSocketPath(PATH, ops);
    assert.ok(!result.ok);
    assert.match(result.message, /EPERM/);
  });
});
