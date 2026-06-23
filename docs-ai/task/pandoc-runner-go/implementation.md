# pandoc-runner Go 版 実装詳細・進捗

## 実装ステータス

| コンポーネント | 実装 | テスト | 備考 |
|--------------|------|--------|------|
| types パッケージ | Done | - | 型定義のみ |
| logger パッケージ | Done | Done | |
| executor パッケージ | Done | Done | Unit-Real |
| converter パッケージ | Done | Done | StubCommandExecutor 使用 |
| handler パッケージ | Done | Done | StubPandocConverter 使用 |
| server/unix_socket | Done | Done | Unit-Real |
| server/runner_server | Done | Done | StubCommandExecutor 使用 |
| cmd/main.go | Done | - | |

## 実装手順

### Phase 1: 基盤整備

1. `go.mod` 作成（モジュール名: `pandoc-runner-go`）
2. `internal/types/types.go` - 共通型定義
3. `internal/logger/logger.go` + テスト

### Phase 2: コアロジック

4. `internal/executor/executor.go` + テスト
5. `internal/converter/converter.go` + テスト

### Phase 3: サーバーレイヤー

6. `internal/handler/handler.go` + テスト
7. `internal/server/unix_socket.go` + テスト
8. `internal/server/runner_server.go` + テスト

### Phase 4: エントリポイント

9. `cmd/pandoc-runner/main.go`
10. `README.md`

## テスト計画

### Unit-Fake テスト（モック使用）

各パッケージに `_test.go` を作成。外部コマンド実行やファイル操作はインターフェース経由でスタブ化。

**logger テスト**:
- ログレベルフィルタリング（debug < info < warn < error）
- フォーマット（タイムスタンプ、レベル、メッセージ）

**executor テスト** (Unit-Real):
- 実際にコマンドを実行する（`echo`, `cat` 等）
- 標準入力への書き込み
- 存在しないコマンドのエラーハンドリング
- 終了コードの取得
- スタブ実装 `StubCommandExecutor` をテストファイル内に定義し converter テストで再利用

**converter テスト**（スタブ CommandExecutor 使用）:
- `ValidatePandocAvailability` 成功・失敗
- `ConvertMarkdownToRedmineTextile` 成功
- pandoc が失敗した場合の ConversionError
- 環境変数 `PF_PANDOC_PATH` の反映

**handler テスト**（スタブ PandocConverter 使用）:
- convert リクエストの成功
- ping リクエスト
- 不正な JSON
- 不明なアクション
- 未対応の変換形式
- 変換エラー
- 必須フィールド欠如

**unix_socket テスト**:
- 実際のソケットを使ったリクエスト/レスポンス（Unit-Real）
- 既存ソケットファイルのクリーンアップ
- 複数クライアントの同時接続

### Feature-Fake テスト

- スタブ CommandExecutor + スタブソケットクライアントで end-to-end フロー検証

### Feature-Real テスト

- 実際の pandoc を呼び出した変換動作の確認

## 注意点・決定事項

- `timestamp` フィールドは `time.RFC3339Nano` で出力（`time.Now().UTC().Format(time.RFC3339Nano)`）。TypeScript 版（ミリ秒精度）より高精度だが ISO8601 準拠で互換性あり
- Unix ソケットファイルは起動時に `os.Remove()` で削除。`os.IsNotExist()` で未存在エラーは無視し、その他のエラーは起動失敗として扱う
- goroutine での接続処理。`context.WithCancel` + `sync.WaitGroup` でグレースフルシャットダウンを実装
- フィルターパスは実行バイナリの位置から相対パスで解決（`os.Executable()`）
- テストではモックライブラリを使用せず、インターフェースを実装したスタブ構造体を定義する
