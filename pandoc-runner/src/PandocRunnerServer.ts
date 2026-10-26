import {
  Logger,
  PandocAvailabilityValidator,
  RequestLineHandler,
  SocketServer,
} from './types';

/** PandocRunnerServer が使用するコンポーネント。組み立ては composition root（index.ts）で行う */
export interface PandocRunnerServerDeps {
  pandocValidator: PandocAvailabilityValidator;
  requestHandler: RequestLineHandler;
  socketServer: SocketServer;
  logger: Logger;
}

/**
 * Pandoc Runner Server
 * 起動時に pandoc の可用性を検査し、ソケットサーバーにリクエストハンドラーを接続する。
 * シグナル処理などプロセス全体に関わる処理は呼び出し側（index.ts）の責務とする
 */
export class PandocRunnerServer {
  private running = false;

  constructor(private deps: PandocRunnerServerDeps) {}

  /**
   * サーバーを開始する。pandoc が利用できない場合は ConversionError を、listen できない場合はそのエラーを投げる
   */
  async start(): Promise<void> {
    const { logger, pandocValidator, requestHandler, socketServer } = this.deps;
    logger.info('Starting Pandoc Runner Server...');

    // pandocの可用性をチェック。失敗の報告は呼び出し側（index.ts）が行う
    await pandocValidator.validatePandocAvailability();

    // サーバーを開始し、リクエストハンドラーをバインド
    try {
      await socketServer.start((requestLine: string) => {
        return requestHandler.handleRequest(requestLine);
      });
    } catch (error) {
      // listen に失敗しても net.Server は生成済みのため、閉じてから失敗を伝える
      await socketServer.stop().catch(() => {});
      throw error;
    }
    this.running = true;
  }

  /**
   * サーバーを停止する
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.deps.logger.info('Stopping Pandoc Runner Server...');
    this.running = false;
    await this.deps.socketServer.stop();
  }

  /**
   * サーバーが実行中かどうか
   */
  isRunning(): boolean {
    return this.running;
  }
}
