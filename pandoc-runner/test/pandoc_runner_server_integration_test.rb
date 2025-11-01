# frozen_string_literal: true

require 'minitest/autorun'
require 'socket'
require 'json'
require_relative '../pandoc-runner'
require_relative 'mock_command_executor'

class PandocRunnerServerTest < Minitest::Test
  def setup
    @test_socket_path = '/tmp/test_pandoc_runner_integration.sock'
    @mock_executor = MockCommandExecutor.new
    @mock_executor.set_response('pandoc --version', 'pandoc 2.19.2', '', true)
  end

  def teardown
    File.unlink(@test_socket_path) if File.exist?(@test_socket_path)
  end

  def test_server_ping_integration
    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor
    )

    # バックグラウンドでサーバーを開始
    server_thread = Thread.new do
      server.start
    end

    # サーバーが開始されるまで待つ
    sleep 0.2

    begin
      # pingリクエストを送信
      client = UNIXSocket.new(@test_socket_path)
      request = { action: 'ping' }.to_json
      client.puts(request)

      response = client.gets
      client.close

      # レスポンスを確認
      response_data = JSON.parse(response)
      assert response_data['success']
      assert_equal 'pong', response_data['data']['message']
    ensure
      server.stop
      server_thread.join(1)
    end
  end

  def test_server_convert_integration
    # 変換レスポンスを設定
    @mock_executor.set_response(
      'pandoc -f markdown -t textile',
      'h1. Test Header\n\nThis is *bold* text with a "link":http://example.com.',
      '',
      true
    )

    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.2

    begin
      # 変換リクエストを送信
      client = UNIXSocket.new(@test_socket_path)
      request = {
        action: 'convert',
        from: 'markdown',
        to: 'redmine-textile',
        content: '# Test Header\n\nThis is **bold** text with a [link](http://example.com).'
      }.to_json

      client.puts(request)
      response = client.gets
      client.close

      # レスポンスを確認
      response_data = JSON.parse(response)
      assert response_data['success']

      result = response_data['data']['result']
      assert_kind_of String, result
      refute_empty result

      # textile形式の確認
      assert_includes result, 'h1. Test Header'
      assert_includes result, '*bold*'
      assert_includes result, '"link":http://example.com'
    ensure
      server.stop
      server_thread.join(1)
    end
  end

  def test_server_error_handling_integration
    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.2

    begin
      # 無効なリクエストを送信
      client = UNIXSocket.new(@test_socket_path)
      client.puts('invalid json')

      response = client.gets
      client.close

      # エラーレスポンスを確認
      response_data = JSON.parse(response)
      refute response_data['success']
      assert_equal 'INVALID_JSON', response_data['error']['code']
    ensure
      server.stop
      server_thread.join(1)
    end
  end

  def test_multiple_concurrent_requests
    # 複数の変換レスポンスを設定
    @mock_executor.set_response(
      'pandoc -f markdown -t textile',
      'h1. Header\n\nContent',
      '',
      true
    )

    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.2

    begin
      # 複数の同時リクエストを送信
      client_threads = []
      responses = []

      5.times do |i|
        client_threads << Thread.new do
          client = UNIXSocket.new(@test_socket_path)
          request = {
            action: 'convert',
            from: 'markdown',
            to: 'redmine-textile',
            content: "# Header #{i}\n\nContent #{i}"
          }.to_json

          client.puts(request)
          response = client.gets
          client.close

          responses << JSON.parse(response)
        end
      end

      client_threads.each(&:join)

      # すべてのレスポンスが成功していることを確認
      assert_equal 5, responses.length
      responses.each do |response|
        assert response['success']
        assert response['data']['result']
      end
    ensure
      server.stop
      server_thread.join(1)
    end
  end
end
