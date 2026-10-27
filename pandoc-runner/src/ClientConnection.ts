import { Duplex } from 'stream';
import { Logger } from './types';
import { createErrorResponse } from './responses';

/**
 * 1 クライアント接続分の行プロトコル処理を担うクラス。
 * UTF-8 デコード、改行区切りでの分割、リクエストの直列処理と応答書き込みを行う。
 * プロトコル仕様: docs-ai/architecture/pandoc-runner-protocol.md
 */
export class ClientConnection {
  private buffer = '';
  /** 受信したリクエストを 1 件ずつ処理するためのキュー。各リンクは必ず resolve する */
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private socket: Duplex,
    private requestHandler: (requestLine: string) => Promise<string>,
    private logger: Logger
  ) {
    // バグ修正: チャンクごとに Buffer#toString() すると、チャンク境界で分割された
    // マルチバイト文字（日本語は UTF-8 で 3 バイト）が U+FFFD に置換されていた。
    // setEncoding('utf8') で StringDecoder に境界処理を任せる。
    socket.setEncoding('utf8');

    socket.on('data', (data: string) => this.onData(data));

    // クライアントが書き込み側を閉じた（half-close）。受信済みのリクエストに応答してから閉じる
    socket.on('end', () => {
      this.enqueue(async () => {
        if (!this.isClosed()) {
          socket.end();
        }
      });
    });

    // リスナーが無いとクライアント切断時の ECONNRESET 等で runner 全体がクラッシュする
    socket.on('error', (error: Error) => {
      this.logger.error(`Client socket error: ${error.message}`);
    });

    socket.on('close', () => {
      // 改行で終わらない残りのデータは破棄する
      this.buffer = '';
      this.logger.debug('Client disconnected');
    });
  }

  private onData(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop()!; // 最後の不完全な行をバッファに保持

    for (const line of lines) {
      const requestLine = line.trim();
      if (requestLine) {
        // バグ修正: 以前は 'data' ごとに async で並行処理していたため、1 接続で複数の
        // リクエストを送ると応答順序が入れ替わり得た。キューに連結して直列に処理する。
        this.enqueue(() => this.processLine(requestLine));
      }
    }
  }

  /** キューに処理を連結する。処理が reject してもキューの連鎖を切らず、unhandled rejection にもしない */
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch(() => {});
  }

  /** 1 リクエストを処理して応答を書き込む */
  private async processLine(requestLine: string): Promise<void> {
    // 切断済みなら、キューに残ったリクエストで pandoc を起動しない
    if (this.isClosed()) {
      return;
    }

    let response: string;
    try {
      // 本文（markdown・変換結果）は機密情報を含み得るため、debug ログにも長さのみ出力する
      this.logger.debug(`Received request (${requestLine.length} chars)`);
      response = await this.requestHandler(requestLine);
    } catch (error) {
      this.logger.error(`Error handling request: ${error}`);
      response = createErrorResponse(`${error}`, 'INTERNAL_ERROR');
    }

    if (this.isClosed()) {
      this.logger.debug('Client already disconnected; response discarded');
      return;
    }
    this.socket.write(response + '\n');
    this.logger.debug(`Sent response (${response.length} chars)`);
  }

  private isClosed(): boolean {
    return this.socket.destroyed || this.socket.writableEnded;
  }
}
