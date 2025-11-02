# App Server

Express TypeScript web server for pandoc conversion API.

## 概要

このサーバーは、pandoc-runnerサーバーと通信してマークダウンからRedmine Textileへの変換を行うREST APIを提供します。

## セットアップ

```bash
# ルートディレクトリから依存関係をインストール
yarn install

# app-serverワークスペースをビルド
yarn workspace app-server build
```

## 実行

```bash
# サーバーを起動（本番用）
yarn workspace app-server start

# 開発用（TypeScriptファイルを直接実行）
yarn workspace app-server dev

# 開発用（ファイル変更監視付き）
yarn workspace app-server dev:watch

# ルートディレクトリからの実行
yarn app-server:start
yarn app-server:dev
yarn app-server:dev:watch
```

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
# テスト実行
yarn workspace app-server test

# ビルド + テスト
yarn workspace app-server build && yarn workspace app-server test
```

## プロジェクト構造

```
app-server/
├── src/
│   ├── controllers/          # HTTPリクエストハンドラー
│   │   └── ConversionController.ts
│   ├── services/            # ビジネスロジック
│   │   └── PandocSocketClientImpl.ts
│   ├── types/               # TypeScript型定義
│   │   └── index.ts
│   ├── tests/               # テストファイル
│   │   ├── ConversionController.test.ts
│   │   └── PandocSocketClient.test.ts
│   └── index.ts             # アプリケーションエントリーポイント
├── dist/                    # ビルド出力
├── package.json
└── tsconfig.json
```

## エラーハンドリング

- 400: 不正なリクエスト（入力データの検証エラー）
- 503: pandoc-runnerサーバーが利用できない
- 500: 変換エラーまたは内部サーバーエラー