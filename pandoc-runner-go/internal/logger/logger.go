// Package logger はログ出力のインターフェースと実装を提供する。
package logger

import (
	"fmt"
	"os"
	"time"
)

// Logger はログ出力のインターフェース。
type Logger interface {
	Info(message string)
	Debug(message string)
	Warn(message string)
	Error(message string)
}

// Level はログレベルを表す。
type Level int

const (
	// LevelDebug は最も詳細なログレベル。
	LevelDebug Level = iota
	// LevelInfo は通常のログレベル。
	LevelInfo
	// LevelWarn は警告ログレベル。
	LevelWarn
	// LevelError はエラーログレベル。
	LevelError
)

// ParseLevel は文字列からログレベルを解析する。
// 不明な文字列の場合は LevelInfo を返す。
func ParseLevel(s string) Level {
	switch s {
	case "debug":
		return LevelDebug
	case "warn":
		return LevelWarn
	case "error":
		return LevelError
	default:
		return LevelInfo
	}
}

// DefaultLogger は Logger の標準実装。
// 全レベルのログを os.Stderr に出力する。
type DefaultLogger struct {
	// level は出力する最低ログレベル。これ未満のレベルは出力しない。
	level Level
}

// New は DefaultLogger を生成する。
func New(level Level) *DefaultLogger {
	return &DefaultLogger{level: level}
}

func (l *DefaultLogger) shouldLog(level Level) bool {
	return level >= l.level
}

func (l *DefaultLogger) formatMessage(level, message string) string {
	timestamp := time.Now().UTC().Format(time.RFC3339Nano)
	return fmt.Sprintf("[%s] %s: %s", timestamp, level, message)
}

// Debug はデバッグレベルのログを出力する。
func (l *DefaultLogger) Debug(message string) {
	if l.shouldLog(LevelDebug) {
		fmt.Fprintln(os.Stderr, l.formatMessage("DEBUG", message))
	}
}

// Info は情報レベルのログを出力する。
func (l *DefaultLogger) Info(message string) {
	if l.shouldLog(LevelInfo) {
		fmt.Fprintln(os.Stderr, l.formatMessage("INFO", message))
	}
}

// Warn は警告レベルのログを出力する。
func (l *DefaultLogger) Warn(message string) {
	if l.shouldLog(LevelWarn) {
		fmt.Fprintln(os.Stderr, l.formatMessage("WARN", message))
	}
}

// Error はエラーレベルのログを出力する。
func (l *DefaultLogger) Error(message string) {
	if l.shouldLog(LevelError) {
		fmt.Fprintln(os.Stderr, l.formatMessage("ERROR", message))
	}
}
