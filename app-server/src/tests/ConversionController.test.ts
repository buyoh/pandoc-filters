import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Request, Response } from 'express';
import { ConversionController } from '../controllers/ConversionController';
import { ConvertFailureKind } from '../types';
import { RecordingResponse, StubPandocSocketClient } from './stubs';

async function run(client: StubPandocSocketClient, body: unknown): Promise<RecordingResponse> {
  const controller = new ConversionController(client);
  const res = new RecordingResponse();
  await controller.convertSync({ body } as Request, res as unknown as Response);
  return res;
}

/** json() で例外を投げる Response スタブ */
class ThrowingResponse extends RecordingResponse {
  constructor(private error: Error) {
    super();
  }

  json(): this {
    throw this.error;
  }
}

describe('ConversionController', () => {
  describe('convertSync', () => {
    it('should return converted text for valid input', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: '# Converted' } });
      const res = await run(client, { input: '# Hello World' });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
      assert.strictEqual(res.body.data.output, '# Converted');
    });

    it('should return 400 for missing input', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: '' } });
      const res = await run(client, {});

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert(res.body.error.includes('input field is required'));
      assert.strictEqual(client.callCount, 0);
    });

    it('should return 400 for empty input', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: '' } });
      const res = await run(client, { input: '   ' });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert(res.body.error.includes('input cannot be empty'));
    });

    const failures: Array<{ kind: ConvertFailureKind; status: number; error: string }> = [
      { kind: 'invalid_request', status: 400, error: 'Invalid conversion request' },
      { kind: 'conversion_failed', status: 502, error: 'Conversion failed' },
      { kind: 'unavailable', status: 503, error: 'Pandoc server is not available' },
      { kind: 'runner_error', status: 502, error: 'Pandoc server returned an unexpected response' }
    ];
    for (const { kind, status, error } of failures) {
      it(`should return ${status} with a fixed message for ${kind}`, async () => {
        const detail = 'connect ENOENT /var/opt/common/pandoc-runner.sock';
        const client = new StubPandocSocketClient({ result: { ok: false, kind, runnerCode: 'X', detail } });
        const res = await run(client, { input: '# Hello' });

        assert.strictEqual(res.statusCode, status);
        assert.strictEqual(res.body.success, false);
        assert.strictEqual(res.body.error, error);
        assert.strictEqual(JSON.stringify(res.body).includes(detail), false);
      });
    }

    it('should return 400 for non-string formats without calling the client', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: '' } });
      const res = await run(client, { input: '# Hello', from_format: { x: '1' } });

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.error, 'Invalid input: from_format and to_format must be strings');
      assert.strictEqual(client.callCount, 0);
    });

    it('should return 500 with a fixed message for unexpected errors', async () => {
      const client = new StubPandocSocketClient({ error: new Error('secret internal detail') });
      const res = await run(client, { input: '# Hello' });

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Internal server error');
    });

    it('passes response write errors to next instead of rejecting', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: 'x' } });
      const writeError = new Error('write failed');
      const res = new ThrowingResponse(writeError);
      let nextArg: unknown;
      await new ConversionController(client).convertSync({ body: { input: 'a' } } as Request, res as unknown as Response, (arg?: unknown) => {
        nextArg = arg;
      });

      assert.strictEqual(nextArg, writeError);
    });
  });

  describe('handle', () => {
    it('returns the HTTP result without depending on Express', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: 'h1. Hi' } });
      const result = await new ConversionController(client).handle({ input: '# Hi' });

      assert.strictEqual(result.status, 200);
      assert.ok(result.body.success);
      assert.deepStrictEqual(result.body.data, { output: 'h1. Hi', from_format: 'markdown', to_format: 'redmine-textile' });
      assert.strictEqual(new Date(result.body.timestamp).toISOString(), result.body.timestamp);
    });

    it('passes the given formats to the client', async () => {
      const client = new StubPandocSocketClient({ result: { ok: true, output: 'x' } });
      const result = await new ConversionController(client).handle({ input: 'a', from_format: 'gfm', to_format: 'plain' });

      assert.deepStrictEqual(client.lastArgs, { input: 'a', fromFormat: 'gfm', toFormat: 'plain' });
      assert.ok(result.body.success);
      assert.strictEqual(result.body.data.from_format, 'gfm');
      assert.strictEqual(result.body.data.to_format, 'plain');
    });

    it('converts unexpected errors to a 500 result instead of throwing', async () => {
      const client = new StubPandocSocketClient({ error: new Error('boom') });
      const result = await new ConversionController(client).handle({ input: 'a' });

      assert.strictEqual(result.status, 500);
      assert.deepStrictEqual({ ...result.body, timestamp: '' }, { success: false, error: 'Internal server error', timestamp: '' });
    });
  });
});
