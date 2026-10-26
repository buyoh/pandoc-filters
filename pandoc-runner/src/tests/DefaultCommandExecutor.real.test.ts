// Unit-Real: 実際に子プロセス（node）を起動する。ファイル作成・リモートアクセスは行わない
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DefaultCommandExecutor } from '../CommandExecutor';

describe('DefaultCommandExecutor (real process)', () => {
  const executor = new DefaultCommandExecutor();

  it('does not corrupt multibyte output that spans pipe chunks', async () => {
    // 「あ」(3 バイト) × 100,000 = 300,000 バイト。パイプのチャンク (64KiB = 65,536 バイト、
    // 3 の倍数でない) の境界が文字の途中に来るため、チャンクごとのデコードでは U+FFFD が混入する
    const count = 100000;
    const result = await executor.execute(process.execPath, [
      '-e',
      `process.stdout.write('あ'.repeat(${count}))`
    ]);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(result.stdout.includes('�'), false);
    assert.strictEqual(result.stdout.length, count);
  });

  it('reports signal termination instead of exit code 0', async () => {
    const result = await executor.execute(process.execPath, [
      '-e',
      "process.kill(process.pid, 'SIGKILL')"
    ]);
    assert.strictEqual(result.exitCode, null);
    assert.strictEqual(result.signal, 'SIGKILL');
  });

  it('does not crash when the child exits without reading stdin', async () => {
    // 4MiB はパイプバッファ (64KiB) を十分に超えるため、子の終了後の書き込みで EPIPE が発生する
    const stdin = 'x'.repeat(4 * 1024 * 1024);
    const result = await executor.execute(process.execPath, ['-e', 'process.exit(3)'], { stdin });
    assert.strictEqual(result.exitCode, 3);
    assert.strictEqual(result.signal, null);
  });

  it('rejects when the command cannot be spawned', async () => {
    await assert.rejects(
      executor.execute('/nonexistent/command-for-test', []),
      (error: NodeJS.ErrnoException) => error.code === 'ENOENT'
    );
  });
});
