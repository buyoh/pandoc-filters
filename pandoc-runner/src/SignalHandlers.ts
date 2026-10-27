import { Logger } from './types';

/** シグナル登録・プロセス終了を行う対象。通常は process、テストではスタブを渡す */
export interface SignalTarget {
  once(signal: NodeJS.Signals, listener: () => void): unknown;
  exit(code: number): void;
}

/** 停止可能なサーバー */
export interface StoppableServer {
  stop(): Promise<void>;
}

/**
 * SIGINT / SIGTERM 受信時にサーバーを停止してプロセスを終了するハンドラーを登録する
 */
export function installSignalHandlers(
  target: SignalTarget,
  server: StoppableServer,
  logger: Logger
): void {
  // バグ修正: 以前は index.ts と PandocRunnerServer の双方が SIGINT/SIGTERM ハンドラーを登録しており、
  // 停止処理が二重に走っていた。プロセス全体に関わるシグナル処理は composition root からのみ、この関数で登録する。
  // また以前は stop() の完了を待たずに exit しており、処理中のリクエストが打ち切られ、停止ログも出力されなかった。
  // stop() の完了を待ってから終了する（stop() は接続の待ち時間に上限があるため、接続が残っていても終了する）。
  // 停止中に別のシグナル（SIGINT の後の SIGTERM 等）を受けても、待機を打ち切らずに無視する
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    target.once(signal, () => {
      if (stopping) {
        logger.info(`Received ${signal} signal; already stopping`);
        return;
      }
      stopping = true;
      logger.info(`Received ${signal} signal`);
      server.stop().then(
        () => target.exit(0),
        (error) => {
          logger.error(`Failed to stop server: ${error}`);
          target.exit(1);
        }
      );
    });
  }
}
