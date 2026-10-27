// Unit-Real: リポジトリルートの ./tmp に実際の Unix ソケットを作成する
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { UnixSocketServer } from '../UnixSocketServer';
import { SilentLogger } from './stubs';

const tmpDir = path.resolve(__dirname, '../../../tmp');
const socketPath = path.join(tmpDir, `pr-server-${process.pid}.sock`);

/** 1 リクエストを送り、応答の 1 行を返す。halfClose の場合は送信後に end() する */
function roundTrip(request: string, halfClose: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection(socketPath);
    client.setEncoding('utf8');
    let data = '';
    client.on('data', (chunk: string) => {
      data += chunk;
      const newline = data.indexOf('\n');
      if (newline >= 0) {
        client.destroy();
        resolve(data.slice(0, newline));
      }
    });
    client.on('error', reject);
    client.on('close', () => reject(new Error('closed without response')));
    client.write(request + '\n');
    if (halfClose) {
      client.end();
    }
  });
}

describe('UnixSocketServer (real socket)', () => {
  const server = new UnixSocketServer(socketPath, new SilentLogger());

  before(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    // 実際の pandoc と同様に応答を遅延させる。即時に応答すると、allowHalfOpen が無くても
    // Node による自動 end() より先に書き込みが終わり、half-close の退行を検出できない
    await server.start(async (line) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return JSON.stringify({ echo: JSON.parse(line).content });
    });
  });

  after(async () => {
    await server.stop();
  });

  it(
    'round-trips a request containing Japanese text',
    { timeout: 5000 },
    async () => {
      const response = await roundTrip(
        JSON.stringify({ content: '日本語テキスト' }),
        false
      );
      assert.deepStrictEqual(JSON.parse(response), { echo: '日本語テキスト' });
    }
  );

  it(
    'responds even if the client half-closes after sending',
    { timeout: 5000 },
    async () => {
      const response = await roundTrip(
        JSON.stringify({ content: 'half' }),
        true
      );
      assert.deepStrictEqual(JSON.parse(response), { echo: 'half' });
    }
  );
});

describe('UnixSocketServer.stop (real socket)', () => {
  const stopSocketPath = path.join(tmpDir, `pr-stop-${process.pid}.sock`);

  function connect(): Promise<net.Socket> {
    return new Promise((resolve, reject) => {
      const client = net.createConnection(stopSocketPath, () =>
        resolve(client)
      );
      client.on('error', reject);
    });
  }

  it(
    'completes and removes the socket file even if an idle client stays connected',
    { timeout: 5000 },
    async () => {
      // 以前は接続が残っていると server.close() のコールバックが呼ばれず、stop() が完了しなかった
      fs.mkdirSync(tmpDir, { recursive: true });
      const server = new UnixSocketServer(stopSocketPath, new SilentLogger(), {
        shutdownTimeoutMs: 100,
      });
      await server.start(async (line) => line);
      const client = await connect();
      const closed = new Promise((resolve) => client.on('close', resolve));

      await server.stop();

      assert.strictEqual(fs.existsSync(stopSocketPath), false);
      await closed;
    }
  );

  it(
    'lets an in-flight request finish before closing',
    { timeout: 5000 },
    async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      const server = new UnixSocketServer(stopSocketPath, new SilentLogger(), {
        shutdownTimeoutMs: 2000,
      });
      let received!: () => void;
      const requestReceived = new Promise<void>((r) => (received = r));
      await server.start(async (line) => {
        received();
        await new Promise((resolve) => setTimeout(resolve, 50));
        return `done:${line}`;
      });

      const client = await connect();
      client.setEncoding('utf8');
      let data = '';
      client.on('data', (chunk: string) => (data += chunk));
      const clientClosed = new Promise((resolve) =>
        client.on('close', resolve)
      );
      client.write('req\n');
      client.end();
      await requestReceived;

      await server.stop();
      await clientClosed;

      assert.strictEqual(data, 'done:req\n');
    }
  );
});
