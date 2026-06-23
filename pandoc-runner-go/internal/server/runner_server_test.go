// runner_server_test.go は Unit-Real テスト（実際のソケット通信と実pandocを使用しない統合テスト）
package server

import (
	"encoding/json"
	"fmt"
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"pandoc-runner-go/internal/converter"
	"pandoc-runner-go/internal/executor"
	"pandoc-runner-go/internal/handler"
	"pandoc-runner-go/internal/logger"
)

// stubConverterForServer はサーバーテスト用の PandocConverter スタブ。
type stubConverterForServer struct {
	result string
	err    error
}

func (s *stubConverterForServer) ConvertMarkdownToRedmineTextile(text string) (string, error) {
	return s.result, s.err
}

// StubCommandExecutorForServer はサーバーテスト用の CommandExecutor スタブ。
type StubCommandExecutorForServer struct {
	result executor.ExecuteResult
	err    error
}

func (s *StubCommandExecutorForServer) Execute(command string, args []string, stdin string) (executor.ExecuteResult, error) {
	return s.result, s.err
}

// newTestServer はテスト用のサーバーを生成して起動する。
// converter にスタブを使用することで pandoc への依存を排除する。
func newTestServer(t *testing.T, socketPath string, stubExec executor.CommandExecutor) (*UnixSocketServer, func()) {
	t.Helper()
	log := &noopLogger{}
	conv := converter.New(stubExec, nil)
	h := handler.New(conv)
	sock := NewUnixSocketServer(socketPath, log)
	if err := sock.Start(h.HandleRequest); err != nil {
		t.Fatalf("failed to start test server: %v", err)
	}
	time.Sleep(10 * time.Millisecond)
	return sock, func() { sock.Stop() }
}

func TestPandocRunnerServer_PingRequest(t *testing.T) {
	socketPath := fmt.Sprintf("/tmp/pandoc-runner-srv-test-%d.sock", time.Now().UnixNano())
	defer os.Remove(socketPath)

	// ValidatePandocAvailability 用（exit 0）
	stub := &StubCommandExecutorForServer{result: executor.ExecuteResult{Stdout: "pandoc 3.0", ExitCode: 0}}
	_, cleanup := newTestServer(t, socketPath, stub)
	defer cleanup()

	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	fmt.Fprintln(conn, `{"action":"ping"}`)
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("failed to read: %v", err)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(buf[:n], &resp); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}
	if resp["success"] != true {
		t.Errorf("expected success=true, got %v", resp["success"])
	}
	data, _ := resp["data"].(map[string]interface{})
	if data["message"] != "pong" {
		t.Errorf("expected pong, got %v", data["message"])
	}
}

func TestPandocRunnerServer_ConvertRequest(t *testing.T) {
	socketPath := fmt.Sprintf("/tmp/pandoc-runner-srv-test-%d.sock", time.Now().UnixNano())
	defer os.Remove(socketPath)

	stub := &StubCommandExecutorForServer{
		result: executor.ExecuteResult{Stdout: "h1. Hello", ExitCode: 0},
	}
	_, cleanup := newTestServer(t, socketPath, stub)
	defer cleanup()

	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	defer conn.Close()

	fmt.Fprintln(conn, `{"action":"convert","from":"markdown","to":"redmine-textile","content":"# Hello"}`)
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))

	buf := make([]byte, 4096)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("failed to read: %v", err)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(buf[:n], &resp); err != nil {
		t.Fatalf("invalid JSON response: %v (raw: %s)", err, strings.TrimSpace(string(buf[:n])))
	}
	if resp["success"] != true {
		t.Errorf("expected success=true, got %v (raw: %s)", resp["success"], strings.TrimSpace(string(buf[:n])))
	}
}

func TestNewPandocRunnerServer_DefaultSocketPath(t *testing.T) {
	log := logger.New(logger.LevelInfo)
	srv := NewPandocRunnerServer(DefaultSocketPath, log)
	if srv.socketPath != DefaultSocketPath {
		t.Errorf("expected socket path %q, got %q", DefaultSocketPath, srv.socketPath)
	}
}
