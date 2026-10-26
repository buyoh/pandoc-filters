import {
  ConversionRequest,
  ConversionResult,
  MarkdownConverter,
  PingResult,
  RequestLineHandler
} from './types';
import { validateRequest } from './RequestValidator';
import { createErrorResponse, createSuccessResponse } from './responses';

/**
 * JSONリクエストの解析と処理、レスポンスの生成を行うクラス
 * プロトコル仕様: docs-ai/architecture/pandoc-runner-protocol.md
 */
export class RequestHandler implements RequestLineHandler {
  private converter: MarkdownConverter;

  constructor(converter: MarkdownConverter) {
    this.converter = converter;
  }

  /**
   * JSONリクエストを処理してJSONレスポンスを返す
   * @param requestJson JSONリクエスト文字列
   * @returns JSONレスポンス文字列
   */
  async handleRequest(requestJson: string): Promise<string> {
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(requestJson);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return createErrorResponse(`Invalid JSON: ${message}`, 'INVALID_JSON');
      }

      const validation = validateRequest(raw);
      if (!validation.ok) {
        return createErrorResponse(validation.message, validation.code);
      }

      const request = validation.request;
      switch (request.action) {
        case 'convert':
          return await this.handleConvertRequest(request);
        case 'ping':
          return this.handlePingRequest();
      }
    } catch (error) {
      return createErrorResponse(`Internal error: ${error}`, 'INTERNAL_ERROR');
    }
  }

  /**
   * 変換リクエストを処理する
   * @param request 検証済みのリクエスト
   * @returns JSONレスポンス文字列
   */
  private async handleConvertRequest(request: ConversionRequest): Promise<string> {
    const { from: fromFormat, to: toFormat, content } = request;

    // 現在はmarkdown -> redmine-textileのみサポート
    if (fromFormat !== 'markdown' || toFormat !== 'redmine-textile') {
      return createErrorResponse(
        `Unsupported conversion: ${fromFormat} -> ${toFormat}`,
        'UNSUPPORTED_CONVERSION'
      );
    }

    const outcome = await this.converter.convertMarkdownToRedmineTextile(content);
    if (!outcome.ok) {
      return createErrorResponse(`Conversion failed: ${outcome.message}`, 'CONVERSION_ERROR');
    }

    return createSuccessResponse<ConversionResult>({
      result: outcome.output,
      from: fromFormat,
      to: toFormat
    });
  }

  /**
   * pingリクエストを処理する
   * @returns JSONレスポンス文字列
   */
  private handlePingRequest(): string {
    return createSuccessResponse<PingResult>({ message: 'pong' });
  }
}
