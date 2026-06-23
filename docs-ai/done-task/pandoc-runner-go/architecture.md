# pandoc-runner Go 版 アーキテクチャ設計

## 全体構成

`pandoc-runner`（TypeScript 版）と同一のアーキテクチャを Go で再実装する。

```
pandoc-runner-go/
├── cmd/
│   └── pandoc-runner/
│       └── main.go            # エントリポイント・CLI フラグ解析
├── internal/
│   ├── logger/
│   │   ├── logger.go          # Logger インターフェースと実装
│   │   └── logger_test.go
│   ├── executor/
│   │   ├── executor.go        # CommandExecutor インターフェースと実装
│   │   └── executor_test.go
│   ├── converter/
│   │   ├── converter.go       # PandocConverter（変換ロジック）
│   │   └── converter_test.go
│   ├── handler/
│   │   ├── handler.go         # RequestHandler（JSON リクエスト処理）
│   │   └── handler_test.go
│   ├── server/
│   │   ├── unix_socket.go     # Unix ソケットサーバー
│   │   ├── unix_socket_test.go
│   │   ├── runner_server.go   # PandocRunnerServer（オーケストレーション）
│   │   └── runner_server_test.go
│   └── types/
│       └── types.go           # 共通型定義
├── go.mod
├── go.sum
└── README.md
```

## コンポーネント設計

### 1. types パッケージ

TypeScript 版の型定義を Go の struct/interface に変換する。

```go
// リクエスト型
type ConversionRequest struct {
    Action  string `json:"action"`
    From    string `json:"from"`
    To      string `json:"to"`
    Content string `json:"content"`
}

type PingRequest struct {
    Action string `json:"action"`
}

// レスポンス型
type SuccessResponse struct {
    Success   bool        `json:"success"`
    Data      interface{} `json:"data"`
    Timestamp string      `json:"timestamp"`
}

type ErrorResponse struct {
    Success   bool        `json:"success"`
    Error     ErrorDetail `json:"error"`
    Timestamp string      `json:"timestamp"`
}

type ErrorDetail struct {
    Message string `json:"message"`
    Code    string `json:"code"`
}

// 変換結果
type ConversionResult struct {
    Result string `json:"result"`
    From   string `json:"from"`
    To     string `json:"to"`
}

type PingResult struct {
    Message string `json:"message"`
}
```

**エラー型**:
```go
// ConversionError はドメインの変換エラー（戻り値で返す）
type ConversionError struct {
    Message string
}

func (e *ConversionError) Error() string { return e.Message }
```

**エラーハンドリング方針**:
- `ConversionError`: pandoc 変換の失敗など、ドメイン上の想定されるエラー → 戻り値で返す
- `error`（標準）: ソケット通信エラー・os/exec のコマンド未発見など → 呼び出し元に伝播させる
- `panic`: 起動時の設定不備など回復不能な異常のみ使用

### 2. logger パッケージ

**インターフェース**:
```go
type Logger interface {
    Info(message string)
    Debug(message string)
    Warn(message string)
    Error(message string)
}
```

**実装**: `DefaultLogger`
- ログレベル: `debug`, `info`, `warn`, `error`
- 出力フォーマット: `[ISO8601] LEVEL: message`
- 全レベルを `os.Stderr` に出力（TypeScript 版の console.log/warn/error 統一に合わせる）

### 3. executor パッケージ

**インターフェース**:
```go
type CommandExecutor interface {
    Execute(command string, args []string, stdin string) (ExecuteResult, error)
}

type ExecuteResult struct {
    Stdout   string
    Stderr   string
    ExitCode int
}
```

**実装**: `DefaultCommandExecutor`
- `os/exec` パッケージを使用
- 標準入力のパイプ処理をサポート
- コマンド未発見の場合は error を返す

### 4. converter パッケージ

**インターフェース**:
```go
type FilterSelector interface {
    GetFilterPath(fromFormat, toFormat string) (string, bool)
}
```

**実装**: `PandocConverter`
- `ValidatePandocAvailability() error` - pandoc コマンドの存在確認
- `ConvertMarkdownToRedmineTextile(markdownText string) (string, *types.ConversionError)` - 変換実行
- pandoc パスは環境変数 `PF_PANDOC_PATH` で上書き可能（なければ `pandoc`）

**フィルターパス**:
- `markdown` → `redmine-textile` の場合、`../dist/src/ToRedmine.js` を使用
- 環境変数や設定で上書き可能

### 5. handler パッケージ

**実装**: `RequestHandler`
- `HandleRequest(requestJSON string) string` - JSON 文字列を受け取り JSON 文字列を返す
- 処理フロー:
  1. JSON パース
  2. `action` フィールドで分岐
  3. `convert`: バリデーション → `PandocConverter` 呼び出し
  4. `ping`: pong レスポンス返却
  5. エラーは全て JSON エラーレスポンスとして返す（パニックしない）

**エラーコード**:
- `INVALID_JSON`: JSON パースエラー
- `UNKNOWN_ACTION`: 不明なアクション
- `UNSUPPORTED_CONVERSION`: 未対応の変換形式
- `CONVERSION_ERROR`: pandoc 変換エラー
- `INTERNAL_ERROR`: 内部エラー

### 6. server パッケージ

#### UnixSocketServer

- Unix ドメインソケットを作成・管理
- 起動時に既存ソケットファイルを削除（クリーンアップ）。`os.Remove()` のエラーは `os.IsNotExist()` で判別し、存在しない場合のみ無視する
- 各クライアント接続を goroutine で処理
- 改行区切り (`\n`) のプロトコル
  - クライアントから改行区切りの JSON を受信
  - 1 行 = 1 リクエスト
  - レスポンスも改行で終端
- SIGINT/SIGTERM でグレースフルシャットダウン

**グレースフルシャットダウンの実装パターン**:
1. `context.WithCancel` で接続処理にキャンセルシグナルを伝播
2. `sync.WaitGroup` で各接続 goroutine を追跡
3. `Stop()` 呼び出し時:
   - context をキャンセル
   - `net.Listener.Close()` で新規接続を停止
   - `sync.WaitGroup.Wait()` で処理中のリクエスト終了を待機

```go
type UnixSocketServer struct {
    socketPath string
    logger     logger.Logger
    listener   net.Listener
    cancel     context.CancelFunc
    wg         sync.WaitGroup
}

func (s *UnixSocketServer) Start(ctx context.Context, handler func(string) string) error
func (s *UnixSocketServer) Stop()
```

#### PandocRunnerServer

- 全コンポーネントを初期化・オーケストレーション
- pandoc の存在確認を起動時に実施

## 通信プロトコル（TypeScript 版との互換性）

### リクエスト形式

改行 (`\n`) 区切りの JSON（1 行 = 1 リクエスト）:

```json
{"action":"convert","from":"markdown","to":"redmine-textile","content":"# Hello"}
{"action":"ping"}
```

### レスポンス形式

```json
{"success":true,"data":{"result":"h1. Hello","from":"markdown","to":"redmine-textile"},"timestamp":"2024-01-01T00:00:00.000Z"}
{"success":true,"data":{"message":"pong"},"timestamp":"2024-01-01T00:00:00.000Z"}
{"success":false,"error":{"message":"...","code":"ERROR_CODE"},"timestamp":"2024-01-01T00:00:00.000Z"}
```

## CLI インターフェース

```
Usage: pandoc-runner [options]

Options:
  -socket string    Unix socket path (default "/tmp/pandoc-runner.sock")
  -verbose          Verbose logging (debug level)
  -quiet            Quiet logging (warn level)
  -version          Print version and exit
```

## 依存関係

Go 標準ライブラリのみを使用する（外部パッケージ不使用）:
- `encoding/json`: JSON エンコード/デコード
- `net`: Unix ソケット通信
- `os/exec`: 外部コマンド実行
- `flag`: CLI フラグ解析
- `os`: シグナル処理・環境変数
- `log`: 低レベルログ（DefaultLogger の基盤）
- `time`: タイムスタンプ生成
- `bufio`: バッファリング読み込み

## タイムスタンプフォーマット

`timestamp` フィールドは `time.RFC3339Nano` で出力する:

```go
time.Now().UTC().Format(time.RFC3339Nano)
// 例: "2024-01-01T00:00:00.123456789Z"
```

- TypeScript 版の `.toISOString()` はミリ秒精度 UTC（例: `2024-01-01T00:00:00.123Z`）
- Go 版は RFC3339Nano（ナノ秒精度 + Z サフィックス）でより高い精度を提供
- クライアントは ISO8601 準拠であれば受け入れられるため互換性に問題なし

## テスト実装方針

**モックライブラリ禁止**。インターフェースを実装したスタブ構造体を使用する:

```go
// CommandExecutor のスタブ例
type StubCommandExecutor struct {
    result executor.ExecuteResult
    err    error
}

func (s *StubCommandExecutor) Execute(cmd string, args []string, stdin string) (executor.ExecuteResult, error) {
    return s.result, s.err
}
```

各テストファイルにスタブ定義を含め、テスト間で再利用する。

## 設計方針

1. **TypeScript 版との互換性**: JSON プロトコルが完全互換であること
2. **単一責任原則**: 各パッケージは 1 つの責務のみ持つ
3. **依存性注入**: テスタビリティのため、インターフェースで依存を注入
4. **エラーハンドリング**: ドメインエラーは戻り値、致命的エラーのみ panic
5. **外部依存なし**: Go 標準ライブラリのみ使用
6. **モック禁止**: テストはスタブ・ドライバクラスで依存を制御する
