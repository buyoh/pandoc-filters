import { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../types';

function clientErrorStatus(err: unknown): number | undefined {
  if (err === null || typeof err !== 'object') {
    return undefined;
  }
  // body-parser 等（http-errors）は 4xx の場合 err.status / err.statusCode を設定する
  const { status, statusCode } = err as { status?: unknown; statusCode?: unknown };
  const value = typeof status === 'number' ? status : statusCode;
  if (typeof value === 'number' && value >= 400 && value < 500) {
    return value;
  }
  return undefined;
}

function clientErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Bad request';
    case 413:
      return 'Payload too large';
    default:
      return 'Request error';
  }
}

/**
 * Express のエラーミドルウェア。4xx は対応する固定文言、それ以外は 500 を返し、内部情報は返さない
 *
 * バグ修正: 以前のハンドラは err.status を無視して不正 JSON（400）や過大 body（413）も 500 にし、
 * err.message（内部パス等を含み得る）をクライアントに返していた。
 * 4xx は status を引き継いで固定文言を返し、詳細はログのみに出力する。
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  console.error('Error:', err);

  const status = clientErrorStatus(err);
  const body: ApiResponse = {
    success: false,
    error: status !== undefined ? clientErrorMessage(status) : 'Internal server error',
    timestamp: new Date().toISOString()
  };
  res.status(status ?? 500).json(body);
}
