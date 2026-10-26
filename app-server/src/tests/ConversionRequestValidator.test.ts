import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateConversionRequest } from '../controllers/ConversionRequestValidator';

const INPUT_REQUIRED = 'Invalid input: input field is required and must be a string';
const INPUT_EMPTY = 'Invalid input: input cannot be empty';
const FORMAT_NOT_STRING = 'Invalid input: from_format and to_format must be strings';

describe('validateConversionRequest', () => {
  it('fills default formats', () => {
    assert.deepStrictEqual(validateConversionRequest({ input: '# a' }), {
      ok: true,
      request: { input: '# a', fromFormat: 'markdown', toFormat: 'redmine-textile' }
    });
  });

  it('keeps the given formats', () => {
    assert.deepStrictEqual(validateConversionRequest({ input: '# a', from_format: 'gfm', to_format: 'x' }), {
      ok: true,
      request: { input: '# a', fromFormat: 'gfm', toFormat: 'x' }
    });
  });

  it('rejects non-object bodies', () => {
    for (const body of [undefined, null, 'str', 1, []]) {
      assert.deepStrictEqual(validateConversionRequest(body), { ok: false, error: INPUT_REQUIRED }, String(body));
    }
  });

  it('rejects a missing, non-string or empty input', () => {
    for (const body of [{}, { input: 1 }, { input: '' }, { input: null }]) {
      assert.deepStrictEqual(validateConversionRequest(body), { ok: false, error: INPUT_REQUIRED });
    }
  });

  it('rejects a whitespace-only input', () => {
    assert.deepStrictEqual(validateConversionRequest({ input: '  \n' }), { ok: false, error: INPUT_EMPTY });
  });

  it('rejects non-string formats including null', () => {
    for (const body of [
      { input: 'a', from_format: 1 },
      { input: 'a', to_format: {} },
      { input: 'a', from_format: null },
      { input: 'a', to_format: ['x'] }
    ]) {
      assert.deepStrictEqual(validateConversionRequest(body), { ok: false, error: FORMAT_NOT_STRING });
    }
  });
});
