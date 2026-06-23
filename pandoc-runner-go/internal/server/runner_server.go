// runner_server.go は pandoc-runner の全コンポーネントを統合するサーバー。
package server

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"pandoc-runner-go/internal/converter"
	"pandoc-runner-go/internal/executor"
	"pandoc-runner-go/internal/handler"
	"pandoc-runner-go/internal/logger"
)

const DefaultSocketPath = "/tmp/pandoc-runner.sock"

// PandocRunnerServer は pandoc-runner の全コンポーネントを統合するサーバー。
type PandocRunnerServer struct {
	// socketPath は Unix ソケットのパス。
	socketPath string
	// log はログ出力に使用するロガー。
	log logger.Logger
	// converter は pandoc 変換処理を担当する。
	converter *converter.PandocConverter
	// handler は JSON リクエスト処理を担当する。
	handler *handler.RequestHandler
	// socketServer は Unix ソケット通信を担当する。
	socketServer *UnixSocketServer
}

// NewPandocRunnerServer は PandocRunnerServer を生成する。
func NewPandocRunnerServer(socketPath string, log logger.Logger) *PandocRunnerServer {
	exec := executor.New()
	conv := converter.New(exec, nil)
	h := handler.New(conv)
	sock := NewUnixSocketServer(socketPath, log)

	return &PandocRunnerServer{
		socketPath:   socketPath,
		log:          log,
		converter:    conv,
		handler:      h,
		socketServer: sock,
	}
}

// Start はサーバーを起動し、SIGINT/SIGTERM を受信するまでブロックする。
// pandoc が利用不可能な場合はエラーを返す。
func (s *PandocRunnerServer) Start() error {
	s.log.Info("Starting Pandoc Runner Server...")

	// pandoc の存在確認
	if err := s.converter.ValidatePandocAvailability(); err != nil {
		return fmt.Errorf("pandoc not available: %w", err)
	}

	// ソケットサーバー起動
	if err := s.socketServer.Start(s.handler.HandleRequest); err != nil {
		return fmt.Errorf("failed to start socket server: %w", err)
	}

	s.log.Info("Pandoc Runner Server started")

	// シグナルを待機
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	s.log.Info(fmt.Sprintf("Received signal: %v", sig))

	s.Stop()
	return nil
}

// Stop はサーバーを停止する。
func (s *PandocRunnerServer) Stop() {
	s.log.Info("Stopping Pandoc Runner Server...")
	s.socketServer.Stop()
}
