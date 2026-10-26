import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PandocSocketClientImpl } from '../services/PandocSocketClientImpl';
import { StubSocket } from './stubs';

/** スタブソケットを返すクライアントを作り、convert を開始する */
function startConvert(input = '# x') {
  const socket = new StubSocket();
  const client = new PandocSocketClientImpl('/stub.sock', () => socket);
  const result = client.convert(input, 'markdown', 'redmine-textile');
  return { socket, result };
}

function successLine(result: unknown): string {
  return (
    JSON.stringify({ success: true, data: { result }, timestamp: 't' }) + '\n'
  );
}

function errorLine(code: string): string {
  return (
    JSON.stringify({
      success: false,
      error: { code, message: `msg ${code}` },
      timestamp: 't',
    }) + '\n'
  );
}

describe('PandocSocketClientImpl', () => {
  it('sends a newline-terminated convert request', async () => {
    const { socket, result } = startConvert('# 見出し');
    socket.receive(successLine('ok'));
    await result;

    assert.deepStrictEqual(JSON.parse(socket.written), {
      action: 'convert',
      content: '# 見出し',
      from: 'markdown',
      to: 'redmine-textile',
    });
  });

  it('decodes a multibyte character split across chunks', async () => {
    const { socket, result } = startConvert();
    // 「あ」= e3 81 82 をチャンク境界で分割する
    const response = Buffer.from(successLine('あいう'), 'utf8');
    const splitAt = response.indexOf(0x81);
    socket.receive(response.subarray(0, splitAt));
    socket.receive(response.subarray(splitAt));

    assert.deepStrictEqual(await result, { ok: true, output: 'あいう' });
  });

  it('parses only the first line even if more data follows in the same chunk', async () => {
    const { socket, result } = startConvert();
    socket.receive(successLine('ok') + 'garbage\n');
    assert.deepStrictEqual(await result, { ok: true, output: 'ok' });
  });

  it('maps ENOENT to unavailable', async () => {
    const { socket, result } = startConvert();
    socket.fail('ENOENT');
    const outcome = await result;
    assert.strictEqual(outcome.ok, false);
    assert.strictEqual(!outcome.ok && outcome.kind, 'unavailable');
  });

  it('maps ECONNRESET to runner_error', async () => {
    const { socket, result } = startConvert();
    socket.fail('ECONNRESET');
    const outcome = await result;
    assert.strictEqual(!outcome.ok && outcome.kind, 'runner_error');
  });

  for (const [name, line] of [
    ['invalid JSON', 'not json\n'],
    ['null', 'null\n'],
    ['success without data', '{"success":true}\n'],
    ['success without result', successLine(undefined)],
  ]) {
    it(`maps ${name} to runner_error`, async () => {
      const { socket, result } = startConvert();
      socket.receive(line);
      const outcome = await result;
      assert.strictEqual(!outcome.ok && outcome.kind, 'runner_error');
    });
  }

  it('maps close before a complete line to runner_error', async () => {
    const { socket, result } = startConvert();
    socket.receive('{"success":');
    socket.destroy();
    const outcome = await result;
    assert.strictEqual(!outcome.ok && outcome.kind, 'runner_error');
  });

  for (const [code, kind] of [
    ['CONVERSION_ERROR', 'conversion_failed'],
    ['UNSUPPORTED_CONVERSION', 'invalid_request'],
    ['INVALID_REQUEST', 'invalid_request'],
    ['INTERNAL_ERROR', 'runner_error'],
  ]) {
    it(`maps runner code ${code} to ${kind}`, async () => {
      const { socket, result } = startConvert();
      socket.receive(errorLine(code));
      const outcome = await result;
      assert.strictEqual(outcome.ok, false);
      assert.strictEqual(!outcome.ok && outcome.kind, kind);
      assert.strictEqual(!outcome.ok && outcome.runnerCode, code);
    });
  }
});
