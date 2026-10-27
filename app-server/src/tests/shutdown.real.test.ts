// Feature-Real: ループバックのエフェメラルポートで実際に HTTP サーバーを listen し、停止処理を確認する。
// シグナルとプロセス終了はスタブに置き換える
import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { installShutdownHandlers, SignalTarget } from '../shutdown';

/** シグナルハンドラーを記録し、exit の呼び出しを Promise で通知する SignalTarget のスタブ */
class StubSignalTarget implements SignalTarget {
  private listeners = new Map<NodeJS.Signals, () => void>();
  private onExit!: (code: number) => void;
  /** exit が呼ばれると、その終了コードで resolve する */
  exited = new Promise<number>((resolve) => (this.onExit = resolve));

  once(signal: NodeJS.Signals, listener: () => void): void {
    this.listeners.set(signal, listener);
  }

  exit(code: number): void {
    this.onExit(code);
  }

  emit(signal: NodeJS.Signals): void {
    this.listeners.get(signal)!();
  }
}

async function listen(
  handler: http.RequestListener
): Promise<{ server: http.Server; baseUrl: string }> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

describe('installShutdownHandlers (real HTTP server)', () => {
  it(
    'lets an in-flight request finish, then exits with 0',
    { timeout: 5000 },
    async () => {
      let received!: () => void;
      const requestReceived = new Promise<void>((r) => (received = r));
      const { server, baseUrl } = await listen((req, res) => {
        received();
        setTimeout(() => res.end('done'), 100);
      });
      const target = new StubSignalTarget();
      installShutdownHandlers(target, server, 2000);

      const response = fetch(`${baseUrl}/`);
      await requestReceived;
      target.emit('SIGTERM');

      const res = await response;
      assert.strictEqual(await res.text(), 'done');
      assert.strictEqual(await target.exited, 0);
      assert.strictEqual(server.listening, false);
    }
  );

  it(
    'exits after the timeout even if a request never finishes',
    { timeout: 5000 },
    async () => {
      let received!: () => void;
      const requestReceived = new Promise<void>((r) => (received = r));
      const { server, baseUrl } = await listen(() => {
        received(); // 応答しない
      });
      const target = new StubSignalTarget();
      installShutdownHandlers(target, server, 100);

      const response = fetch(`${baseUrl}/`).catch((error: Error) => error);
      await requestReceived;
      target.emit('SIGINT');

      assert.strictEqual(await target.exited, 0);
      assert.ok((await response) instanceof Error);
    }
  );
});
