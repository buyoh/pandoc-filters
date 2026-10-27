import { Duplex } from 'stream';
import {
  CommandExecutor,
  CommandResult,
  ConversionOutcome,
  Logger,
  MarkdownConverter,
  PandocAvailabilityValidator,
  RequestLineHandler,
  SocketServer,
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

  _write(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
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

/** 出力されたログを記録するロガー */
export class RecordingLogger implements Logger {
  messages: string[] = [];

  info(message: string): void {
    this.messages.push(message);
  }
  debug(message: string): void {
    this.messages.push(message);
  }
  warn(message: string): void {
    this.messages.push(message);
  }
  error(message: string): void {
    this.messages.push(message);
  }
}

/** コンストラクタで指定した結果を返す MarkdownConverter のスタブ */
export class StubMarkdownConverter implements MarkdownConverter {
  /** 受け取った入力の記録 */
  received: string[] = [];

  constructor(private outcome: ConversionOutcome) {}

  async convertMarkdownToRedmineTextile(
    markdownText: string
  ): Promise<ConversionOutcome> {
    this.received.push(markdownText);
    return this.outcome;
  }
}

/** コンストラクタで指定した結果を返す（または reject する）CommandExecutor のスタブ */
export class StubCommandExecutor implements CommandExecutor {
  /** execute に渡された command と args の記録 */
  calls: { command: string; args: string[] }[] = [];

  constructor(private behavior: { result: CommandResult } | { error: Error }) {}

  async execute(command: string, args: string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    if ('error' in this.behavior) {
      throw this.behavior.error;
    }
    return this.behavior.result;
  }
}

/** validatePandocAvailability の結果を指定できるスタブ。error 指定時はそれを投げる */
export class StubPandocValidator implements PandocAvailabilityValidator {
  calls = 0;

  /** @param error 投げるエラー。undefined なら検査成功 */
  constructor(private error?: Error) {}

  async validatePandocAvailability(): Promise<void> {
    this.calls++;
    if (this.error) {
      throw this.error;
    }
  }
}

/** 受け取ったリクエスト行を記録し、`echo:<行>` を返すスタブ */
export class EchoRequestHandler implements RequestLineHandler {
  received: string[] = [];

  async handleRequest(requestLine: string): Promise<string> {
    this.received.push(requestLine);
    return `echo:${requestLine}`;
  }
}

/** start / stop の呼び出しを記録するソケットサーバーのスタブ。startError 指定時は start が reject する */
export class StubSocketServer implements SocketServer {
  /** start に渡されたハンドラー。start が呼ばれていない場合は null */
  handler: ((requestLine: string) => Promise<string>) | null = null;
  stopCalls = 0;

  /** @param startError start で投げるエラー。undefined なら start 成功 */
  constructor(private startError?: Error) {}

  async start(
    requestHandler: (requestLine: string) => Promise<string>
  ): Promise<void> {
    if (this.startError) {
      throw this.startError;
    }
    this.handler = requestHandler;
  }

  async stop(): Promise<void> {
    this.stopCalls++;
  }
}

/** 条件が満たされるまで待つ（タイムアウトで失敗） */
export async function waitFor(
  predicate: () => boolean,
  timeoutMs = 2000
): Promise<void> {
  const startMs = Date.now();
  while (!predicate()) {
    if (Date.now() - startMs > timeoutMs) {
      throw new Error('waitFor: timed out');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
