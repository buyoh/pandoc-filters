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

    it('should return 500 with a fixed message for unexpected errors', async () => {
      const client = new StubPandocSocketClient({ error: new Error('secret internal detail') });
      const res = await run(client, { input: '# Hello' });

      assert.strictEqual(res.statusCode, 500);
      assert.strictEqual(res.body.error, 'Internal server error');
    });
  });
});
