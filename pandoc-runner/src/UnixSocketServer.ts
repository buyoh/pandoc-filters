import * as net from 'net';
import * as fs from 'fs';
import { Logger, SocketServer } from './types';
import { DefaultLogger } from './Logger';
import { ClientConnection } from './ClientConnection';

/**
 * Unixソケット経由での通信を管理するクラス
 */
export class UnixSocketServer implements SocketServer {
  private socketPath: string;
  private logger: Logger;
  private server: net.Server | null = null;
  private running = false;

  constructor(socketPath: string, logger?: Logger) {
    this.socketPath = socketPath;
    this.logger = logger || new DefaultLogger();
  }

  /**
   * サーバーを開始する
   * @param requestHandler リクエストを処理するコールバック関数
   */
  async start(requestHandler: (requestLine: string) => Promise<string>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupSocket();
      
      // allowHalfOpen: 既定（false）ではクライアントが送信後に end()（FIN）すると
      // サーバ側の書き込みも閉じられ、応答を返せない。ClientConnection が応答後に閉じる
      this.server = net.createServer({ allowHalfOpen: true });
      this.running = true;

      this.server.on('connection', (socket: net.Socket) => {
        new ClientConnection(socket, requestHandler, this.logger);
      });

      this.server.on('error', (error: Error) => {
        this.logger.error(`Server error: ${error.message}`);
        reject(error);
      });

      this.server.listen(this.socketPath, () => {
        this.logger.info(`UnixSocket server started at ${this.socketPath}`);
        resolve();
      });
    });
  }

  /**
   * サーバーを停止する
   */
  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.running = false;
      
      this.server!.close(() => {
        this.cleanupSocket();
        this.logger.info('UnixSocket server stopped');
        resolve();
      });
    });
  }

  /**
   * サーバーが実行中かどうか
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * ソケットパスを取得
   */
  getSocketPath(): string {
    return this.socketPath;
  }

  /**
   * ソケットファイルをクリーンアップする
   */
  private cleanupSocket(): void {
    try {
      if (fs.existsSync(this.socketPath)) {
        fs.unlinkSync(this.socketPath);
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup socket: ${error}`);
    }
  }
}
