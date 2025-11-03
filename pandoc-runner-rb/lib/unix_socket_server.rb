# frozen_string_literal: true

require 'socket'
require 'logger'

# UnixSocketServerクラス
# Unixソケット経由での通信を管理する
class UnixSocketServer
  DEFAULT_SOCKET_PATH = '/tmp/pandoc-runner.sock'

  attr_reader :socket_path, :logger

  def initialize(socket_path: DEFAULT_SOCKET_PATH, logger: nil)
    @socket_path = socket_path
    @logger = logger || Logger.new($stdout)
    @server = nil
    @running = false
  end

  # サーバーを開始する
  def start(&block)
    cleanup_socket
    @server = UNIXServer.new(@socket_path)
    @running = true

    @logger.info("UnixSocket server started at #{@socket_path}")

    accept_connections(&block)
  ensure
    stop
  end

  # サーバーを停止する
  def stop
    return unless @running

    @running = false
    @server&.close
    cleanup_socket

    @logger.info('UnixSocket server stopped')
  end

  # サーバーが実行中かどうか
  def running?
    @running
  end

  private

  # 接続を受け入れる
  def accept_connections(&block)
    while @running
      begin
        ready = IO.select([@server], nil, nil, 1)
        next unless ready

        client = @server.accept
        handle_client(client, &block)
      rescue StandardError => e
        @logger.error("Error in accept_connections: #{e.message}")
        @logger.error(e.backtrace)
      end
    end
  end

  # クライアントからの接続を処理する
  # @param client [UNIXSocket] クライアントソケット
  def handle_client(client, &block)
    Thread.new do
      request_line = client.gets
      return unless request_line

      request_line = request_line.strip
      @logger.debug("Received request: #{request_line}")

      response = block.call(request_line) if block

      if response
        client.puts(response)
        @logger.debug("Sent response: #{response}")
      end
    rescue StandardError => e
      @logger.error("Error handling client: #{e.message}")
      error_response = { error: e.message }.to_json
      client.puts(error_response)
    ensure
      client.close
    end
  end

  # ソケットファイルをクリーンアップする
  def cleanup_socket
    File.unlink(@socket_path) if File.exist?(@socket_path)
  rescue StandardError => e
    @logger.warn("Failed to cleanup socket: #{e.message}")
  end
end
