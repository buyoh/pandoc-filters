// Unit-Real: リポジトリルートの ./tmp に実際の Unix ソケットを作成する
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { PandocSocketClientImpl } from '../services/PandocSocketClientImpl';

const tmpDir = path.resolve(__dirname, '../../../tmp');
const socketPath = path.join(tmpDir, `as-client-${process.pid}.sock`);

describe('PandocSocketClientImpl (real socket)', () => {
  let server: net.Server;

  before(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    if (fs.existsSync(socketPath)) {
      fs.unlinkSync(socketPath);
    }
    // 1 行受信したら、content を大文字にして 1 行で返すだけのスタブサーバ
    server = net.createServer((socket) => {
      socket.setEncoding('utf8');
      let data = '';
      socket.on('data', (chunk: string) => {
        data += chunk;
        const newline = data.indexOf('\n');
        if (newline >= 0) {
          const request = JSON.parse(data.slice(0, newline));
          socket.end(JSON.stringify({
            success: true,
            data: { result: `converted:${request.content}` },
            timestamp: new Date().toISOString()
          }) + '\n');
        }
      });
    });
    await new Promise<void>((resolve) => server.listen(socketPath, resolve));
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('round-trips a request over a Unix socket', async () => {
    const client = new PandocSocketClientImpl(socketPath);
    const result = await client.convert('日本語', 'markdown', 'redmine-textile');
    assert.deepStrictEqual(result, { ok: true, output: 'converted:日本語' });
  });

  it('returns unavailable when the socket does not exist', async () => {
    const client = new PandocSocketClientImpl(path.join(tmpDir, `as-missing-${process.pid}.sock`));
    const result = await client.convert('x', 'markdown', 'redmine-textile');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(!result.ok && result.kind, 'unavailable');
  });
});
