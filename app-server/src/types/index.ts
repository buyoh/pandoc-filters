/**
 * HTTP APIのリクエストボディ用の型
 * クライアント（Webアプリケーション）からExpressサーバーへの変換リクエスト
 */
export interface ConversionRequest {
  input: string;
  /** 変換元フォーマット。省略可能で、省略時は 'markdown' */
  from_format?: string;
  /** 変換先フォーマット。省略可能で、省略時は 'redmine-textile' */
  to_format?: string;
}

/**
 * pandoc-runnerサーバーへのUnixSocket通信用リクエスト型
 * プロトコル仕様: docs-ai/architecture/pandoc-runner-protocol.md
 */
export interface PandocRequest {
  action: 'convert';
  content: string;  // 変換対象のテキスト
  from: string;     // 変換元フォーマット（例: 'markdown'）
  to: string;       // 変換先フォーマット（例: 'redmine-textile'）
}

/** pandoc-runner からの成功レスポンス */
export interface PandocSuccessResponse {
  success: true;
  data: {
    /** 変換結果。convert の応答には存在する。ping の応答には存在しない */
    result?: string;
    /** ping 応答のメッセージ。ping の応答にのみ存在する */
    message?: string;
    /** 変換元フォーマット。convert の応答にのみ存在する */
    from?: string;
    /** 変換先フォーマット。convert の応答にのみ存在する */
    to?: string;
  };
  timestamp: string;   // ISO8601形式のタイムスタンプ
}

/** pandoc-runner からのエラーレスポンス */
export interface PandocErrorResponse {
  success: false;
  error: {
    message: string;   // エラーメッセージ
    code: string;      // エラーコード（例: 'CONVERSION_ERROR'）
  };
  timestamp: string;   // ISO8601形式のタイムスタンプ
}

/**
 * pandoc-runnerサーバーからのUnixSocket通信用レスポンス型
 * プロトコル仕様: docs-ai/architecture/pandoc-runner-protocol.md
 */
export type PandocResponse = PandocSuccessResponse | PandocErrorResponse;

/** convert の失敗の種類。HTTP ステータスへの対応付けに使う */
export type ConvertFailureKind =
  | 'invalid_request'    // runner が INVALID_REQUEST / UNSUPPORTED_CONVERSION を返した
  | 'conversion_failed'  // runner が CONVERSION_ERROR を返した
  | 'unavailable'        // runner に接続できない・過負荷（ENOENT / ECONNREFUSED / EACCES / ENOTSOCK / EAGAIN）
  | 'runner_error';      // 上記以外の通信エラー、応答の解析失敗・形が不正、完全な応答前の切断、その他の runner エラーコード、convert 成功応答に result が無い

/** convert の結果。失敗はドメイン上想定される失敗として戻り値で返す */
export type ConvertResult =
  | { ok: true; output: string }
  | {
      ok: false;
      kind: ConvertFailureKind;
      /** runner が返したエラーコード。runner がエラー応答を返した場合のみ存在し、通信レベルの失敗では存在しない */
      runnerCode?: string;
      /** ログ出力専用の詳細。クライアントには返さない */
      detail: string;
    };

/**
 * HTTP APIの統一レスポンス型
 * クライアントに返される全てのAPIレスポンスで使用
 */
export interface ApiResponse<T = any> {
  success: boolean;
  /** 成功時のデータ。失敗時は存在しない */
  data?: T;
  /** 失敗時のメッセージ（固定文言）。成功時は存在しない */
  error?: string;
  timestamp: string; // ISO8601形式のタイムスタンプ
}

/**
 * pandoc-runnerサーバーとの通信を抽象化するインターフェース。失敗は例外ではなく戻り値で返す
 * 実装: PandocSocketClientImpl
 * テスト用スタブ: StubPandocSocketClient（tests/stubs.ts）
 */
export interface PandocSocketClient {
  convert(input: string, fromFormat: string, toFormat: string): Promise<ConvertResult>;
}
