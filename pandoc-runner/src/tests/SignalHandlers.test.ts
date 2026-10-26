import { describe, it } from 'node:test';
import assert from 'node:assert';
import { installSignalHandlers, SignalTarget, StoppableServer } from '../SignalHandlers';
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

describe('installSignalHandlers', () => {
  it('registers exactly one handler per signal', () => {
    // 以前は SIGINT/SIGTERM ハンドラーが二重に登録されていた
    const target = new StubSignalTarget();
    installSignalHandlers(target, new CountingServer(), new SilentLogger());
    assert.deepStrictEqual(target.listeners.map((l) => l.signal), ['SIGINT', 'SIGTERM']);
  });

  it('stops the server and exits with code 0 on a signal', () => {
    const target = new StubSignalTarget();
    const server = new CountingServer();
    installSignalHandlers(target, server, new SilentLogger());

    target.listeners[1].listener();

    assert.strictEqual(server.stopCalls, 1);
    assert.deepStrictEqual(target.exitCodes, [0]);
  });
});
