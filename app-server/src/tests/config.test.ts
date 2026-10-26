import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as path from 'path';
import { DEFAULT_SOCKET_PATH, parseArgs, parsePort } from '../config';

function portOf(args: string[], env: NodeJS.ProcessEnv = {}): number {
  const result = parseArgs(args, env);
  assert.strictEqual(result.kind, 'ok');
  return result.config.port;
}

function assertError(args: string[], env: NodeJS.ProcessEnv = {}): string {
  const result = parseArgs(args, env);
  assert.strictEqual(result.kind, 'error');
  return result.message;
}

describe('parsePort', () => {
  it('accepts decimal integers in range', () => {
    assert.strictEqual(parsePort('3000'), 3000);
    assert.strictEqual(parsePort('1'), 1);
    assert.strictEqual(parsePort('65535'), 65535);
    assert.strictEqual(parsePort('0080'), 80);
  });

  it('rejects non-decimal or out-of-range values', () => {
    for (const value of ['', ' 80', '+80', '0x50', '80abc', '1.5', '0', '65536', '-1']) {
      assert.strictEqual(parsePort(value), undefined, value);
    }
  });
});

describe('parseArgs', () => {
  it('uses defaults without arguments or environment', () => {
    const repoAppServer = path.resolve(__dirname, '../..');
    assert.deepStrictEqual(parseArgs([], {}), {
      kind: 'ok',
      config: { port: 3000, socketPath: DEFAULT_SOCKET_PATH, webAppPath: path.join(repoAppServer, 'web-simple') }
    });
  });

  it('applies --pandoc-socket-path and --port', () => {
    const result = parseArgs(['--pandoc-socket-path', '/x.sock', '--port', '8080'], {});
    assert.strictEqual(result.kind, 'ok');
    assert.strictEqual(result.config.socketPath, '/x.sock');
    assert.strictEqual(result.config.port, 8080);
  });

  it('accepts -p and boundary values', () => {
    assert.strictEqual(portOf(['-p', '3001']), 3001);
    assert.strictEqual(portOf(['--port', '1']), 1);
    assert.strictEqual(portOf(['--port', '65535']), 65535);
    assert.strictEqual(portOf(['--port', '0080']), 80);
  });

  it('uses PORT when --port is not given', () => {
    assert.strictEqual(portOf([], { PORT: '4000' }), 4000);
    assert.strictEqual(portOf([], { PORT: '' }), 3000);
  });

  it('prefers --port over PORT and does not validate an overridden PORT', () => {
    assert.strictEqual(portOf(['--port', '5000'], { PORT: '4000' }), 5000);
    assert.strictEqual(portOf(['--port', '5000'], { PORT: 'abc' }), 5000);
  });

  it('rejects an invalid PORT', () => {
    assert.match(assertError([], { PORT: 'abc' }), /PORT environment variable/);
  });

  it('rejects invalid --port values', () => {
    // 以前は parseInt で '80abc' を 80 として受理し、0 や 65536 も範囲検査なしで受理していた
    for (const value of ['80abc', '0', '65536', '1.5']) {
      assert.match(assertError(['--port', value]), /--port requires an integer between 1 and 65535/, value);
    }
  });

  it('rejects options without values', () => {
    assertError(['--port']);
    assertError(['-p']);
    assertError(['--port', '--help']);
    assert.match(assertError(['--pandoc-socket-path']), /--pandoc-socket-path requires a path argument/);
  });

  it('rejects unknown options', () => {
    assert.match(assertError(['--unknown']), /--unknown/);
  });

  it('returns the first error or help in argument order', () => {
    assert.strictEqual(parseArgs(['--unknown', '--help'], {}).kind, 'error');
    assert.strictEqual(parseArgs(['--help', '--unknown'], {}).kind, 'help');
  });

  it('returns help text for --help and -h', () => {
    for (const flag of ['--help', '-h']) {
      const result = parseArgs([flag], {});
      assert.strictEqual(result.kind, 'help');
      assert.match(result.text, /Usage:/);
    }
  });

  it('ignores positional arguments', () => {
    assert.strictEqual(portOf(['foo', '--port', '5000']), 5000);
  });

  it('does not modify the given arguments or environment', () => {
    const args = ['--port', '5000'];
    const env = { PORT: '4000' };
    parseArgs(args, env);
    assert.deepStrictEqual(args, ['--port', '5000']);
    assert.deepStrictEqual(env, { PORT: '4000' });
  });
});
