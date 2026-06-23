// converter_test.go は Unit-Fake テスト（StubCommandExecutor を使用）
package converter

import (
	"testing"

	"pandoc-runner-go/internal/executor"
	"pandoc-runner-go/internal/types"
)

// StubCommandExecutor はテスト用の CommandExecutor スタブ。
type StubCommandExecutor struct {
	result executor.ExecuteResult
	err    error
}

func (s *StubCommandExecutor) Execute(command string, args []string, stdin string) (executor.ExecuteResult, error) {
	return s.result, s.err
}

// StubFilterSelector はテスト用の FilterSelector スタブ。
type StubFilterSelector struct {
	// path はフィルターパス。emptyの場合はフィルターなし。
	path string
}

func (s *StubFilterSelector) GetFilterPath(from, to string) (string, bool) {
	if s.path == "" {
		return "", false
	}
	return s.path, true
}

func TestValidatePandocAvailability_Success(t *testing.T) {
	stub := &StubCommandExecutor{
		result: executor.ExecuteResult{Stdout: "pandoc 3.0", Stderr: "", ExitCode: 0},
	}
	c := New(stub, &StubFilterSelector{})
	if err := c.ValidatePandocAvailability(); err != nil {
		t.Errorf("expected no error, got: %v", err)
	}
}

func TestValidatePandocAvailability_CommandFails(t *testing.T) {
	stub := &StubCommandExecutor{
		result: executor.ExecuteResult{Stdout: "", Stderr: "command not found", ExitCode: 1},
	}
	c := New(stub, &StubFilterSelector{})
	err := c.ValidatePandocAvailability()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(*types.ConversionError); !ok {
		t.Errorf("expected *ConversionError, got %T", err)
	}
}

func TestValidatePandocAvailability_CommandNotFound(t *testing.T) {
	stub := &StubCommandExecutor{
		err: &fakeExecError{msg: "exec: not found"},
	}
	c := New(stub, &StubFilterSelector{})
	err := c.ValidatePandocAvailability()
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(*types.ConversionError); !ok {
		t.Errorf("expected *ConversionError, got %T", err)
	}
}

func TestConvertMarkdownToRedmineTextile_Success(t *testing.T) {
	expectedOutput := "h1. Hello World"
	stub := &StubCommandExecutor{
		result: executor.ExecuteResult{Stdout: expectedOutput, Stderr: "", ExitCode: 0},
	}
	c := New(stub, &StubFilterSelector{})
	result, err := c.ConvertMarkdownToRedmineTextile("# Hello World")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != expectedOutput {
		t.Errorf("expected %q, got %q", expectedOutput, result)
	}
}

func TestConvertMarkdownToRedmineTextile_PandocFails(t *testing.T) {
	stub := &StubCommandExecutor{
		result: executor.ExecuteResult{Stdout: "", Stderr: "pandoc: error", ExitCode: 1},
	}
	c := New(stub, &StubFilterSelector{})
	_, err := c.ConvertMarkdownToRedmineTextile("# Hello")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(*types.ConversionError); !ok {
		t.Errorf("expected *ConversionError, got %T", err)
	}
}

func TestConvertMarkdownToRedmineTextile_CommandNotFound(t *testing.T) {
	stub := &StubCommandExecutor{
		err: &fakeExecError{msg: "exec: not found"},
	}
	c := New(stub, &StubFilterSelector{})
	_, err := c.ConvertMarkdownToRedmineTextile("# Hello")
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if _, ok := err.(*types.ConversionError); !ok {
		t.Errorf("expected *ConversionError, got %T", err)
	}
}

func TestDefaultFilterSelector_MarkdownToRedmineTextile(t *testing.T) {
	s := &DefaultFilterSelector{}
	path, ok := s.GetFilterPath("markdown", "redmine-textile")
	if !ok {
		t.Error("expected filter path to be returned")
	}
	if path == "" {
		t.Error("expected non-empty filter path")
	}
}

func TestDefaultFilterSelector_UnsupportedConversion(t *testing.T) {
	s := &DefaultFilterSelector{}
	_, ok := s.GetFilterPath("html", "markdown")
	if ok {
		t.Error("expected no filter path for unsupported conversion")
	}
}

// fakeExecError はテスト用のエラー型。
type fakeExecError struct {
	msg string
}

func (e *fakeExecError) Error() string { return e.msg }
