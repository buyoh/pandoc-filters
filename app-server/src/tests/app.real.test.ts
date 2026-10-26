// Feature-Real: createApp をループバックのエフェメラルポートで実際に listen する。
// pandoc-runner へのアクセスはスタブに置き換え、ファイル作成・外部アクセスは行わない（web-simple の既存ファイルを読むのみ）
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { DEFAULT_WEB_APP_PATH } from '../config';
import { StubPandocSocketClient } from './stubs';

/** レスポンスボディを JSON として読む（テストでは any として各フィールドを検証する） */
async function jsonOf(res: Response): Promise<any> {
  return res.json();
}

describe('createApp (HTTP routing)', () => {
  let server: Server;
  let baseUrl: string;
  let client: StubPandocSocketClient;
  const indexHtml = fs.readFileSync(
    path.join(DEFAULT_WEB_APP_PATH, 'index.html'),
    'utf8'
  );

  before(async () => {
    client = new StubPandocSocketClient({
      result: { ok: true, output: 'h1. Converted' },
    });
    server = createServer(
      createApp({ pandocClient: client, webAppPath: DEFAULT_WEB_APP_PATH })
    );
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    client.behavior = { result: { ok: true, output: 'h1. Converted' } };
    client.callCount = 0;
    client.lastArgs = undefined;
  });

  function postJson(urlPath: string, body: string): Promise<Response> {
    return fetch(`${baseUrl}${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  }

  it('converts via POST /api/v1/sync/convert', async () => {
    const res = await postJson(
      '/api/v1/sync/convert',
      JSON.stringify({ input: '# Hi' })
    );
    assert.strictEqual(res.status, 200);
    const body = await jsonOf(res);
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.output, 'h1. Converted');
  });

  it('returns 400 via errorHandler for malformed JSON', async () => {
    const res = await postJson('/api/v1/sync/convert', '{ invalid');
    assert.strictEqual(res.status, 400);
    assert.strictEqual((await jsonOf(res)).error, 'Bad request');
    assert.strictEqual(client.callCount, 0);
  });

  it('returns 503 when the runner is unavailable', async () => {
    client.behavior = {
      result: { ok: false, kind: 'unavailable', detail: 'connect ENOENT' },
    };
    const res = await postJson(
      '/api/v1/sync/convert',
      JSON.stringify({ input: '# Hi' })
    );
    assert.strictEqual(res.status, 503);
    assert.strictEqual(
      (await jsonOf(res)).error,
      'Pandoc server is not available'
    );
  });

  it('rejects nested urlencoded formats with 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/sync/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'input=a&from_format[x]=1',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(
      (await jsonOf(res)).error,
      'Invalid input: from_format and to_format must be strings'
    );
    assert.strictEqual(client.callCount, 0);
  });

  it('responds to GET /health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await jsonOf(res)).status, 'ok');
  });

  it('serves index.html at / and for client routes (SPA fallback)', async () => {
    for (const urlPath of ['/', '/some/client/route']) {
      const res = await fetch(`${baseUrl}${urlPath}`);
      assert.strictEqual(res.status, 200, urlPath);
      assert.match(res.headers.get('content-type') ?? '', /text\/html/);
      assert.strictEqual(await res.text(), indexHtml);
    }
  });

  it('serves static files', async () => {
    const res = await fetch(`${baseUrl}/style.css`);
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/css/);
  });

  it('returns 404 JSON with the requested path for unknown API routes', async () => {
    // 以前は app.use('/api/*') 内の req.path が常に '/' で、message が 'API route GET / not found' になっていた
    const res = await fetch(`${baseUrl}/api/unknown?q=1`);
    assert.strictEqual(res.status, 404);
    assert.deepStrictEqual(await jsonOf(res), {
      error: 'Not Found',
      message: 'API route GET /api/unknown not found',
    });

    const post = await fetch(`${baseUrl}/api/unknown`, { method: 'POST' });
    assert.strictEqual(post.status, 404);
    assert.strictEqual(
      (await jsonOf(post)).message,
      'API route POST /api/unknown not found'
    );
  });

  it('treats /API case-insensitively like Express routing', async () => {
    const res = await fetch(`${baseUrl}/API/x`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(
      (await jsonOf(res)).message,
      'API route GET /API/x not found'
    );
  });

  it('returns 404 JSON for /api itself', async () => {
    // 以前は /api が '/api/*' に一致せず、GET は index.html、POST は Express 既定の HTML 404 だった
    for (const method of ['GET', 'POST']) {
      const res = await fetch(`${baseUrl}/api`, { method });
      assert.strictEqual(res.status, 404, method);
      assert.strictEqual(
        (await jsonOf(res)).message,
        `API route ${method} /api not found`
      );
    }
  });
});
