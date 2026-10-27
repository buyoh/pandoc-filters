import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ClientConnection } from '../ClientConnection';
import { RecordingLogger, SilentLogger, StubSocket, waitFor } from './stubs';

describe('ClientConnection', () => {
  it('logs only the lengths of requests and responses, not their content', async () => {
    // 以前は debug ログにリクエスト・レスポンスの本文全体を出力しており、機密性のある markdown が漏れ得た
    const socket = new StubSocket();
    const logger = new RecordingLogger();
    new ClientConnection(socket, async () => 'RESPONSE-SECRET', logger);

    socket.receive(Buffer.from('REQUEST-SECRET\n'));
    await waitFor(() => socket.writtenLines().length === 1);

    const logs = logger.messages.join('\n');
    assert.doesNotMatch(logs, /SECRET/);
    assert.match(logs, /Received request \(14 chars\)/);
    assert.match(logs, /Sent response \(15 chars\)/);
  });

  it('decodes a multibyte character split across chunks', async () => {
    const socket = new StubSocket();
    const received: string[] = [];
    new ClientConnection(
      socket,
      async (line) => {
        received.push(line);
        return 'ok';
      },
      new SilentLogger()
    );

    // 「あ」= e3 81 82 をチャンク境界で分割する
    const request = Buffer.from('{"content":"あ"}\n', 'utf8');
    const splitAt = request.indexOf(0x81);
    socket.receive(request.subarray(0, splitAt));
    socket.receive(request.subarray(splitAt));

    await waitFor(() => received.length === 1);
    assert.strictEqual(received[0], '{"content":"あ"}');
  });

  it('responds in request order even if an earlier request finishes later', async () => {
    const socket = new StubSocket();
    new ClientConnection(
      socket,
      async (line) => {
        if (line === 'slow') {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return `done:${line}`;
      },
      new SilentLogger()
    );

    socket.receive(Buffer.from('slow\nfast\n'));

    await waitFor(() => socket.writtenLines().length === 2);
    assert.deepStrictEqual(socket.writtenLines(), ['done:slow', 'done:fast']);
  });

  it('returns INTERNAL_ERROR and keeps processing when the handler rejects', async () => {
    const socket = new StubSocket();
    new ClientConnection(
      socket,
      async (line) => {
        if (line === 'bad') {
          throw new Error('boom');
        }
        return `done:${line}`;
      },
      new SilentLogger()
    );

    socket.receive(Buffer.from('bad\ngood\n'));

    await waitFor(() => socket.writtenLines().length === 2);
    const [first, second] = socket.writtenLines();
    const error = JSON.parse(first);
    assert.strictEqual(error.success, false);
    assert.strictEqual(error.error.code, 'INTERNAL_ERROR');
    assert.strictEqual(second, 'done:good');
  });

  it('does not write a response after the client disconnected', async () => {
    const socket = new StubSocket();
    let started = false;
    let handled = false;
    new ClientConnection(
      socket,
      async () => {
        started = true;
        await new Promise((resolve) => setTimeout(resolve, 20));
        handled = true;
        return 'late';
      },
      new SilentLogger()
    );

    socket.receive(Buffer.from('req\n'));
    // 処理中（handler 実行中）に切断する
    await waitFor(() => started);
    socket.destroy();

    await waitFor(() => handled);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.strictEqual(socket.written, '');
  });

  it('does not process queued requests after the client disconnected', async () => {
    const socket = new StubSocket();
    const handled: string[] = [];
    new ClientConnection(
      socket,
      async (line) => {
        handled.push(line);
        await new Promise((resolve) => setTimeout(resolve, 20));
        return 'done';
      },
      new SilentLogger()
    );

    socket.receive(Buffer.from('first\nsecond\n'));
    await waitFor(() => handled.length === 1);
    socket.destroy();

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.deepStrictEqual(handled, ['first']);
  });

  it('responds to pending requests and then ends the socket on half-close', async () => {
    const socket = new StubSocket();
    new ClientConnection(
      socket,
      async (line) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return `done:${line}`;
      },
      new SilentLogger()
    );

    socket.receive(Buffer.from('req\n'));
    socket.receiveEnd();

    await waitFor(() => socket.writableEnded);
    assert.deepStrictEqual(socket.writtenLines(), ['done:req']);
  });
});
