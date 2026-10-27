import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ClosableServer,
  installShutdownHandlers,
  SignalTarget,
} from '../shutdown';

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

  emit(signal: NodeJS.Signals): void {
    this.listeners.find((l) => l.signal === signal)!.listener();
  }
}

/** 呼び出しを記録し、close の完了をテストから指示できるサーバーのスタブ */
class StubServer implements ClosableServer {
  calls: string[] = [];
  private closeCallback: ((error?: Error) => void) | null = null;

  close(callback: (error?: Error) => void): void {
    this.calls.push('close');
    this.closeCallback = callback;
  }

  closeIdleConnections(): void {
    this.calls.push('closeIdleConnections');
  }

  closeAllConnections(): void {
    this.calls.push('closeAllConnections');
  }

  finishClose(error?: Error): void {
    this.closeCallback!(error);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('installShutdownHandlers', () => {
  it('registers one handler each for SIGINT and SIGTERM', () => {
    const target = new StubSignalTarget();
    installShutdownHandlers(target, new StubServer());
    assert.deepStrictEqual(
      target.listeners.map((l) => l.signal),
      ['SIGINT', 'SIGTERM']
    );
  });

  it('closes the server and exits with 0 only after close completes', () => {
    const target = new StubSignalTarget();
    const server = new StubServer();
    installShutdownHandlers(target, server, 10_000);

    target.emit('SIGTERM');
    assert.deepStrictEqual(server.calls, ['close', 'closeIdleConnections']);
    assert.deepStrictEqual(target.exitCodes, []);

    server.finishClose();
    assert.deepStrictEqual(target.exitCodes, [0]);
  });

  it('destroys remaining connections after the timeout', async () => {
    const target = new StubSignalTarget();
    const server = new StubServer();
    installShutdownHandlers(target, server, 10);

    target.emit('SIGINT');
    await sleep(50);

    assert.deepStrictEqual(server.calls, [
      'close',
      'closeIdleConnections',
      'closeAllConnections',
    ]);
    server.finishClose();
    assert.deepStrictEqual(target.exitCodes, [0]);
  });

  it('does not destroy connections if close completes before the timeout', async () => {
    const target = new StubSignalTarget();
    const server = new StubServer();
    installShutdownHandlers(target, server, 10);

    target.emit('SIGTERM');
    server.finishClose();
    await sleep(50);

    assert.ok(!server.calls.includes('closeAllConnections'));
  });

  it('exits with 1 if close fails', () => {
    const target = new StubSignalTarget();
    const server = new StubServer();
    installShutdownHandlers(target, server, 10_000);

    target.emit('SIGTERM');
    server.finishClose(new Error('not running'));

    assert.deepStrictEqual(target.exitCodes, [1]);
  });
});
