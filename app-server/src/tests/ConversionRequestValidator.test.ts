import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateConversionRequest } from '../controllers/ConversionRequestValidator';

const INPUT_REQUIRED =
  'Invalid input: input field is required and must be a string';
const INPUT_EMPTY = 'Invalid input: input cannot be empty';
const FORMAT_NOT_STRING =
  'Invalid input: from_format and to_format must be strings';
const FORMAT_UNSUPPORTED =
  'Invalid input: unsupported from_format or to_format';

describe('validateConversionRequest', () => {
  it('fills default formats', () => {
    assert.deepStrictEqual(validateConversionRequest({ input: '# a' }), {
      ok: true,
      request: {
        input: '# a',
        fromFormat: 'markdown',
        toFormat: 'redmine-textile',
      },
    });
  });

  it('accepts the supported formats given explicitly', () => {
    assert.deepStrictEqual(
      validateConversionRequest({
        input: '# a',
        from_format: 'markdown',
        to_format: 'redmine-textile',
      }),
      {
        ok: true,
        request: {
          input: '# a',
          fromFormat: 'markdown',
          toFormat: 'redmine-textile',
        },
      }
    );
  });

  it('rejects unsupported formats without echoing them', () => {
    // 以前は許可リストを検証せず、任意の文字列を runner に渡していた（code-review 08 (3)）
    for (const body of [
      { input: 'a', from_format: 'gfm' },
      { input: 'a', to_format: 'plain' },
      { input: 'a', from_format: '' },
      { input: 'a', from_format: 'Markdown' },
      { input: 'a', from_format: 'redmine-textile', to_format: 'markdown' },
    ]) {
      assert.deepStrictEqual(
        validateConversionRequest(body),
        { ok: false, error: FORMAT_UNSUPPORTED },
        JSON.stringify(body)
      );
    }
  });

  it('rejects non-object bodies', () => {
    for (const body of [undefined, null, 'str', 1, []]) {
      assert.deepStrictEqual(
        validateConversionRequest(body),
        { ok: false, error: INPUT_REQUIRED },
        String(body)
      );
    }
  });

  it('rejects a missing, non-string or empty input', () => {
    for (const body of [{}, { input: 1 }, { input: '' }, { input: null }]) {
      assert.deepStrictEqual(validateConversionRequest(body), {
        ok: false,
        error: INPUT_REQUIRED,
      });
    }
  });

  it('rejects a whitespace-only input', () => {
    assert.deepStrictEqual(validateConversionRequest({ input: '  \n' }), {
      ok: false,
      error: INPUT_EMPTY,
    });
  });

  it('rejects non-string formats including null', () => {
    for (const body of [
      { input: 'a', from_format: 1 },
      { input: 'a', to_format: {} },
      { input: 'a', from_format: null },
      { input: 'a', to_format: ['x'] },
    ]) {
      assert.deepStrictEqual(validateConversionRequest(body), {
        ok: false,
        error: FORMAT_NOT_STRING,
      });
    }
  });
});
