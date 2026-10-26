import { spawn } from 'child_process';
import { CommandExecutor, CommandResult } from './types';

/**
 * 外部コマンドの実行を抽象化するクラス
 */
export class DefaultCommandExecutor implements CommandExecutor {
  /**
   * コマンドを実行する。コマンドを起動できない場合（ENOENT 等）は reject する
   * @param command 実行するコマンド
   * @param args コマンドの引数
   * @param options オプション（stdin等）
   */
  async execute(
    command: string,
    args: string[] = [],
    options: { stdin?: string } = {}
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // バグ修正: チャンクごとに Buffer#toString() していたため、パイプのチャンク境界
      // （通常 64KiB）で分割されたマルチバイト文字が U+FFFD に置換されていた。
      // Buffer のまま蓄積し、終了後に一括でデコードする。
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      // spawn 失敗時は 'error' の後に 'close' が続くことがあるため、結果は一度だけ確定させる
      let settled = false;

      child.stdout.on('data', (chunk: Buffer) => {
        stdoutChunks.push(chunk);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on('error', (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });

      // バグ修正: 以前は `exitCode: code || 0` としていたため、シグナルで kill された
      // プロセス（code === null）が成功扱いになっていた。code と signal をそのまま返す。
      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (settled) return;
        settled = true;
        resolve({
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          exitCode: code,
          signal,
        });
      });

      // バグ修正: stdin の 'error' にリスナーが無く、子プロセスが stdin を読み切る前に終了すると
      // EPIPE が uncaught exception となり runner 全体がクラッシュしていた。
      // stdin のエラー（EPIPE、spawn 失敗後の ERR_STREAM_DESTROYED 等）は無視し、
      // 成否は 'close' / 'error' で判定する。
      child.stdin.on('error', () => {});

      if (options.stdin !== undefined) {
        child.stdin.write(options.stdin);
      }
      child.stdin.end();
    });
  }
}
