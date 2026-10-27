import { NextFunction, Request, Response } from 'express';

/**
 * 全レスポンスに付与するセキュリティヘッダ。
 * web-simple は同一オリジンの script.js / style.css と fetch のみを使うため、CSP は 'self' に限定する。
 * インラインの script / style（style 属性を含む）は CSP で拒否されるため、web-simple では使わないこと
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  // frame-ancestors 非対応の古いブラウザ向け
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

/** SECURITY_HEADERS を付与するミドルウェア（helmet の依存を増やさないための最小限の実装） */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
  next();
}
