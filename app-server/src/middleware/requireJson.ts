import { NextFunction, Request, Response } from 'express';
import { ApiErrorResponse } from '../types';

/**
 * Content-Type が application/json でないリクエストを 415 で拒否するミドルウェア。
 *
 * 他サイトのフォームからはプリフライト無しで urlencoded / multipart / text/plain の POST を送れるため、
 * JSON 以外を受け付けると第三者のブラウザを踏み台にして変換 API を叩ける。
 * application/json の POST はクロスオリジンではプリフライトが必要で、CORS 未設定のため拒否される
 */
export function requireJson(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // req.is は Content-Type ヘッダが無い（body も無い）場合に null を返す。body の無い POST も拒否する
  if (req.is('application/json')) {
    next();
    return;
  }
  const body: ApiErrorResponse = {
    success: false,
    error: 'Content-Type must be application/json',
    timestamp: new Date().toISOString(),
  };
  res.status(415).json(body);
}
