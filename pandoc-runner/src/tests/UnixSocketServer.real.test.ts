// Unit-Real: リポジトリルートの ./tmp に実際の Unix ソケットを作成する
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { spawn } from 'child_process';
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
    'does not remove the socket of a server started on the same path while draining',
    { timeout: 5000 },
    async () => {
      // 以前は close のコールバックでもパスを unlink しており、接続の終了を待つ間に
      // 同じパスで起動した別インスタンスのソケットを削除していた
      fs.mkdirSync(tmpDir, { recursive: true });
      const first = new UnixSocketServer(stopSocketPath, new SilentLogger(), {
        shutdownTimeoutMs: 200,
      });
      await first.start(async (line) => `first:${line}`);
      const idle = await connect();
      idle.on('error', () => {});
      const firstStopped = first.stop();

      const second = new UnixSocketServer(stopSocketPath, new SilentLogger());
      await second.start(async (line) => `second:${line}`);
      try {
        await firstStopped;
        assert.ok(fs.lstatSync(stopSocketPath).isSocket());
        const client = await connect();
        client.setEncoding('utf8');
        const response = new Promise<string>((resolve) =>
          client.on('data', (data: string) => {
            client.destroy();
            resolve(data);
          })
        );
        client.write('ping\n');
        assert.strictEqual(await response, 'second:ping\n');
      } finally {
        await second.stop();
      }
    }
  );

  it(
    'does not finish a second stop call before the first finishes draining',
    { timeout: 5000 },
    async () => {
      // 以前は 2 回目の stop() が即座に完了し、2 つ目のシグナルで接続の終了待ちを打ち切っていた
      fs.mkdirSync(tmpDir, { recursive: true });
      const server = new UnixSocketServer(stopSocketPath, new SilentLogger(), {
        shutdownTimeoutMs: 200,
      });
      await server.start(async (line) => line);
      const client = await connect();
      const closed = new Promise((resolve) => client.on('close', resolve));

      const firstStop = server.stop();
      let secondDone = false;
      const secondStop = server.stop().then(() => (secondDone = true));
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.strictEqual(secondDone, false);

      await Promise.all([firstStop, secondStop]);
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

describe('UnixSocketServer.start socket file handling (real socket)', () => {
  const guardSocketPath = path.join(tmpDir, `pr-guard-${process.pid}.sock`);

  /** テストが ./tmp に作ったファイルを消してパスを空ける */
  function clearPath(): void {
    fs.rmSync(guardSocketPath, { force: true });
  }

  it('sets the socket file mode to 0660', { timeout: 5000 }, async () => {
    // 以前はパーミッションを umask 任せにしていた
    fs.mkdirSync(tmpDir, { recursive: true });
    clearPath();
    const server = new UnixSocketServer(guardSocketPath, new SilentLogger());
    await server.start(async (line) => line);
    try {
      assert.strictEqual(fs.statSync(guardSocketPath).mode & 0o777, 0o660);
    } finally {
      await server.stop();
    }
  });

  it('refuses to start and keeps a regular file at the socket path', async () => {
    // 以前は種類を確認せずに unlink していた
    fs.mkdirSync(tmpDir, { recursive: true });
    clearPath();
    fs.writeFileSync(guardSocketPath, 'not a socket');
    const server = new UnixSocketServer(guardSocketPath, new SilentLogger());
    try {
      await assert.rejects(
        server.start(async (line) => line),
        /not a socket/
      );
      await server.stop();
      assert.strictEqual(
        fs.readFileSync(guardSocketPath, 'utf8'),
        'not a socket'
      );
    } finally {
      clearPath();
    }
  });

  it(
    'refuses to start while another server is listening, leaving it working',
    { timeout: 5000 },
    async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      clearPath();
      const first = new UnixSocketServer(guardSocketPath, new SilentLogger());
      await first.start(async (line) => `first:${line}`);
      try {
        const second = new UnixSocketServer(
          guardSocketPath,
          new SilentLogger()
        );
        await assert.rejects(
          second.start(async (line) => line),
          /already listening/
        );
        await second.stop();

        // 以前は 2 つ目の起動で稼働中のソケットが削除され、1 つ目に接続できなくなっていた
        const response = await new Promise<string>((resolve, reject) => {
          const client = net.createConnection(guardSocketPath);
          client.setEncoding('utf8');
          client.on('data', (data: string) => {
            client.destroy();
            resolve(data);
          });
          client.on('error', reject);
          client.write('ping\n');
        });
        assert.strictEqual(response, 'first:ping\n');
      } finally {
        await first.stop();
      }
    }
  );

  it(
    'removes a stale socket left by a killed process and starts',
    { timeout: 5000 },
    async () => {
      fs.mkdirSync(tmpDir, { recursive: true });
      clearPath();
      // 別プロセスで listen した直後に SIGKILL し、接続できないソケットファイルを残す
      const child = spawn(process.execPath, [
        '-e',
        `require('net').createServer().listen(${JSON.stringify(guardSocketPath)}, () => process.kill(process.pid, 'SIGKILL'))`,
      ]);
      await new Promise((resolve) => child.on('exit', resolve));
      assert.ok(fs.lstatSync(guardSocketPath).isSocket());

      const server = new UnixSocketServer(guardSocketPath, new SilentLogger());
      await server.start(async (line) => line);
      await server.stop();
      assert.strictEqual(fs.existsSync(guardSocketPath), false);
    }
  );
});
