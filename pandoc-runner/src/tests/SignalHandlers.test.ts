import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  installSignalHandlers,
  SignalTarget,
  StoppableServer,
} from '../SignalHandlers';
import { SilentLogger } from './stubs';

/** 登録されたシグナルハンドラーと exit の呼び出しを記録する SignalTarget のスタブ */
class StubSignalTarget implements SignalTarget {
  listeners: { signal: NodeJS.Signals; listener: () => void }[] = [];
  exitCodes: number[] = [];

  once(signal: NodeJS.Signals, listener: () => void): void {
    this.listeners.push({ signal, listener });
  }

  exit(code: number): void {
    this.exitCodes.push(code);
  }
}

class CountingServer implements StoppableServer {
  stopCalls = 0;

  async stop(): Promise<void> {
    this.stopCalls++;
  }
}

/** stop() の完了・失敗をテストから指示できるサーバー */
class DeferredServer implements StoppableServer {
  stopCalls = 0;
  private settle: { resolve: () => void; reject: (e: Error) => void } | null =
    null;

  stop(): Promise<void> {
    this.stopCalls++;
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
    });
  }

  finishStop(): void {
    this.settle!.resolve();
  }

  failStop(error: Error): void {
    this.settle!.reject(error);
  }
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('installSignalHandlers', () => {
  it('registers exactly one handler per signal', () => {
    // 以前は SIGINT/SIGTERM ハンドラーが二重に登録されていた
    const target = new StubSignalTarget();
    installSignalHandlers(target, new CountingServer(), new SilentLogger());
    assert.deepStrictEqual(
      target.listeners.map((l) => l.signal),
      ['SIGINT', 'SIGTERM']
    );
  });

  it('stops the server and exits with code 0 on a signal', async () => {
    const target = new StubSignalTarget();
    const server = new DeferredServer();
    installSignalHandlers(target, server, new SilentLogger());

    target.listeners[1].listener();
    await flushMicrotasks();

    assert.strictEqual(server.stopCalls, 1);
    // 以前は stop() の完了を待たずに exit していた（ソケット削除・停止ログが実行されなかった）
    assert.deepStrictEqual(target.exitCodes, []);

    server.finishStop();
    await flushMicrotasks();
    assert.deepStrictEqual(target.exitCodes, [0]);
  });

  it('exits with code 1 if stopping the server fails', async () => {
    const target = new StubSignalTarget();
    const server = new DeferredServer();
    installSignalHandlers(target, server, new SilentLogger());

    target.listeners[0].listener();
    server.failStop(new Error('boom'));
    await flushMicrotasks();

    assert.deepStrictEqual(target.exitCodes, [1]);
  });
});
