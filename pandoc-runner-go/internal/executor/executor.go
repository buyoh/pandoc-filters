// Package executor は外部コマンドの実行を抽象化する。
package executor

import (
	"bytes"
	"os/exec"
	"strings"
)

// ExecuteResult は外部コマンドの実行結果を表す。
type ExecuteResult struct {
	// Stdout はコマンドの標準出力（末尾の改行を除去済み）。
	Stdout string
	// Stderr はコマンドの標準エラー出力（末尾の改行を除去済み）。
	Stderr string
	// ExitCode はコマンドの終了コード。
	ExitCode int
}

// CommandExecutor は外部コマンドの実行を抽象化するインターフェース。
type CommandExecutor interface {
	// Execute はコマンドを実行して結果を返す。
	// stdin が空文字列でない場合、標準入力にその内容を渡す。
	// コマンド自体が見つからない場合は error を返す。
	Execute(command string, args []string, stdin string) (ExecuteResult, error)
}

// DefaultCommandExecutor は CommandExecutor の標準実装。
type DefaultCommandExecutor struct{}

// New は DefaultCommandExecutor を生成する。
func New() *DefaultCommandExecutor {
	return &DefaultCommandExecutor{}
}

// Execute はコマンドを実行して結果を返す。
func (e *DefaultCommandExecutor) Execute(command string, args []string, stdin string) (ExecuteResult, error) {
	cmd := exec.Command(command, args...)

	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	err := cmd.Run()

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			// コマンドが非ゼロで終了した場合はエラーではなく exitCode に反映する
			exitCode = exitErr.ExitCode()
			err = nil
		} else {
			// コマンド未発見などシステムエラーはそのまま返す
			return ExecuteResult{}, err
		}
	}

	return ExecuteResult{
		Stdout:   strings.TrimRight(stdoutBuf.String(), "\n"),
		Stderr:   strings.TrimRight(stderrBuf.String(), "\n"),
		ExitCode: exitCode,
	}, nil
}
