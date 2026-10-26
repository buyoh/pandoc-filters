// 共通の型定義
// プロトコル仕様: docs-ai/architecture/pandoc-runner-protocol.md

/** 変換リクエスト */
export interface ConversionRequest {
  action: 'convert';
  from: string;
  to: string;
  content: string;
}

/** 死活確認リクエスト */
export interface PingRequest {
  action: 'ping';
}

/** runner が受け付けるリクエスト（検証済み） */
export type Request = ConversionRequest | PingRequest;

/** runner が返すエラーコード */
export type ErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ACTION'
  | 'UNSUPPORTED_CONVERSION'
  | 'CONVERSION_ERROR'
  | 'INTERNAL_ERROR';

/** 成功レスポンス */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

/** エラーレスポンス */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: ErrorCode;
  };
  timestamp: string;
}

export type Response = SuccessResponse | ErrorResponse;

/** convert 成功時のレスポンスデータ */
export interface ConversionResult {
  result: string;
  from: string;
  to: string;
}

/** ping 成功時のレスポンスデータ */
export interface PingResult {
  message: string;
}

/** 変換に使用するフィルターのパスを提供するインターフェース */
export interface FilterSelector {
  getFilterPath(fromFormat: string, toFormat: string): string | null;
}

/** 外部コマンドの実行結果 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  /** 終了コード。シグナルで終了した場合は null */
  exitCode: number | null;
  /** 終了させたシグナル名。通常終了した場合は null */
  signal: NodeJS.Signals | null;
}

/** 外部コマンドの実行を抽象化するインターフェース。コマンドを起動できない場合は reject する */
export interface CommandExecutor {
  execute(
    command: string,
    args: string[],
    options?: {
      /** 標準入力に書き込む文字列。undefined の場合は何も書き込まず stdin を閉じる */
      stdin?: string;
    }
  ): Promise<CommandResult>;
}

/** 変換結果。pandoc の失敗はドメイン上想定される失敗として戻り値で返す */
export type ConversionOutcome =
  | { ok: true; output: string }
  | { ok: false; message: string };

/** markdown → redmine-textile 変換を提供するインターフェース（RequestHandler の依存） */
export interface MarkdownConverter {
  convertMarkdownToRedmineTextile(markdownText: string): Promise<ConversionOutcome>;
}

/** ログ出力のインターフェース */
export interface Logger {
  info(message: string): void;
  debug(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** pandoc が利用できない等、起動時の致命的な失敗を表す例外 */
export class ConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionError';
  }
}
