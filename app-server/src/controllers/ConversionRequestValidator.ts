/** 検証済みの変換リクエスト（既定値を補完済み） */
export interface ValidConversionRequest {
  input: string;
  fromFormat: string;
  toFormat: string;
}

/** 検証結果。不正なリクエストはドメイン上想定される失敗として戻り値で返す */
export type ConversionRequestValidation =
  | { ok: true; request: ValidConversionRequest }
  | { ok: false; error: string }; // error はクライアントに返す固定文言

export const DEFAULT_FROM_FORMAT = 'markdown';
export const DEFAULT_TO_FORMAT = 'redmine-textile';

const INPUT_REQUIRED = 'Invalid input: input field is required and must be a string';
const INPUT_EMPTY = 'Invalid input: input cannot be empty';
const FORMAT_NOT_STRING = 'Invalid input: from_format and to_format must be strings';

/**
 * 変換 API のリクエストボディ（req.body。任意の値）を検証する
 *
 * body がオブジェクトでない場合の検査は、Express の外から呼ばれた場合への防御。
 * express.json() / urlencoded() を通った req.body は常にオブジェクトになる
 */
export function validateConversionRequest(body: unknown): ConversionRequestValidation {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: INPUT_REQUIRED };
  }
  const { input, from_format, to_format } = body as Record<string, unknown>;

  if (typeof input !== 'string' || input.length === 0) {
    return { ok: false, error: INPUT_REQUIRED };
  }
  if (input.trim().length === 0) {
    return { ok: false, error: INPUT_EMPTY };
  }

  // バグ修正: 以前は format を未検証で runner に渡しており、urlencoded（extended: true）経由の
  // `from_format[x]=1` はオブジェクトとして、JSON の null もそのまま送信されていた。
  // undefined（省略）以外で文字列でなければ 400 とする
  if ((from_format !== undefined && typeof from_format !== 'string') ||
      (to_format !== undefined && typeof to_format !== 'string')) {
    return { ok: false, error: FORMAT_NOT_STRING };
  }

  return {
    ok: true,
    request: {
      input,
      fromFormat: from_format ?? DEFAULT_FROM_FORMAT,
      toFormat: to_format ?? DEFAULT_TO_FORMAT
    }
  };
}
