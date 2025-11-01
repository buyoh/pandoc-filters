# frozen_string_literal: true

require 'minitest/autorun'
require 'socket'
require 'json'
require_relative '../lib/unix_socket_server'

class UnixSocketServerTest < Minitest::Test
  def setup
    @test_socket_path = '/tmp/test_pandoc_runner.sock'
    @server = UnixSocketServer.new(socket_path: @test_socket_path)
  end

  def teardown
    @server.stop if @server.running?
    File.unlink(@test_socket_path) if File.exist?(@test_socket_path)
  end

  def test_server_initialization
    refute @server.running?
    assert_equal @test_socket_path, @server.socket_path
  end

  def test_server_start_and_stop
    # バックグラウンドでサーバーを開始
    server_thread = Thread.new do
      @server.start do |_request|
        { message: 'response' }.to_json
      end
    end

    # サーバーが開始されるまで少し待つ
    sleep 0.1

    assert @server.running?

    @server.stop
    server_thread.join(1) # 1秒でタイムアウト

    refute @server.running?
  end

  def test_client_server_communication
    response_handler = proc do |request|
      request_data = JSON.parse(request)
      { echo: request_data['message'] }.to_json
    end

    # バックグラウンドでサーバーを開始
    server_thread = Thread.new do
      @server.start(&response_handler)
    end

    # サーバーが開始されるまで待つ
    sleep 0.1

    # クライアントから接続してリクエストを送信
    client = UNIXSocket.new(@test_socket_path)
    request = { message: 'test message' }.to_json
    client.puts(request)

    response = client.gets
    client.close

    # レスポンスを確認
    refute_nil response
    response_data = JSON.parse(response.strip)
    assert_equal 'test message', response_data['echo']

    @server.stop
    server_thread.join(1)
  end

  def test_socket_cleanup
    # ソケットファイルが存在しないことを確認
    refute File.exist?(@test_socket_path)

    server_thread = Thread.new do
      @server.start { |_request| 'response' }
    end

    sleep 0.1

    # ソケットファイルが作成されることを確認
    assert File.exist?(@test_socket_path)

    @server.stop
    server_thread.join(1)

    # ソケットファイルがクリーンアップされることを確認
    refute File.exist?(@test_socket_path)
  end

  def test_multiple_client_connections
    response_count = 0
    response_handler = proc do |_request|
      response_count += 1
      { count: response_count }.to_json
    end

    server_thread = Thread.new do
      @server.start(&response_handler)
    end

    sleep 0.1

    # 複数のクライアントから同時接続
    clients = []
    responses = []

    3.times do |i|
      clients << Thread.new do
        client = UNIXSocket.new(@test_socket_path)
        client.puts({ message: "test #{i}" }.to_json)
        response = client.gets
        client.close
        responses << JSON.parse(response.strip) if response
      end
    end

    clients.each(&:join)

    # 3つのレスポンスを受信したことを確認
    assert_equal 3, responses.length

    @server.stop
    server_thread.join(1)
  end
end
