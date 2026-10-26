import { ErrorCode, ErrorResponse, SuccessResponse } from './types';

/**
 * 成功レスポンスの JSON 文字列を作成する
 * @param data レスポンスデータ
 */
export function createSuccessResponse<T>(data: T): string {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
  return JSON.stringify(response);
}

/**
 * エラーレスポンスの JSON 文字列を作成する
 * @param message エラーメッセージ
 * @param code エラーコード
 */
export function createErrorResponse(message: string, code: ErrorCode): string {
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      code
    },
    timestamp: new Date().toISOString()
  };
  return JSON.stringify(response);
}
