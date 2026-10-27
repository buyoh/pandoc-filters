/** 停止時に処理中のリクエストの完了を待つ既定の時間。docker stop の既定の猶予（10 秒）より短くする */
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 5000;

/**
 * 停止中にアイドル接続を閉じる間隔。処理中だった keep-alive 接続は応答後にアイドルになるが、
 * close() はそれを閉じないため、定期的に閉じて close() を完了させる
 */
export const IDLE_CLOSE_INTERVAL_MS = 50;

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
  // 停止中に別のシグナル（SIGINT の後の SIGTERM 等）を受けても、待機を打ち切らずに無視する。
  // 同じシグナルの 2 回目（Ctrl+C の 2 回押し等）は once で登録済みのため Node の既定動作で即時終了する（強制終了の手段として残す）
  // （以前は 2 回目の close() が ERR_SERVER_NOT_RUNNING となり、処理中に exit 1 していた）
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    target.once(signal, () => {
      if (stopping) {
        console.log(`Received ${signal} signal; already shutting down`);
        return;
      }
      stopping = true;
      console.log(`Received ${signal} signal, shutting down`);
      const timer = setTimeout(() => {
        console.warn(
          `Closing connections still open after ${shutdownTimeoutMs}ms`
        );
        server.closeAllConnections();
      }, shutdownTimeoutMs);
      // バグ修正: 以前はシグナル受信時に 1 回だけアイドル接続を閉じており、処理中だった keep-alive 接続が
      // 応答後もアイドルのまま残るため、close() は常にタイムアウトまで完了しなかった。完了まで定期的に閉じる
      const idleCloser = setInterval(
        () => server.closeIdleConnections(),
        IDLE_CLOSE_INTERVAL_MS
      );
      server.close((error) => {
        clearTimeout(timer);
        clearInterval(idleCloser);
        if (error) {
          console.error(`Failed to stop server: ${error.message}`);
          target.exit(1);
          return;
        }
        console.log('Server stopped');
        target.exit(0);
      });
      server.closeIdleConnections();
    });
  }
}
