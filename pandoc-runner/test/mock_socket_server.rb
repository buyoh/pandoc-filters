# frozen_string_literal: true

require 'thread'
require 'json'
require 'logger'
require 'timeout'

# MockSocketServerクラス
# テスト用のUnixSocketServerのモック実装
# 実際のUnixSocketの代わりにメモリ上でクライアント-サーバー通信をシミュレート
class MockSocketServer
  def initialize(socket_path: nil, logger: nil)
    @socket_path = socket_path
    @logger = logger || Logger.new($stdout)
    @running = false
    @clients = []
    @server_thread = nil
    @request_handler = nil
  end

  # サーバーを開始する
  def start(&block)
    @running = true
    @request_handler = block
    @logger.info("Mock socket server started at #{@socket_path}")

    @server_thread = Thread.new do
      accept_connections
    end

    # サーバーが確実に開始されるまで少し待つ
    sleep 0.01
  end

  # サーバーを停止する
  def stop
    return unless @running

    @running = false
    @logger.info('Mock socket server stopped')

    # 残っているクライアントを全て閉じる
    @clients.each(&:close)
    @clients.clear

    # サーバースレッドの終了を待つ
    @server_thread&.join(0.1)
  end

  # サーバーが実行中かどうか
  def running?
    @running
  end

  # モッククライアントを作成
  def create_mock_client
    MockClient.new(self)
  end

  # 内部用：クライアントからのリクエストを処理
  def handle_client_request(client, request)
    return unless @running && @request_handler

    Thread.new do
      @logger.debug("Received request: #{request}")
      response = @request_handler.call(request)

      if response
        @logger.debug("Sent response: #{response}")
        client.receive_response(response)
      end
    rescue StandardError => e
      @logger.error("Error handling request: #{e.message}")
      error_response = { error: e.message }.to_json
      client.receive_response(error_response)
    end
  end

  # 内部用：クライアントを登録
  def register_client(client)
    @clients << client
  end

  # 内部用：クライアントの登録を解除
  def unregister_client(client)
    @clients.delete(client)
  end

  private

  # 接続を受け入れる（モック実装）
  def accept_connections
    while @running
      sleep 0.001 # CPU使用率を下げる
    end
  end
end

# モッククライアントクラス
class MockClient
  def initialize(server)
    @server = server
    @closed = false
    @response_queue = Queue.new
    @server.register_client(self)
  end

  def puts(data)
    raise 'Socket closed' if @closed

    # サーバーにリクエストを送信
    @server.handle_client_request(self, data.strip)
  end

  def gets
    raise 'Socket closed' if @closed

    # タイムアウト付きでレスポンスを待つ
    begin
      Timeout.timeout(1) do
        @response_queue.pop
      end
    rescue Timeout::Error
      nil
    end
  end

  def close
    return if @closed

    @closed = true
    @server.unregister_client(self)
  end

  def closed?
    @closed
  end

  # 内部用：サーバーからのレスポンスを受信
  def receive_response(response)
    @response_queue.push(response) unless @closed
  end
end
