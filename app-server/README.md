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

## コマンドライン引数

- `--pandoc-socket-path <path>`: pandoc-runnerのUnixソケットパス (デフォルト: /tmp/pandoc-runner.sock)
- `--port <number>` または `-p <number>`: HTTPサーバーのポート番号 (デフォルト: 3000)
- `--help` または `-h`: ヘルプメッセージを表示

## API エンドポイント

### POST /api/v1/sync/convert

ドキュメントを同期的に変換します。

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
│   │   └── ConversionController.ts
│   ├── middleware/          # Expressミドルウェア
│   │   └── errorHandler.ts
│   ├── services/            # ビジネスロジック
│   │   └── PandocSocketClientImpl.ts
│   ├── types/               # TypeScript型定義
│   │   └── index.ts
│   ├── tests/               # テストファイル
│   │   ├── stubs.ts         # テスト用スタブ
│   │   ├── ConversionController.test.ts
│   │   ├── PandocSocketClientImpl.test.ts
│   │   ├── PandocSocketClientImpl.real.test.ts
│   │   └── errorHandler.test.ts
│   └── index.ts             # アプリケーションエントリーポイント
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

- 400: 不正なリクエスト（入力データの検証エラー、不正な JSON、未対応の変換形式）
- 413: リクエストボディが大きすぎる
- 502: 変換エラー、または pandoc-runner から想定外の応答
- 503: pandoc-runnerサーバーが利用できない
- 500: 内部サーバーエラー