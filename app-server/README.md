# App Server

Express TypeScript web server for pandoc conversion API.

## 概要

このサーバーは、pandoc-runnerサーバーと通信してマークダウンからRedmine Textileへの変換を行うREST APIを提供します。また、シンプルなWebアプリケーションをホストして、ブラウザからの変換操作を可能にします。

## セットアップ

```bash
# ルートディレクトリから依存関係をインストール
pnpm install --frozen-lockfile

# app-serverワークスペースをビルド
pnpm --filter app-server build
```

## 実行

```bash
# サーバーを起動（本番用）
pnpm --filter app-server start

# 開発用（TypeScriptファイルを直接実行）
pnpm --filter app-server dev

# 開発用（ファイル変更監視付き）
pnpm --filter app-server dev:watch

# カスタムソケットパスとポートでの起動
node dist/index.js --pandoc-socket-path /tmp/custom.sock --port 8080

# ルートディレクトリからの実行
pnpm app-server:start
pnpm app-server:dev
pnpm app-server:dev:watch
```

サーバー起動後、ブラウザで `http://localhost:3000` にアクセスしてWebアプリケーションを使用できます。

## Docker イメージ

ルートの `pnpm-lock.yaml` で依存を固定するため、リポジトリルートをビルドコンテキストとしてビルドします。BuildKit（Docker 23 以降の既定）が必要です。

```bash
# リポジトリルートで実行
docker build -f app-server/Dockerfile -t app-server .
```

## コマンドライン引数

- `--pandoc-socket-path <path>`: pandoc-runnerのUnixソケットパス (デフォルト: /tmp/pandoc-runner.sock)
- `--port <number>` または `-p <number>`: HTTPサーバーのポート番号。1〜65535 の整数 (デフォルト: 環境変数 `PORT`、未設定なら 3000)
- `--help` または `-h`: ヘルプメッセージを表示

不正な引数（未知のオプション、範囲外・数字以外のポート番号）や不正な `PORT` 環境変数を指定した場合はエラーを表示して終了コード 1 で終了する。`--port` を指定した場合 `PORT` は参照しない。

SIGINT / SIGTERM を受信すると新規接続の受け付けを止め、処理中のリクエストの完了を最大 5 秒待ってから終了する（超過した接続は切断する）。Docker で動かす場合は node が PID 1 にならないよう `init: true`（`docker run --init`）を指定する。

## API エンドポイント

### POST /api/v1/sync/convert

ドキュメントを同期的に変換します。リクエストは `Content-Type: application/json` のみ受け付ける（フォーム形式等は 415）。

`from_format` は `markdown`、`to_format` は `redmine-textile` のみ対応（省略時も同じ値）。それ以外は 400。

**リクエスト**
```json
{
  "input": "# Hello World\n\nThis is markdown.",
  "from_format": "markdown",
  "to_format": "redmine-textile"
}
```

**レスポンス（成功）**
```json
{
  "success": true,
  "data": {
    "output": "h1. Hello World\n\nThis is markdown.",
    "from_format": "markdown",
    "to_format": "redmine-textile"
  },
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

**レスポンス（エラー）**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

### GET /health

ヘルスチェック用エンドポイント。

**レスポンス**
```json
{
  "status": "ok",
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

## 使用例

```bash
# ヘルスチェック
curl http://localhost:3000/health

# マークダウン変換
curl -X POST http://localhost:3000/api/v1/sync/convert \
  -H "Content-Type: application/json" \
  -d '{
    "input": "# Hello World\n\nThis is a **bold** text."
  }'
```

## 前提条件

- pandoc-runnerサーバーが起動していること（/tmp/pandoc-runner.sockで待機）
- Node.js 20以上
- TypeScript

## テスト

```bash
# テスト実行（TypeScriptファイルを直接実行）
pnpm --filter app-server test

# テスト実行（ファイル変更監視付き）
pnpm --filter app-server test:watch

# ルートディレクトリからの実行
pnpm app-server:test
pnpm app-server:test:watch

# 従来方式（ビルド後にテスト実行）
pnpm --filter app-server build && node --test dist/tests/**/*.test.js
```

## プロジェクト構造

```
app-server/
├── src/
│   ├── controllers/          # HTTPリクエストハンドラー
│   │   ├── ConversionController.ts
│   │   └── ConversionRequestValidator.ts  # リクエストボディの検証
│   ├── middleware/          # Expressミドルウェア
│   │   ├── errorHandler.ts
│   │   ├── requireJson.ts   # application/json 以外を 415 で拒否
│   │   └── securityHeaders.ts  # CSP 等のセキュリティヘッダ
│   ├── services/            # ビジネスロジック
│   │   └── PandocSocketClientImpl.ts
│   ├── types/               # TypeScript型定義
│   │   └── index.ts
│   ├── tests/               # テストファイル
│   │   ├── stubs.ts         # テスト用スタブ
│   │   ├── app.real.test.ts # ルーティングの確認（ループバックで listen）
│   │   ├── config.test.ts
│   │   ├── index.test.ts
│   │   ├── ConversionController.test.ts
│   │   ├── ConversionRequestValidator.test.ts
│   │   ├── PandocSocketClientImpl.test.ts
│   │   ├── PandocSocketClientImpl.real.test.ts
│   │   ├── errorHandler.test.ts
│   │   ├── shutdown.test.ts
│   │   └── shutdown.real.test.ts  # 停止処理の確認（ループバックで listen）
│   ├── app.ts               # Express アプリの組み立て（createApp。listen はしない）
│   ├── config.ts            # コマンドライン引数・環境変数の解析（parseArgs）
│   ├── shutdown.ts          # SIGINT / SIGTERM 受信時の停止処理
│   └── index.ts             # アプリケーションエントリーポイント（main）
├── web-simple/              # Webアプリケーション
│   ├── index.html          # メインHTML
│   ├── style.css           # スタイルシート
│   ├── script.js           # JavaScript
│   └── README.md           # Web-app documentation
├── dist/                    # ビルド出力
├── package.json
└── tsconfig.json
```

## エラーハンドリング

エラー時の `error` は固定文言で、内部情報（ソケットパスや pandoc のエラー出力など）は含まない。詳細はサーバーのログに出力される。

- 400: 不正なリクエスト（入力データの検証エラー、`from_format` / `to_format` が文字列でない・未対応の値、不正な JSON）
- 413: リクエストボディが大きすぎる
- 415: `Content-Type` が `application/json` でない
- 502: 変換エラー、または pandoc-runner から想定外の応答
- 503: pandoc-runnerサーバーが利用できない
- 500: 内部サーバーエラー

全レスポンスに `Content-Security-Policy`（`default-src 'self'`、`frame-ancestors 'none'` 等）・`X-Content-Type-Options: nosniff`・`X-Frame-Options: DENY`・`Referrer-Policy: no-referrer` を付与し、`X-Powered-By` は返さない。web-simple ではインラインの script / style（`style` 属性を含む）を使わないこと。

`/api` 配下の存在しないパスには `{"error": "Not Found", "message": "API route <METHOD> <path> not found"}` を 404 で返す。