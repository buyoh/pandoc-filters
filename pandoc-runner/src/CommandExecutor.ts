import { spawn } from 'child_process';
import { CommandExecutor } from './types';

/**
 * 外部コマンドの実行を抽象化するクラス
 */
export class DefaultCommandExecutor implements CommandExecutor {
  /**
   * コマンドを実行する
   * @param command 実行するコマンド
   * @param args コマンドの引数
   * @param options オプション（stdin等）
   * @returns Promise<{stdout, stderr, exitCode}>
   */
  async execute(
    command: string,
    args: string[] = [],
    options: { stdin?: string } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: any) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: any) => {
        stderr += data.toString();
      });

      child.on('error', (error: Error) => {
        reject(error);
      });

      child.on('close', (code: number | null) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
        });
      });

      // 標準入力にデータを送信
      if (options.stdin) {
        child.stdin?.write(options.stdin);
      }
      child.stdin?.end();
    });
  }
}
