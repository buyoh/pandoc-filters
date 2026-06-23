// unix_socket_test.go は Unit-Real テスト（実際のソケット通信を使用）
package server

import (
	"fmt"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"pandoc-runner-go/internal/logger"
)

// noopLogger はテスト用のログ出力なしロガー。
type noopLogger struct{}

func (n *noopLogger) Info(msg string)  {}
func (n *noopLogger) Debug(msg string) {}
func (n *noopLogger) Warn(msg string)  {}
func (n *noopLogger) Error(msg string) {}

func tempSocketPath(t *testing.T) string {
	t.Helper()
	return fmt.Sprintf("/tmp/pandoc-runner-test-%d.sock", time.Now().UnixNano())
}

func TestUnixSocketServer_StartStop(t *testing.T) {
	socketPath := tempSocketPath(t)
	defer os.Remove(socketPath)

	s := NewUnixSocketServer(socketPath, &noopLogger{})
	if err := s.Start(func(req string) string { return `{"success":true}` }); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	defer s.Stop()

	// ソケットファイルが作成されていること
	if _, err := os.Stat(socketPath); err != nil {
		t.Errorf("socket file should exist: %v", err)
	}
}

func TestUnixSocketServer_RequestResponse(t *testing.T) {
	socketPath := tempSocketPath(t)
	defer os.Remove(socketPath)

	handler := func(req string) string {
		return `{"success":true,"data":{"message":"pong"}}`
	}

	s := NewUnixSocketServer(socketPath, &noopLogger{})
	if err := s.Start(handler); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	defer s.Stop()

	// サーバーが起動するまで少し待機
	time.Sleep(10 * time.Millisecond)

	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	fmt.Fprintln(conn, `{"action":"ping"}`)

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	buf := make([]byte, 1024)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("Failed to read response: %v", err)
	}

	response := strings.TrimSpace(string(buf[:n]))
	if !strings.Contains(response, `"success":true`) {
		t.Errorf("unexpected response: %s", response)
	}
}

func TestUnixSocketServer_ExistingSocketCleanup(t *testing.T) {
	socketPath := tempSocketPath(t)
	defer os.Remove(socketPath)

	// 先にダミーファイルを作成
	f, err := os.Create(socketPath)
	if err != nil {
		t.Fatalf("failed to create dummy socket file: %v", err)
	}
	f.Close()

	s := NewUnixSocketServer(socketPath, &noopLogger{})
	if err := s.Start(func(req string) string { return "" }); err != nil {
		t.Fatalf("Start should succeed even if socket file exists: %v", err)
	}
	s.Stop()
}

func TestUnixSocketServer_MultipleRequests(t *testing.T) {
	socketPath := tempSocketPath(t)
	defer os.Remove(socketPath)

	callCount := 0
	handler := func(req string) string {
		callCount++
		return fmt.Sprintf(`{"n":%d}`, callCount)
	}

	s := NewUnixSocketServer(socketPath, &noopLogger{})
	if err := s.Start(handler); err != nil {
		t.Fatalf("Start failed: %v", err)
	}
	defer s.Stop()

	time.Sleep(10 * time.Millisecond)

	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close()

	for i := 0; i < 3; i++ {
		fmt.Fprintln(conn, `{"action":"ping"}`)
		conn.SetReadDeadline(time.Now().Add(2 * time.Second))
		buf := make([]byte, 1024)
		_, err := conn.Read(buf)
		if err != nil {
			t.Fatalf("Failed to read response %d: %v", i, err)
		}
	}

	if callCount != 3 {
		t.Errorf("expected handler called 3 times, got %d", callCount)
	}
}

// TestNoopLoggerInterface は noopLogger が logger.Logger を満たすことを確認する。
func TestNoopLoggerInterface(t *testing.T) {
	var _ logger.Logger = &noopLogger{}
}
