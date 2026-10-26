import { createConnection } from 'net';
import { Duplex } from 'stream';
import { ConvertResult, PandocRequest, PandocResponse, PandocSocketClient } from '../types';

/** Unix ソケットパスへ接続した Duplex を返すファクトリ。テストではスタブを返す */
export type SocketConnector = (socketPath: string) => Duplex;

/** 通信レベルの結果 */
type SendResult =
  | { ok: true; response: PandocResponse }
  | { ok: false; kind: 'unavailable' | 'runner_error'; detail: string };

/** runner に接続できない（または過負荷）ことを示すエラーコード */
const UNAVAILABLE_ERROR_CODES = new Set(['ENOENT', 'ECONNREFUSED', 'EACCES', 'ENOTSOCK', 'EAGAIN']);

/**
 * 応答行の形を検証する。形が不正な場合は undefined
 * （プロパティ参照で TypeError になると、イベントリスナー内の例外としてプロセスが落ちるため）
 */
export function parseRunnerResponse(line: string): PandocResponse | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  const response = value as Record<string, unknown>;
  if (response.success === true) {
    if (response.data === null || typeof response.data !== 'object') {
      return undefined;
    }
    return response as unknown as PandocResponse;
  }
  if (response.success === false) {
    const error = response.error as Record<string, unknown> | null | undefined;
    if (!error || typeof error !== 'object' || typeof error.code !== 'string' || typeof error.message !== 'string') {
      return undefined;
    }
    return response as unknown as PandocResponse;
  }
  return undefined;
}

/** pandoc-runner と Unix ソケットで 1 リクエスト 1 接続の通信を行うクライアント */
export class PandocSocketClientImpl implements PandocSocketClient {
  constructor(
    private socketPath: string = '/tmp/pandoc-runner.sock',
    private connect: SocketConnector = (socketPath) => createConnection(socketPath)
  ) {}

  async convert(input: string, fromFormat: string, toFormat: string): Promise<ConvertResult> {
    const sent = await this.sendRequest({
      action: 'convert',
      content: input,
      from: fromFormat,
      to: toFormat
    });
    if (!sent.ok) {
      return { ok: false, kind: sent.kind, detail: sent.detail };
    }

    const response = sent.response;
    if (!response.success) {
      const { code, message } = response.error;
      switch (code) {
        case 'INVALID_REQUEST':
        case 'UNSUPPORTED_CONVERSION':
          return { ok: false, kind: 'invalid_request', runnerCode: code, detail: message };
        case 'CONVERSION_ERROR':
          return { ok: false, kind: 'conversion_failed', runnerCode: code, detail: message };
        default:
          // INVALID_JSON / UNKNOWN_ACTION は app-server 自身が組み立てたリクエストで起きるため runner_error とする
          return { ok: false, kind: 'runner_error', runnerCode: code, detail: message };
      }
    }

    if (typeof response.data.result !== 'string') {
      return { ok: false, kind: 'runner_error', detail: 'Convert response has no result' };
    }
    return { ok: true, output: response.data.result };
  }

  private sendRequest(request: PandocRequest): Promise<SendResult> {
    return new Promise((resolve) => {
      const socket = this.connect(this.socketPath);
      let responseData = '';
      // 結果は一度だけ確定させる（以前は応答の解析後に 'close' でも reject 判定が走っていた）
      let settled = false;

      const settle = (result: SendResult) => {
        if (settled) return;
        settled = true;
        if (!socket.destroyed) {
          socket.end();
        }
        resolve(result);
      };

      // バグ修正: 以前は 'data' のチャンクごとに Buffer#toString() しており、チャンク境界で
      // 分割されたマルチバイト文字（日本語は UTF-8 で 3 バイト）が U+FFFD に置換されていた。
      // setEncoding('utf8') で StringDecoder に境界処理を任せる。
      socket.setEncoding('utf8');

      socket.on('data', (data: string) => {
        try {
          responseData += data;
          const newline = responseData.indexOf('\n');
          if (newline < 0) {
            return;
          }
          const response = parseRunnerResponse(responseData.slice(0, newline));
          if (!response) {
            settle({ ok: false, kind: 'runner_error', detail: 'Invalid response from pandoc-runner' });
            return;
          }
          settle({ ok: true, response });
        } catch (error) {
          settle({ ok: false, kind: 'runner_error', detail: `Failed to handle response: ${error}` });
        }
      });

      socket.on('error', (error: NodeJS.ErrnoException) => {
        const kind = error.code !== undefined && UNAVAILABLE_ERROR_CODES.has(error.code)
          ? 'unavailable'
          : 'runner_error';
        settle({ ok: false, kind, detail: `Socket error: ${error.message}` });
      });

      socket.on('close', () => {
        settle({ ok: false, kind: 'runner_error', detail: 'Socket closed without receiving complete response' });
      });

      // net.Socket は接続確立前の書き込みをバッファするため、connect イベントを待たずに書き込む
      socket.write(JSON.stringify(request) + '\n');
    });
  }
}
