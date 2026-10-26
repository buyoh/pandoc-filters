import { describe, it } from 'node:test';
import assert from 'node:assert';
import { RequestHandler } from '../RequestHandler';
import { StubMarkdownConverter } from './stubs';

async function handle(converter: StubMarkdownConverter, request: unknown) {
  const handler = new RequestHandler(converter);
  return JSON.parse(await handler.handleRequest(JSON.stringify(request)));
}

describe('RequestHandler protocol', () => {
  const ok = () => new StubMarkdownConverter({ ok: true, output: 'converted' });

  it('returns INVALID_REQUEST when action is missing', async () => {
    const response = await handle(ok(), { content: 'x' });
    assert.strictEqual(response.success, false);
    assert.strictEqual(response.error.code, 'INVALID_REQUEST');
  });

  it('returns INVALID_REQUEST when content is not a string', async () => {
    const response = await handle(ok(), { action: 'convert', from: 'markdown', to: 'redmine-textile', content: 1 });
    assert.strictEqual(response.error.code, 'INVALID_REQUEST');
  });

  it('accepts empty content', async () => {
    const converter = ok();
    const response = await handle(converter, { action: 'convert', from: 'markdown', to: 'redmine-textile', content: '' });
    assert.strictEqual(response.success, true);
    assert.deepStrictEqual(converter.received, ['']);
  });

  it('includes the action name in the UNKNOWN_ACTION message', async () => {
    const response = await handle(ok(), { action: 'foo' });
    assert.strictEqual(response.error.code, 'UNKNOWN_ACTION');
    assert.strictEqual(response.error.message, 'Unknown action: foo');
  });

  it('returns CONVERSION_ERROR when the converter fails', async () => {
    const converter = new StubMarkdownConverter({ ok: false, message: 'pandoc failed' });
    const response = await handle(converter, { action: 'convert', from: 'markdown', to: 'redmine-textile', content: '# x' });
    assert.strictEqual(response.error.code, 'CONVERSION_ERROR');
    assert.match(response.error.message, /pandoc failed/);
  });
});
