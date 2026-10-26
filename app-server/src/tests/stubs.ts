import { Duplex } from 'stream';
import { ConvertResult, PandocSocketClient } from '../types';

/**
 * テスト用のソケットスタブ。
 * receive() で runner からの応答チャンクを流し、書き込まれたリクエストを written に記録する。
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

  /** runner からのデータ受信を模擬する */
  receive(chunk: Buffer | string): void {
    this.push(typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk);
  }

  /** 指定したエラーコードの通信エラーを模擬する（'error' の後に 'close' が発生する） */
  fail(code: string): void {
    this.destroy(Object.assign(new Error(`stub ${code}`), { code }));
  }
}

/** 呼び出しを記録する Express Response のスタブ（テストでは `as unknown as Response` で渡す） */
export class RecordingResponse {
  /** status() で設定された HTTP ステータス。未設定の場合は 200 */
  statusCode = 200;
  /** json() に渡された body。json() が呼ばれていない場合は undefined */
  body: any = undefined;
  /** json() が呼ばれた回数 */
  jsonCallCount = 0;
  headersSent = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  json(body: unknown): this {
    this.body = body;
    this.jsonCallCount++;
    this.headersSent = true;
    return this;
  }
}

/** コンストラクタで指定した結果を返す（または例外を投げる）PandocSocketClient のスタブ */
export class StubPandocSocketClient implements PandocSocketClient {
  /** convert の呼び出し回数 */
  callCount = 0;
  /** 最後の convert 呼び出しの引数。一度も呼ばれていない場合は undefined */
  lastArgs:
    | { input: string; fromFormat: string; toFormat: string }
    | undefined = undefined;

  /** convert の振る舞い。テスト中に差し替えてよい */
  constructor(public behavior: { result: ConvertResult } | { error: Error }) {}

  async convert(
    input: string,
    fromFormat: string,
    toFormat: string
  ): Promise<ConvertResult> {
    this.callCount++;
    this.lastArgs = { input, fromFormat, toFormat };
    if ('error' in this.behavior) {
      throw this.behavior.error;
    }
    return this.behavior.result;
  }
}
