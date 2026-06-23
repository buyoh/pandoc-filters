// Package server は Unix ソケットサーバーと pandoc-runner サーバーを提供する。
package server

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"os"
	"strings"
	"sync"

	"pandoc-runner-go/internal/logger"
)

// UnixSocketServer は Unix ドメインソケット経由でリクエストを受け付けるサーバー。
type UnixSocketServer struct {
	// socketPath はソケットファイルのパス。
	socketPath string
	// log はログ出力に使用するロガー。
	log logger.Logger
	// listener は Accept ループに使用するリスナー。nilの場合は未起動。
	listener net.Listener
	// cancel は全接続 goroutine へキャンセルを伝播する関数。
	cancel context.CancelFunc
	// wg は接続中の goroutine の終了を待つための WaitGroup。
	wg sync.WaitGroup
}

// NewUnixSocketServer は UnixSocketServer を生成する。
func NewUnixSocketServer(socketPath string, log logger.Logger) *UnixSocketServer {
	return &UnixSocketServer{
		socketPath: socketPath,
		log:        log,
	}
}

// Start はサーバーを起動し、handler に接続ごとのリクエスト文字列を渡してレスポンスを送信する。
// handler は 1 つのリクエスト JSON 文字列を受け取り、レスポンス JSON 文字列を返す関数。
// Start はリスナーを起動した後、Accept ループを別 goroutine で実行してすぐに返る。
func (s *UnixSocketServer) Start(handler func(string) string) error {
	if err := s.cleanupSocket(); err != nil {
		return fmt.Errorf("failed to cleanup socket: %w", err)
	}

	l, err := net.Listen("unix", s.socketPath)
	if err != nil {
		return fmt.Errorf("failed to listen on %s: %w", s.socketPath, err)
	}
	s.listener = l

	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	go s.acceptLoop(ctx, handler)

	s.log.Info("UnixSocket server started at " + s.socketPath)
	return nil
}

// Stop はサーバーを停止し、全接続処理の終了を待機する。
func (s *UnixSocketServer) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	if s.listener != nil {
		s.listener.Close()
	}
	s.wg.Wait()
	s.cleanupSocket() //nolint:errcheck
	s.log.Info("UnixSocket server stopped")
}

// acceptLoop は新規接続を受け付けるループ。
func (s *UnixSocketServer) acceptLoop(ctx context.Context, handler func(string) string) {
	for {
		conn, err := s.listener.Accept()
		if err != nil {
			// context キャンセルまたは listener.Close() による停止
			select {
			case <-ctx.Done():
				return
			default:
				// Accept エラー（接続失敗など）はログに記録して継続
				s.log.Error("Accept error: " + err.Error())
				return
			}
		}
		s.wg.Add(1)
		go func(c net.Conn) {
			defer s.wg.Done()
			defer c.Close()
			s.handleConn(ctx, c, handler)
		}(conn)
	}
}

// handleConn は 1 つの接続を処理する。
// 改行区切りの JSON リクエストを読み取り、レスポンスを書き込む。
func (s *UnixSocketServer) handleConn(ctx context.Context, conn net.Conn, handler func(string) string) {
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return
		default:
		}

		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		s.log.Debug("Received request: " + line)
		response := handler(line)
		_, err := fmt.Fprintln(conn, response)
		if err != nil {
			s.log.Error("Failed to write response: " + err.Error())
			return
		}
		s.log.Debug("Sent response: " + response)
	}
	// Scan が false を返した場合のエラーを確認
	if err := scanner.Err(); err != nil {
		s.log.Error("Scanner error: " + err.Error())
	}
}

// cleanupSocket はソケットファイルを削除する。
// ファイルが存在しない場合は無視する。それ以外のエラーは返す。
func (s *UnixSocketServer) cleanupSocket() error {
	err := os.Remove(s.socketPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
