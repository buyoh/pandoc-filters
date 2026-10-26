import { Duplex } from 'stream';
import {
  CommandExecutor,
  CommandResult,
  ConversionOutcome,
  Logger,
  MarkdownConverter
} from '../types';

/**
 * テスト用のソケットスタブ。
 * receive() で任意の Buffer チャンクをクライアントからの受信データとして流し、
 * 書き込まれたデータを written に記録する。
 */
export class StubSocket extends Duplex {
  /** 書き込まれたデータ（UTF-8 文字列として連結） */
  written = '';

  _read(): void {}

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.written += chunk.toString('utf8');
    callback();
  }

  /** クライアントからのデータ受信を模擬する */
  receive(chunk: Buffer): void {
    this.push(chunk);
  }

  /** クライアントの half-close（FIN）を模擬する */
  receiveEnd(): void {
    this.push(null);
  }

  /** 書き込まれた応答を行単位で返す */
  writtenLines(): string[] {
    return this.written.split('\n').filter((line) => line.length > 0);
  }
}

/** 何も出力しないロガー */
export class SilentLogger implements Logger {
  info(): void {}
  debug(): void {}
  warn(): void {}
  error(): void {}
}

/** コンストラクタで指定した結果を返す MarkdownConverter のスタブ */
export class StubMarkdownConverter implements MarkdownConverter {
  /** 受け取った入力の記録 */
  received: string[] = [];

  constructor(private outcome: ConversionOutcome) {}

  async convertMarkdownToRedmineTextile(markdownText: string): Promise<ConversionOutcome> {
    this.received.push(markdownText);
    return this.outcome;
  }
}

/** コンストラクタで指定した結果を返す（または reject する）CommandExecutor のスタブ */
export class StubCommandExecutor implements CommandExecutor {
  constructor(private behavior: { result: CommandResult } | { error: Error }) {}

  async execute(): Promise<CommandResult> {
    if ('error' in this.behavior) {
      throw this.behavior.error;
    }
    return this.behavior.result;
  }
}

/** 条件が満たされるまで待つ（タイムアウトで失敗） */
export async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const startMs = Date.now();
  while (!predicate()) {
    if (Date.now() - startMs > timeoutMs) {
      throw new Error('waitFor: timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
