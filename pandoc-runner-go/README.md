# pandoc-runner-go

Go 言語による pandoc-runner の実装。TypeScript 版 (`pandoc-runner/`) と同一の Unix ソケットプロトコルで動作する。

## ビルド

```bash
cd pandoc-runner-go
go build -o pandoc-runner ./cmd/pandoc-runner
```

## 実行

```bash
# デフォルト設定で起動
./pandoc-runner

# カスタムソケットパスで起動
./pandoc-runner -socket /tmp/custom.sock

# 詳細ログ
./pandoc-runner -verbose

# 静音モード
./pandoc-runner -quiet
```

## テスト

```bash
cd pandoc-runner-go
go test ./...
```

## プロトコル

Unix ソケット経由で改行区切りの JSON リクエストを受け付ける。

### 変換リクエスト

```json
{"action":"convert","from":"markdown","to":"redmine-textile","content":"# Hello\n\nMarkdown content"}
```

### Ping

```json
{"action":"ping"}
```

### レスポンス形式

```json
{"success":true,"data":{"result":"...","from":"markdown","to":"redmine-textile"},"timestamp":"2024-01-01T00:00:00Z"}
{"success":true,"data":{"message":"pong"},"timestamp":"2024-01-01T00:00:00Z"}
{"success":false,"error":{"message":"...","code":"ERROR_CODE"},"timestamp":"2024-01-01T00:00:00Z"}
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `PF_PANDOC_PATH` | pandoc コマンドのパス | `pandoc` |
