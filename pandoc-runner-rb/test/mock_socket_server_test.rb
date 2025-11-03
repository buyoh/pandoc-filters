# frozen_string_literal: true

require 'minitest/autorun'
require 'json'
require_relative 'mock_socket_server'

class MockSocketServerTest < Minitest::Test
  def setup
    @server = MockSocketServer.new(socket_path: '/tmp/mock_test.sock')
  end

  def teardown
    @server.stop if @server.running?
  end

  def test_server_initialization
    refute @server.running?
  end

  def test_server_start_and_stop
    response_handler = proc { |_request| 'test response' }

    @server.start(&response_handler)
    assert @server.running?

    @server.stop
    refute @server.running?
  end

  def test_mock_client_communication
    response_handler = proc do |request|
      request_data = JSON.parse(request)
      { echo: request_data['message'] }.to_json
    end

    @server.start(&response_handler)

    # サーバーが開始されるまで待つ
    sleep 0.01

    # モッククライアントでリクエストを送信
    client = @server.create_mock_client
    request = { message: 'test message' }.to_json

    client.puts(request)
    response = client.gets
    client.close

    # レスポンスを確認
    refute_nil response
    response_data = JSON.parse(response)
    assert_equal 'test message', response_data['echo']
  end

  def test_multiple_mock_clients
    response_count = 0
    response_handler = proc do |_request|
      response_count += 1
      { count: response_count }.to_json
    end

    @server.start(&response_handler)
    sleep 0.01

    clients = []
    responses = []

    # 複数のクライアントを作成
    3.times do |i|
      clients << Thread.new do
        client = @server.create_mock_client
        request = { message: "test #{i}" }.to_json

        client.puts(request)
        response = client.gets
        client.close
        responses << JSON.parse(response) if response
      end
    end

    clients.each(&:join)

    # 3つのレスポンスを受信したことを確認
    assert_equal 3, responses.length
    responses.each do |response|
      assert response['count']
      assert response['count'] > 0
    end
  end

  def test_server_handles_errors_gracefully
    error_handler = proc do |_request|
      raise StandardError, 'Test error'
    end

    @server.start(&error_handler)
    sleep 0.01

    client = @server.create_mock_client
    request = { message: 'test' }.to_json

    client.puts(request)
    response = client.gets
    client.close

    # エラーレスポンスを確認
    refute_nil response
    response_data = JSON.parse(response)
    assert response_data['error']
    assert_includes response_data['error'], 'Test error'
  end

  def test_client_operations_after_close
    @server.start { |_req| 'response' }
    sleep 0.01

    client = @server.create_mock_client
    client.close

    assert client.closed?

    # 閉じられたクライアントでの操作はエラーになる
    assert_raises(RuntimeError, 'Socket closed') do
      client.puts('test')
    end

    assert_raises(RuntimeError, 'Socket closed') do
      client.gets
    end
  end
end
