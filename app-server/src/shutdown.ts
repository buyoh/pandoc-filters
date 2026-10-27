/** 停止時に処理中のリクエストの完了を待つ既定の時間。docker stop の既定の猶予（10 秒）より短くする */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

/** シグナル登録・プロセス終了を行う対象。通常は process、テストではスタブを渡す */
export interface SignalTarget {
  once(signal: NodeJS.Signals, listener: () => void): unknown;
  exit(code: number): void;
}

/** 停止対象の HTTP サーバー（http.Server の必要な部分のみ） */
export interface ClosableServer {
  close(callback: (error?: Error) => void): unknown;
  closeIdleConnections(): void;
  closeAllConnections(): void;
}

/**
 * SIGINT / SIGTERM 受信時に HTTP サーバーを停止してプロセスを終了するハンドラーを登録する。
 * 新規接続の受け付けを止めてアイドル接続を閉じ、処理中のリクエストを shutdownTimeoutMs まで待つ。
 * 経過後は残りの接続を破棄する
 *
 * 以前はシグナルハンドラーが無く、Docker で PID 1 として動く node は SIGTERM を無視するため、
 * docker stop は猶予の 10 秒後に SIGKILL し、処理中の変換リクエストが切断されていた
 */
export function installShutdownHandlers(
  target: SignalTarget,
  server: ClosableServer,
  shutdownTimeoutMs: number = DEFAULT_SHUTDOWN_TIMEOUT_MS
): void {
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    target.once(signal, () => {
      console.log(`Received ${signal} signal, shutting down`);
      const timer = setTimeout(() => {
        console.warn(
          `Closing connections still open after ${shutdownTimeoutMs}ms`
        );
        server.closeAllConnections();
      }, shutdownTimeoutMs);
      server.close((error) => {
        clearTimeout(timer);
        if (error) {
          console.error(`Failed to stop server: ${error.message}`);
          target.exit(1);
          return;
        }
        console.log('Server stopped');
        target.exit(0);
      });
      // keep-alive で待機中の接続は close() の完了を妨げるため、処理中でないものは即座に閉じる
      server.closeIdleConnections();
    });
  }
}
