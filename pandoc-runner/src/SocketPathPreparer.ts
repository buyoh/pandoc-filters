import * as fs from 'fs';
import * as net from 'net';

/** ソケットパスに存在するものの種類 */
export type SocketPathKind = 'missing' | 'socket' | 'other';

/**
 * 既存ソケットへの接続を試した結果
 * - live: 接続できた（別のプロセスが待ち受け中）
 * - stale: 接続を拒否された（待ち受けているプロセスが無い。前回の異常終了で残ったソケット）
 * - unknown: それ以外の失敗（権限不足・タイムアウト等）。message は原因
 */
export type SocketProbeResult =
  | { kind: 'live' }
  | { kind: 'stale' }
  | { kind: 'unknown'; message: string };

/** ソケットパスの検査・削除を行う操作。通常は FsSocketPathOperations、テストではスタブを渡す */
export interface SocketPathOperations {
  /** パスに存在するものの種類を返す（シンボリックリンクは辿らない） */
  kindOf(socketPath: string): SocketPathKind;
  /** 既存ソケットに接続できるか試す */
  probe(socketPath: string): Promise<SocketProbeResult>;
  /** パスを削除する。失敗した場合は例外を投げる */
  remove(socketPath: string): void;
}

/** prepareSocketPath の結果。listen できない状態はドメイン上想定される失敗として戻り値で返す */
export type PrepareSocketPathResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * listen の前にソケットパスを空ける。前回の異常終了で残った（接続できない）ソケットのみ削除する。
 *
 * 以前は種類を確認せずに unlink しており、稼働中の別インスタンスのソケットや、
 * 誤って指定した通常ファイルも削除していた
 *
 * 検査から削除までの間は排他しない。2 つのインスタンスが同時に起動すると、後から削除した側が
 * 先に listen したソケットを消し得るが、同じパスでの同時起動は運用上想定しないため許容する
 */
export async function prepareSocketPath(
  socketPath: string,
  ops: SocketPathOperations
): Promise<PrepareSocketPathResult> {
  const kind = ops.kindOf(socketPath);
  if (kind === 'missing') {
    return { ok: true };
  }
  if (kind === 'other') {
    return {
      ok: false,
      message: `${socketPath} exists and is not a socket; refusing to remove it`,
    };
  }

  const probed = await ops.probe(socketPath);
  if (probed.kind === 'live') {
    return {
      ok: false,
      message: `another server is already listening on ${socketPath}`,
    };
  }
  if (probed.kind === 'unknown') {
    return {
      ok: false,
      message: `cannot determine whether ${socketPath} is in use: ${probed.message}`,
    };
  }

  try {
    ops.remove(socketPath);
  } catch (error) {
    return {
      ok: false,
      message: `failed to remove stale socket ${socketPath}: ${error}`,
    };
  }
  return { ok: true };
}

/** 既存ソケットへの接続を待つ時間。応答の無いソケットで起動が止まらないようにする */
export const DEFAULT_PROBE_TIMEOUT_MS = 1000;

/** fs / net を使う SocketPathOperations の実装 */
export class FsSocketPathOperations implements SocketPathOperations {
  constructor(private probeTimeoutMs: number = DEFAULT_PROBE_TIMEOUT_MS) {}

  kindOf(socketPath: string): SocketPathKind {
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(socketPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 'missing';
      }
      throw error;
    }
    return stats.isSocket() ? 'socket' : 'other';
  }

  probe(socketPath: string): Promise<SocketProbeResult> {
    return new Promise((resolve) => {
      const client = net.createConnection(socketPath);
      const finish = (result: SocketProbeResult) => {
        client.destroy();
        resolve(result);
      };
      client.setTimeout(this.probeTimeoutMs, () =>
        finish({ kind: 'unknown', message: 'connection timed out' })
      );
      client.on('connect', () => finish({ kind: 'live' }));
      client.on('error', (error: NodeJS.ErrnoException) => {
        // ECONNREFUSED: 待ち受けているプロセスが無い。ENOENT: 検査後に削除された
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOENT') {
          finish({ kind: 'stale' });
        } else {
          finish({ kind: 'unknown', message: error.message });
        }
      });
    });
  }

  remove(socketPath: string): void {
    try {
      fs.unlinkSync(socketPath);
    } catch (error) {
      // 検査後に別プロセスが削除した場合は目的を達しているため成功とする
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
