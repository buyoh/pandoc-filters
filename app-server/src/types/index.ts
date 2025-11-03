/**
 * HTTP APIのリクエストボディ用の型
 * クライアント（Webアプリケーション）からExpressサーバーへの変換リクエスト
 */
export interface ConversionRequest {
  input: string;
  from_format?: string;
  to_format?: string;
}

/**
 * HTTP APIのレスポンス用の型（廃止予定）
 * 現在はApiResponse<T>を使用することを推奨
 */
export interface ConversionResponse {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * pandoc-runnerサーバーへのUnixSocket通信用リクエスト型
 * Ruby側のRequestHandlerが期待するJSON形式と一致
 */
export interface PandocRequest {
  action: 'convert' | 'ping';
  content?: string;  // 変換対象のテキスト（convertアクション時）
  from?: string;     // 変換元フォーマット（例: 'markdown'）
  to?: string;       // 変換先フォーマット（例: 'redmine-textile'）
}

/**
 * pandoc-runnerサーバーからのUnixSocket通信用レスポンス型
 * Ruby側のRequestHandlerが返すJSON形式と一致
 */
export interface PandocResponse {
  success: boolean;
  data?: {
    result?: string;   // 変換結果のテキスト
    message?: string;  // pingレスポンス用メッセージ
    from?: string;     // 変換元フォーマット（確認用）
    to?: string;       // 変換先フォーマット（確認用）
  };
  error?: {
    message: string;   // エラーメッセージ
    code: string;      // エラーコード（例: 'CONVERSION_ERROR'）
  };
  timestamp: string;   // ISO8601形式のタイムスタンプ
}

/**
 * HTTP APIの統一レスポンス型
 * クライアントに返される全てのAPIレスポンスで使用
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;          // 成功時のデータ
  error?: string;    // エラー時のメッセージ
  timestamp: string; // ISO8601形式のタイムスタンプ
}

/**
 * pandoc-runnerサーバーとの通信を抽象化するインターフェース
 * 実装: PandocSocketClientImpl
 * テスト用モック: MockPandocSocketClient
 */
export interface PandocSocketClient {
  sendRequest(request: PandocRequest): Promise<PandocResponse>;
  ping(): Promise<boolean>;
  convert(input: string, fromFormat?: string, toFormat?: string): Promise<string>;
}