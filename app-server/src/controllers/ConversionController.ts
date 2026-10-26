import { Request, Response } from 'express';
import { PandocSocketClient, ConversionRequest, ApiResponse, ConvertFailureKind } from '../types';

/** 失敗の種類ごとの HTTP ステータスとクライアントへの固定文言（内部情報は返さない） */
const FAILURE_RESPONSES: Record<ConvertFailureKind, { status: number; error: string }> = {
  invalid_request: { status: 400, error: 'Invalid conversion request' },
  conversion_failed: { status: 502, error: 'Conversion failed' },
  unavailable: { status: 503, error: 'Pandoc server is not available' },
  runner_error: { status: 502, error: 'Pandoc server returned an unexpected response' }
};

/** 変換 API のリクエストを検証し、pandoc-runner の結果を HTTP レスポンスに対応付けるコントローラ */
export class ConversionController {
  constructor(private pandocClient: PandocSocketClient) {}

  async convertSync(req: Request, res: Response): Promise<void> {
    try {
      const { input, from_format = 'markdown', to_format = 'redmine-textile' }: ConversionRequest = req.body;

      // Validation
      if (!input || typeof input !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Invalid input: input field is required and must be a string',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      if (input.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid input: input cannot be empty',
          timestamp: new Date().toISOString()
        } as ApiResponse);
        return;
      }

      // 以前は変換前に ping して 2 接続を張っていたが、ping 成功後の切断が 500 になる等の
      // 問題があったため廃止。接続失敗は convert の結果（unavailable）で判定する
      const result = await this.pandocClient.convert(input, from_format, to_format);

      if (!result.ok) {
        console.error(
          `Conversion failed: kind=${result.kind} runnerCode=${result.runnerCode ?? '-'} detail=${result.detail}`
        );
        const failure = FAILURE_RESPONSES[result.kind];
        const body: ApiResponse = {
          success: false,
          error: failure.error,
          timestamp: new Date().toISOString()
        };
        res.status(failure.status).json(body);
        return;
      }

      const body: ApiResponse<{ output: string; from_format: string; to_format: string }> = {
        success: true,
        data: {
          output: result.output,
          from_format,
          to_format
        },
        timestamp: new Date().toISOString()
      };
      res.json(body);
    } catch (error) {
      console.error('Unexpected conversion error:', error);

      const body: ApiResponse = {
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(body);
    }
  }
}
