// executor_test.go は Unit-Real テスト（実際のコマンドを実行する）
package executor

import (
	"strings"
	"testing"
)

func TestDefaultCommandExecutor_SimpleCommand(t *testing.T) {
	e := New()
	result, err := e.Execute("echo", []string{"hello"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", result.ExitCode)
	}
	if result.Stdout != "hello" {
		t.Errorf("expected stdout 'hello', got %q", result.Stdout)
	}
	if result.Stderr != "" {
		t.Errorf("expected empty stderr, got %q", result.Stderr)
	}
}

func TestDefaultCommandExecutor_StdinPipe(t *testing.T) {
	e := New()
	result, err := e.Execute("cat", []string{}, "test input")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", result.ExitCode)
	}
	if result.Stdout != "test input" {
		t.Errorf("expected stdout 'test input', got %q", result.Stdout)
	}
}

func TestDefaultCommandExecutor_CommandNotFound(t *testing.T) {
	e := New()
	_, err := e.Execute("nonexistent-command-xyz", []string{}, "")
	if err == nil {
		t.Error("expected error for nonexistent command, got nil")
	}
}

func TestDefaultCommandExecutor_CaptureStderr(t *testing.T) {
	e := New()
	result, err := e.Execute("sh", []string{"-c", "echo 'error message' >&2"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ExitCode != 0 {
		t.Errorf("expected exit code 0, got %d", result.ExitCode)
	}
	if !strings.Contains(result.Stderr, "error message") {
		t.Errorf("expected stderr to contain 'error message', got %q", result.Stderr)
	}
}

func TestDefaultCommandExecutor_NonZeroExitCode(t *testing.T) {
	e := New()
	result, err := e.Execute("sh", []string{"-c", "exit 2"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.ExitCode != 2 {
		t.Errorf("expected exit code 2, got %d", result.ExitCode)
	}
}

func TestDefaultCommandExecutor_TrimTrailingNewline(t *testing.T) {
	e := New()
	result, err := e.Execute("printf", []string{"line1\nline2\n"}, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 末尾の改行が除去されること
	if strings.HasSuffix(result.Stdout, "\n") {
		t.Errorf("stdout should not end with newline, got %q", result.Stdout)
	}
}
