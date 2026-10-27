import * as net from 'net';
import * as fs from 'fs';
import { Logger, SocketServer, SocketStartError } from './types';
import { ClientConnection } from './ClientConnection';
import {
  FsSocketPathOperations,
  prepareSocketPath,
  SocketPathOperations,
} from './SocketPathPreparer';

/** stop() で処理中の接続の終了を待つ既定の時間。docker stop の既定の猶予（10 秒）より短くする */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * listen 後に設定するソケットファイルのパーミッション。所有者とグループのみ接続できる。
 * runner と同じ UID / GID のプロセス（docker-compose.yml では app-server）から接続する想定
 */
export const DEFAULT_SOCKET_MODE = 0o660;

/** UnixSocketServer の動作設定 */
export interface UnixSocketServerOptions {
  /** stop() で接続の終了を待つ時間。経過後に残った接続は破棄する。省略時は DEFAULT_SHUTDOWN_TIMEOUT_MS */
  shutdownTimeoutMs?: number;
  /** listen 後に chmod するパーミッション。省略時は DEFAULT_SOCKET_MODE */
  socketMode?: number;
  /** 起動前のソケットパス検査・削除と listen 後の chmod に使う操作。省略時は FsSocketPathOperations（テストでスタブに差し替える用） */
  pathOperations?: SocketPathOperations;
}

/**
 * Unixソケット経由での通信を管理するクラス
 */
export class UnixSocketServer implements SocketServer {
  private server: net.Server | null = null;
  private running = false;
  /** 接続中のクライアント。stop() でタイムアウト後に破棄するために保持する */
  private connections = new Set<net.Socket>();
  /** 実行中の stop() の Promise。stop() が複数回呼ばれた場合（2 つ目のシグナル等）は同じものを返す */
  private stopping: Promise<void> | null = null;
  private shutdownTimeoutMs: number;
  private socketMode: number;
  private pathOperations: SocketPathOperations;

  constructor(
    private socketPath: string,
    private logger: Logger,
    options: UnixSocketServerOptions = {}
  ) {
    this.shutdownTimeoutMs =
      options.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
    this.socketMode = options.socketMode ?? DEFAULT_SOCKET_MODE;
    this.pathOperations =
      options.pathOperations ?? new FsSocketPathOperations();
  }

  /**
   * サーバーを開始する。ソケットパスにソケット以外のファイルや稼働中のソケットがある場合は reject する
   * @param requestHandler リクエストを処理するコールバック関数
   */
  async start(
    requestHandler: (requestLine: string) => Promise<string>
  ): Promise<void> {
    const prepared = await prepareSocketPath(
      this.socketPath,
      this.pathOperations
    );
    if (!prepared.ok) {
      throw new SocketStartError(prepared.message);
    }

    return new Promise((resolve, reject) => {
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
        // listen 前のエラー（EACCES 等）は起動失敗として伝える。listen 後は reject しても無視される
        reject(
          new SocketStartError(
            `failed to listen on ${this.socketPath}: ${error.message}`
          )
        );
      });

      this.server.listen(this.socketPath, () => {
        // 以前はパーミッションを umask 任せにしており、umask によっては同一ホストの他ユーザが接続できた。
        // listen から chmod までのわずかな間は umask に従う
        try {
          this.pathOperations.chmod(this.socketPath, this.socketMode);
        } catch (error) {
          // パーミッションを絞れないまま待ち受けを続けないよう、閉じてから失敗を伝える
          this.running = false;
          this.server!.close();
          reject(
            new SocketStartError(
              `failed to set mode of ${this.socketPath}: ${error}`
            )
          );
          return;
        }
        this.logger.info(
          `UnixSocket server started at ${this.socketPath} (mode ${this.socketMode.toString(8)})`
        );
        resolve();
      });
    });
  }

  /**
   * サーバーを停止する。新規接続の受け付けを止め、処理中の接続の終了を shutdownTimeoutMs まで待つ。
   * 経過後も残っている接続（アイドル接続・応答待ちの接続）は破棄する。
   * ソケットファイルは server.close() の時点で Node（libuv）が削除する
   */
  async stop(): Promise<void> {
    if (this.stopping) {
      return this.stopping;
    }
    if (!this.running || !this.server) {
      return;
    }
    this.running = false;
    const server = this.server;

    this.stopping = new Promise((resolve) => {
      // バグ修正: 以前は server.close() のみで、接続が残っている間 close のコールバックが呼ばれず
      // stop() が完了しなかった。そのためシグナル受信時は stop() を待たずに exit しており、
      // 処理中のリクエストが打ち切られ、停止ログも出力されなかった。待ち時間に上限を設け、超過分の接続は破棄する
      const timer = setTimeout(() => {
        this.logger.warn(
          `Destroying ${this.connections.size} connection(s) still open after ${this.shutdownTimeoutMs}ms`
        );
        for (const socket of this.connections) {
          socket.destroy();
        }
      }, this.shutdownTimeoutMs);

      // バグ修正: 以前は close のコールバックでもソケットパスを unlink していたが、パスは close() の時点で
      // 既に削除されており、接続の終了を待つ間に別インスタンスが同じパスで起動すると、そのソケットを削除していた。
      // 削除は Node に任せ、ここでは unlink しない
      server.close(() => {
        clearTimeout(timer);
        this.stopping = null;
        this.logger.info('UnixSocket server stopped');
        resolve();
      });
    });
    return this.stopping;
  }
}
