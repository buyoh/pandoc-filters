import { PandocConverter, DefaultFilterSelector } from './PandocConverter';
import { RequestHandler } from './RequestHandler';
import { UnixSocketServer } from './UnixSocketServer';
import { DefaultLogger } from './Logger';
import { Logger, ConversionError, FilterSelector as IFilterSelector } from './types';

/**
 * カスタムフィルターセレクター
 * Redmine用のフィルターを返す
 */
class CustomFilterSelector extends DefaultFilterSelector {
  /**
   * フィルターパスを取得する
   * @param fromFormat 変換元フォーマット
   * @param toFormat 変換先フォーマット
   * @returns フィルターパス（使わない場合はnull）
   */
  getFilterPath(fromFormat: string, toFormat: string): string | null {
    if (fromFormat === 'markdown' && toFormat === 'redmine-textile') {
      // TODO: 適切なパスに調整する
      try {
        const path = require('path');
        return path.resolve(__dirname, '../../dist/src/ToRedmine.js');
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Pandoc Runner Server
 * Unixソケット経由でpandoc変換リクエストを処理するサーバー
 */
export class PandocRunnerServer {
  static readonly DEFAULT_SOCKET_PATH = '/tmp/pandoc-runner.sock';

  private socketPath: string;
  private logger: Logger;
  private converter: PandocConverter;
  private requestHandler: RequestHandler;
  private server: UnixSocketServer;
  private running = false;

  constructor(
    socketPath: string = PandocRunnerServer.DEFAULT_SOCKET_PATH,
    logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'
  ) {
    this.socketPath = socketPath;
    this.logger = new DefaultLogger(logLevel);
    
    const filterSelector = new CustomFilterSelector();
    this.converter = new PandocConverter(undefined, filterSelector);
    this.requestHandler = new RequestHandler(this.converter);
    this.server = new UnixSocketServer(this.socketPath, this.logger);
  }

  /**
   * サーバーを開始する
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting Pandoc Runner Server...');

      // pandocの可用性をチェック
      await this.converter.validatePandocAvailability();

      this.setupSignalHandlers();
      this.running = true;

      // サーバーを開始し、リクエストハンドラーをバインド
      await this.server.start((requestLine: string) => {
        return this.requestHandler.handleRequest(requestLine);
      });

    } catch (error) {
      if (error instanceof ConversionError) {
        this.logger.error(`Conversion error: ${error.message}`);
        throw error;
      }
      this.logger.error(`Server error: ${error}`);
      this.stop();
      throw error;
    }
  }

  /**
   * サーバーを停止する
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.logger.info('Stopping Pandoc Runner Server...');
    this.running = false;
    this.server.stop();
  }

  /**
   * サーバーが実行中かどうか
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * シグナルハンドラーを設定する
   */
  private setupSignalHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM'] as const;
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal} signal`);
        this.stop();
        process.exit(0);
      });
    });
  }
}
