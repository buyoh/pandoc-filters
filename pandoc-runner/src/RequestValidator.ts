import { Request } from './types';

/** リクエスト検証の結果。失敗はドメイン上想定される失敗として戻り値で返す */
export type ValidationResult =
  | { ok: true; request: Request }
  | { ok: false; code: 'INVALID_REQUEST' | 'UNKNOWN_ACTION'; message: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * JSON 解析済みのリクエストを検証する
 * @param raw JSON.parse の結果
 */
export function validateRequest(raw: unknown): ValidationResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'Request must be a JSON object',
    };
  }

  const request = raw as Record<string, unknown>;

  if (typeof request.action !== 'string') {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'Request must include an action field',
    };
  }

  switch (request.action) {
    case 'ping':
      return { ok: true, request: { action: 'ping' } };
    case 'convert':
      break;
    default:
      return {
        ok: false,
        code: 'UNKNOWN_ACTION',
        message: `Unknown action: ${request.action}`,
      };
  }

  for (const field of ['from', 'to'] as const) {
    if (!isNonEmptyString(request[field])) {
      return {
        ok: false,
        code: 'INVALID_REQUEST',
        message: `Request must include ${field} field`,
      };
    }
  }

  // バグ修正: 以前は必須フィールドを falsy 判定しており、content: "" を「content が無い」として
  // INTERNAL_ERROR で拒否していた。型のみを検証し、空文字は有効とする（pandoc は空出力を返す）。
  // 空入力の拒否は利用者側の責務
  if (typeof request.content !== 'string') {
    return {
      ok: false,
      code: 'INVALID_REQUEST',
      message: 'Content must be a string',
    };
  }

  return {
    ok: true,
    request: {
      action: 'convert',
      from: request.from as string,
      to: request.to as string,
      content: request.content,
    },
  };
}
