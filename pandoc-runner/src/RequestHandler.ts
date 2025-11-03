import { 
  Request, 
  ConversionRequest, 
  PingRequest, 
  Response, 
  SuccessResponse, 
  ErrorResponse,
  ConversionResult,
  PingResult 
} from './types';
import { PandocConverter } from './PandocConverter';

/**
 * JSONリクエストの解析と処理、レスポンスの生成を行うクラス
 */
export class RequestHandler {
  private converter: PandocConverter;

  constructor(converter: PandocConverter) {
    this.converter = converter;
  }

  /**
   * JSONリクエストを処理してJSONレスポンスを返す
   * @param requestJson JSONリクエスト文字列
   * @returns JSONレスポンス文字列
   */
  async handleRequest(requestJson: string): Promise<string> {
    try {
      const request = this.parseRequest(requestJson);

      switch (request.action) {
        case 'convert':
          return await this.handleConvertRequest(request);
        case 'ping':
          return this.handlePingRequest();
        default:
          return this.createErrorResponse('Unknown action', 'UNKNOWN_ACTION');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return this.createErrorResponse(`Invalid JSON: ${error.message}`, 'INVALID_JSON');
      }
      return this.createErrorResponse(`Internal error: ${error}`, 'INTERNAL_ERROR');
    }
  }

  /**
   * JSONリクエストを解析する
   * @param requestJson JSONリクエスト文字列
   * @returns 解析されたリクエスト
   */
  private parseRequest(requestJson: string): Request {
    const request = JSON.parse(requestJson);

    if (!request || typeof request !== 'object') {
      throw new Error('Request must be a JSON object');
    }

    if (!request.action) {
      throw new Error('Request must include an action field');
    }

    return request as Request;
  }

  /**
   * 変換リクエストを処理する
   * @param request 解析されたリクエスト
   * @returns JSONレスポンス文字列
   */
  private async handleConvertRequest(request: ConversionRequest): Promise<string> {
    try {
      this.validateConvertRequest(request);

      const { from: fromFormat, to: toFormat, content } = request;

      // 現在はmarkdown -> redmine-textileのみサポート
      if (fromFormat !== 'markdown' || toFormat !== 'redmine-textile') {
        return this.createErrorResponse(
          `Unsupported conversion: ${fromFormat} -> ${toFormat}`,
          'UNSUPPORTED_CONVERSION'
        );
      }

      const convertedContent = await this.converter.convertMarkdownToRedmineTextile(content);

      return this.createSuccessResponse<ConversionResult>({
        result: convertedContent,
        from: fromFormat,
        to: toFormat
      });
    } catch (error) {
      if (error instanceof Error && error.constructor.name === 'ConversionError') {
        return this.createErrorResponse(`Conversion failed: ${error.message}`, 'CONVERSION_ERROR');
      }
      throw error;
    }
  }

  /**
   * pingリクエストを処理する
   * @returns JSONレスポンス文字列
   */
  private handlePingRequest(): string {
    return this.createSuccessResponse<PingResult>({ message: 'pong' });
  }

  /**
   * 変換リクエストの妥当性を検証する
   * @param request 解析されたリクエスト
   */
  private validateConvertRequest(request: ConversionRequest): void {
    const requiredFields = ['from', 'to', 'content'] as const;

    for (const field of requiredFields) {
      if (!request[field]) {
        throw new Error(`Request must include ${field} field`);
      }
    }

    if (typeof request.content !== 'string') {
      throw new Error('Content must be a string');
    }
  }

  /**
   * 成功レスポンスを作成する
   * @param data レスポンスデータ
   * @returns JSONレスポンス文字列
   */
  private createSuccessResponse<T>(data: T): string {
    const response: SuccessResponse<T> = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
    return JSON.stringify(response);
  }

  /**
   * エラーレスポンスを作成する
   * @param message エラーメッセージ
   * @param code エラーコード
   * @returns JSONレスポンス文字列
   */
  private createErrorResponse(message: string, code: string): string {
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
}
