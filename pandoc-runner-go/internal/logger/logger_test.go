package logger

import (
	"strings"
	"testing"
)

// captureLogger はテスト用のロガー。ログメッセージをメモリ上に蓄積する。
type captureLogger struct {
	messages []string
}

func newCaptureLogger() *captureLogger {
	return &captureLogger{}
}

func (c *captureLogger) Info(message string)  { c.messages = append(c.messages, "INFO: "+message) }
func (c *captureLogger) Debug(message string) { c.messages = append(c.messages, "DEBUG: "+message) }
func (c *captureLogger) Warn(message string)  { c.messages = append(c.messages, "WARN: "+message) }
func (c *captureLogger) Error(message string) { c.messages = append(c.messages, "ERROR: "+message) }

func TestParseLevelDefault(t *testing.T) {
	if ParseLevel("unknown") != LevelInfo {
		t.Error("unknown level should default to LevelInfo")
	}
}

func TestParseLevelDebug(t *testing.T) {
	if ParseLevel("debug") != LevelDebug {
		t.Error("expected LevelDebug")
	}
}

func TestParseLevelWarn(t *testing.T) {
	if ParseLevel("warn") != LevelWarn {
		t.Error("expected LevelWarn")
	}
}

func TestParseLevelError(t *testing.T) {
	if ParseLevel("error") != LevelError {
		t.Error("expected LevelError")
	}
}

func TestDefaultLoggerDebugLevelFiltering(t *testing.T) {
	// info レベルのロガーは debug を出力しない
	// ここでは formatMessage の出力形式をテストする
	l := New(LevelInfo)
	msg := l.formatMessage("INFO", "test message")
	if !strings.Contains(msg, "INFO") {
		t.Errorf("expected INFO in message, got: %s", msg)
	}
	if !strings.Contains(msg, "test message") {
		t.Errorf("expected message content, got: %s", msg)
	}
	// タイムスタンプが含まれること（Z で終わる UTC 形式）
	if !strings.Contains(msg, "Z") {
		t.Errorf("expected UTC timestamp with Z suffix, got: %s", msg)
	}
}

func TestDefaultLoggerShouldLog(t *testing.T) {
	tests := []struct {
		loggerLevel Level
		msgLevel    Level
		expected    bool
	}{
		{LevelDebug, LevelDebug, true},
		{LevelDebug, LevelInfo, true},
		{LevelInfo, LevelDebug, false},
		{LevelInfo, LevelInfo, true},
		{LevelWarn, LevelInfo, false},
		{LevelWarn, LevelWarn, true},
		{LevelError, LevelWarn, false},
		{LevelError, LevelError, true},
	}

	for _, tt := range tests {
		l := New(tt.loggerLevel)
		got := l.shouldLog(tt.msgLevel)
		if got != tt.expected {
			t.Errorf("loggerLevel=%d, msgLevel=%d: expected %v, got %v",
				tt.loggerLevel, tt.msgLevel, tt.expected, got)
		}
	}
}

func TestCaptureLoggerInterface(t *testing.T) {
	// captureLogger が Logger インターフェースを満たすことを確認
	var _ Logger = newCaptureLogger()
}
