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
export function installSignalHandlers(target: SignalTarget, server: StoppableServer, logger: Logger): void {
  // バグ修正: 以前は index.ts と PandocRunnerServer の双方が SIGINT/SIGTERM ハンドラーを登録しており、
  // 停止処理が二重に走っていた。プロセス全体に関わるシグナル処理は composition root からのみ、この関数で登録する。
  // 接続中のクライアントを待つと終了しない可能性があるため、停止の完了を待たずに終了する。
  // そのためソケットファイルは残るが、次回起動時に UnixSocketServer.start が削除する
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    target.once(signal, () => {
      logger.info(`Received ${signal} signal`);
      void server.stop();
      target.exit(0);
    });
  }
}
