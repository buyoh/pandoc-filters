import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Request, Response } from 'express';
import { errorHandler } from '../middleware/errorHandler';
import { RecordingResponse } from './stubs';

function handle(err: unknown, res = new RecordingResponse()) {
  let nextArg: unknown = 'not called';
  errorHandler(err, {} as Request, res as unknown as Response, (arg?: unknown) => {
    nextArg = arg;
  });
  return { res, nextArg };
}

describe('errorHandler', () => {
  it('returns 400 for body-parser errors', () => {
    const { res } = handle(Object.assign(new Error('Unexpected token } in JSON'), { status: 400 }));
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, 'Bad request');
    assert.strictEqual(res.body.success, false);
  });

  it('returns 413 for payload too large errors', () => {
    const { res } = handle(Object.assign(new Error('request entity too large'), { statusCode: 413 }));
    assert.strictEqual(res.statusCode, 413);
    assert.strictEqual(res.body.error, 'Payload too large');
  });

  it('returns 500 without the error message for other errors', () => {
    const { res } = handle(new Error('secret /var/opt/path'));
    assert.strictEqual(res.statusCode, 500);
    assert.strictEqual(res.body.error, 'Internal server error');
    assert.strictEqual(JSON.stringify(res.body).includes('secret'), false);
  });

  it('delegates to next when headers are already sent', () => {
    const sent = new RecordingResponse();
    sent.headersSent = true;
    const err = new Error('late');
    const { res, nextArg } = handle(err, sent);
    assert.strictEqual(nextArg, err);
    assert.strictEqual(res.jsonCallCount, 0);
  });
});
