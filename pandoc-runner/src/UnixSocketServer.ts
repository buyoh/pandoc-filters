import * as net from 'net';
import * as fs from 'fs';
import { Logger, SocketServer } from './types';
import { ClientConnection } from './ClientConnection';

/** stop() で処理中の接続の終了を待つ既定の時間。docker stop の既定の猶予（10 秒）より短くする */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

/** UnixSocketServer の動作設定 */
export interface UnixSocketServerOptions {
  /** stop() で接続の終了を待つ時間。経過後に残った接続は破棄する。省略時は DEFAULT_SHUTDOWN_TIMEOUT_MS */
  shutdownTimeoutMs?: number;
}

/**
 * Unixソケット経由での通信を管理するクラス
 */
export class UnixSocketServer implements SocketServer {
  private server: net.Server | null = null;
  private running = false;
  /** 接続中のクライアント。stop() でタイムアウト後に破棄するために保持する */
  private connections = new Set<net.Socket>();
  private shutdownTimeoutMs: number;

  constructor(
    private socketPath: string,
    private logger: Logger,
    options: UnixSocketServerOptions = {}
  ) {
    this.shutdownTimeoutMs =
      options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
  }

  /**
   * サーバーを開始する
   * @param requestHandler リクエストを処理するコールバック関数
   */
  async start(
    requestHandler: (requestLine: string) => Promise<string>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupSocket();

      // allowHalfOpen: 既定（false）ではクライアントが送信後に end()（FIN）すると
      // サーバ側の書き込みも閉じられ、応答を返せない。ClientConnection が応答後に閉じる
      this.server = net.createServer({ allowHalfOpen: true });
      this.running = true;

      this.server.on('connection', (socket: net.Socket) => {
        this.connections.add(socket);
        socket.on('close', () => this.connections.delete(socket));
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
   * サーバーを停止する。新規接続の受け付けを止め、処理中の接続の終了を shutdownTimeoutMs まで待つ。
   * 経過後も残っている接続（アイドル接続・応答待ちの接続）は破棄する
   */
  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    return new Promise((resolve) => {
      this.running = false;

      // バグ修正: 以前は server.close() のみで、接続が残っている間 close のコールバックが呼ばれず
      // stop() が完了しなかった。そのためシグナル受信時は stop() を待たずに exit しており、
      // ソケットファイルの削除・停止ログが実行されなかった。待ち時間に上限を設け、超過分の接続は破棄する
      const timer = setTimeout(() => {
        this.logger.warn(
          `Destroying ${this.connections.size} connection(s) still open after ${this.shutdownTimeoutMs}ms`
        );
        for (const socket of this.connections) {
          socket.destroy();
        }
      }, this.shutdownTimeoutMs);

      this.server!.close(() => {
        clearTimeout(timer);
        this.cleanupSocket();
        this.logger.info('UnixSocket server stopped');
        resolve();
      });
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
