import * as net from 'net';
import * as fs from 'fs';
import { Logger } from './types';
import { DefaultLogger } from './Logger';

/**
 * Unixソケット経由での通信を管理するクラス
 */
export class UnixSocketServer {
  private static readonly DEFAULT_SOCKET_PATH = '/tmp/pandoc-runner.sock';
  
  private socketPath: string;
  private logger: Logger;
  private server: net.Server | null = null;
  private running = false;

  constructor(socketPath?: string, logger?: Logger) {
    this.socketPath = socketPath || UnixSocketServer.DEFAULT_SOCKET_PATH;
    this.logger = logger || new DefaultLogger();
  }

  /**
   * サーバーを開始する
   * @param requestHandler リクエストを処理するコールバック関数
   */
  async start(requestHandler: (requestLine: string) => Promise<string>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupSocket();
      
      this.server = net.createServer();
      this.running = true;

      this.server.on('connection', (socket: net.Socket) => {
        this.handleClient(socket, requestHandler);
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
   * クライアントからの接続を処理する
   * @param socket クライアントソケット
   * @param requestHandler リクエストハンドラー
   */
  private handleClient(
    socket: net.Socket, 
    requestHandler: (requestLine: string) => Promise<string>
  ): void {
    let buffer = '';

    socket.on('data', async (data: any) => {
      buffer += data.toString();
      
      // 改行で区切られたリクエストを処理
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 最後の不完全な行をバッファに保持

      for (const line of lines) {
        if (line.trim()) {
          try {
            this.logger.debug(`Received request: ${line.trim()}`);
            const response = await requestHandler(line.trim());
            
            socket.write(response + '\n');
            this.logger.debug(`Sent response: ${response}`);
          } catch (error) {
            this.logger.error(`Error handling request: ${error}`);
            const errorResponse = JSON.stringify({
              success: false,
              error: { message: `${error}`, code: 'INTERNAL_ERROR' },
              timestamp: new Date().toISOString()
            });
            socket.write(errorResponse + '\n');
          }
        }
      }
    });

    socket.on('error', (error: Error) => {
      this.logger.error(`Client socket error: ${error.message}`);
    });

    socket.on('close', () => {
      this.logger.debug('Client disconnected');
    });
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
