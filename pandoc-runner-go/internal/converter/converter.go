// Package converter は pandoc コマンドを使用した変換処理を提供する。
package converter

import (
	"fmt"
	"os"
	"path/filepath"

	"pandoc-runner-go/internal/executor"
	"pandoc-runner-go/internal/types"
)

// resolvePandocPath は使用する pandoc コマンドのパスを返す。
// 環境変数 PF_PANDOC_PATH が設定されている場合はそれを使用する。
func resolvePandocPath() string {
	if path := os.Getenv("PF_PANDOC_PATH"); path != "" {
		return path
	}
	return "pandoc"
}

// FilterSelector は変換に使用するフィルターのパスを提供するインターフェース。
type FilterSelector interface {
	// GetFilterPath は指定した変換に対応するフィルターのパスを返す。
	// フィルターが不要な場合は ("", false) を返す。
	GetFilterPath(fromFormat, toFormat string) (string, bool)
}

// DefaultFilterSelector は FilterSelector の標準実装。
type DefaultFilterSelector struct{}

// GetFilterPath は変換形式に対応するフィルターパスを返す。
func (f *DefaultFilterSelector) GetFilterPath(fromFormat, toFormat string) (string, bool) {
	if fromFormat == "markdown" && toFormat == "redmine-textile" {
		// 実行バイナリの位置から相対パスでフィルターを解決する
		execPath, err := os.Executable()
		if err != nil {
			// バイナリパスが取得できない場合はフォールバック
			return "../dist/src/ToRedmine.js", true
		}
		execDir := filepath.Dir(execPath)
		return filepath.Join(execDir, "../../dist/src/ToRedmine.js"), true
	}
	return "", false
}

// PandocConverter は pandoc コマンドを呼び出して変換を行う。
type PandocConverter struct {
	// executor は外部コマンドの実行を担当する。
	executor executor.CommandExecutor
	// filterSelector は変換フィルターのパスを提供する。
	filterSelector FilterSelector
}

// New は PandocConverter を生成する。
func New(exec executor.CommandExecutor, selector FilterSelector) *PandocConverter {
	if exec == nil {
		exec = executor.New()
	}
	if selector == nil {
		selector = &DefaultFilterSelector{}
	}
	return &PandocConverter{
		executor:       exec,
		filterSelector: selector,
	}
}

// ValidatePandocAvailability は pandoc コマンドが利用可能かを確認する。
// 利用できない場合は *types.ConversionError を返す。
func (c *PandocConverter) ValidatePandocAvailability() error {
	result, err := c.executor.Execute(resolvePandocPath(), []string{"--version"}, "")
	if err != nil {
		return &types.ConversionError{Message: "pandoc command not found"}
	}
	if result.ExitCode != 0 {
		return &types.ConversionError{Message: "pandoc command not available"}
	}
	return nil
}

// ConvertMarkdownToRedmineTextile は markdown テキストを redmine-textile 形式に変換する。
// 変換失敗の場合は *types.ConversionError を返す。
// pandoc コマンドが見つからない場合も *types.ConversionError を返す。
func (c *PandocConverter) ConvertMarkdownToRedmineTextile(markdownText string) (string, error) {
	pandocPath := resolvePandocPath()
	args := []string{"-f", "markdown", "-t", "textile"}

	if filterPath, ok := c.filterSelector.GetFilterPath("markdown", "redmine-textile"); ok {
		args = append(args, "--filter", filterPath)
	}

	result, err := c.executor.Execute(pandocPath, args, markdownText)
	if err != nil {
		// コマンド未発見などのシステムエラー
		return "", &types.ConversionError{Message: fmt.Sprintf("pandoc command not found: %v", err)}
	}

	if result.ExitCode != 0 {
		return "", &types.ConversionError{
			Message: fmt.Sprintf("Pandoc conversion failed: %s", result.Stderr),
		}
	}

	return result.Stdout, nil
}
