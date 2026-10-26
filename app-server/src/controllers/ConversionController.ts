import { NextFunction, Request, Response } from 'express';
import {
  PandocSocketClient,
  ApiErrorResponse,
  ApiResponse,
  ConvertData,
  ConvertFailureKind,
} from '../types';
import { validateConversionRequest } from './ConversionRequestValidator';

/** 失敗の種類ごとの HTTP ステータスとクライアントへの固定文言（内部情報は返さない） */
const FAILURE_RESPONSES: Record<
  ConvertFailureKind,
  { status: number; error: string }
> = {
  invalid_request: { status: 400, error: 'Invalid conversion request' },
  conversion_failed: { status: 502, error: 'Conversion failed' },
  unavailable: { status: 503, error: 'Pandoc server is not available' },
  runner_error: {
    status: 502,
    error: 'Pandoc server returned an unexpected response',
  },
};

/** HTTP 応答として書き出す内容（Express に依存しない） */
export interface HttpResult {
  status: number;
  body: ApiResponse<ConvertData>;
}

function timestamp(): string {
  return new Date().toISOString();
}

function errorResult(status: number, error: string): HttpResult {
  const body: ApiErrorResponse = {
    success: false,
    error,
    timestamp: timestamp(),
  };
  return { status, body };
}

/** 変換 API のリクエストを検証し、pandoc-runner の結果を HTTP レスポンスに対応付けるコントローラ */
export class ConversionController {
  constructor(private pandocClient: PandocSocketClient) {}

  /** リクエストボディを検証・変換し、HTTP 応答内容を返す。予期しない例外も 500 の結果に変換し、例外を投げない */
  async handle(body: unknown): Promise<HttpResult> {
    try {
      const validation = validateConversionRequest(body);
      if (!validation.ok) {
        return errorResult(400, validation.error);
      }
      const { input, fromFormat, toFormat } = validation.request;

      // 以前は変換前に ping して 2 接続を張っていたが、ping 成功後の切断が 500 になる等の
      // 問題があったため廃止。接続失敗は convert の結果（unavailable）で判定する
      const result = await this.pandocClient.convert(
        input,
        fromFormat,
        toFormat
      );

      if (!result.ok) {
        console.error(
          `Conversion failed: kind=${result.kind} runnerCode=${result.runnerCode ?? '-'} detail=${result.detail}`
        );
        const failure = FAILURE_RESPONSES[result.kind];
        return errorResult(failure.status, failure.error);
      }

      return {
        status: 200,
        body: {
          success: true,
          data: {
            output: result.output,
            from_format: fromFormat,
            to_format: toFormat,
          },
          timestamp: timestamp(),
        },
      };
    } catch (error) {
      console.error('Unexpected conversion error:', error);
      return errorResult(500, 'Internal server error');
    }
  }

  /**
   * Express のハンドラ。handle の結果を res に書き出すだけで、reject しない
   * （Express 4 は async ハンドラの reject を捕捉せず、unhandledRejection でプロセスが終了するため）
   * @param next Express から呼ばれる場合は常に渡される。テストから直接呼ぶ場合は省略可能
   */
  async convertSync(
    req: Request,
    res: Response,
    next?: NextFunction
  ): Promise<void> {
    const result = await this.handle(req.body);
    try {
      res.status(result.status).json(result.body);
    } catch (error) {
      if (next) {
        next(error);
      } else {
        console.error('Failed to write conversion response:', error);
      }
    }
  }
}
