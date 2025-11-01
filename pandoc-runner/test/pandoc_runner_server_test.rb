# frozen_string_literal: true

require 'minitest/autorun'
require 'json'
require_relative '../pandoc-runner'
require_relative 'mock_command_executor'
require_relative 'mock_socket_server'

class PandocRunnerServerTest < Minitest::Test
  def setup
    @test_socket_path = '/tmp/test_pandoc_runner.sock'
    @mock_executor = MockCommandExecutor.new
    @mock_executor.set_response('pandoc --version', 'pandoc 2.19.2', '', true)
    @mock_socket_server = MockSocketServer.new(
      socket_path: @test_socket_path,
      logger: Logger.new($stdout, level: Logger::WARN)
    )
  end

  def teardown
    @mock_socket_server.stop if @mock_socket_server.running?
  end

  def test_server_ping_integration
    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor,
      socket_server: @mock_socket_server
    )

    # バックグラウンドでサーバーを開始
    server_thread = Thread.new do
      server.start
    end

    # サーバーが開始されるまで待つ
    sleep 0.02

    begin
      # pingリクエストを送信
      client = @mock_socket_server.create_mock_client
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
      server_thread.join(0.1)
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
      command_executor: @mock_executor,
      socket_server: @mock_socket_server
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.02

    begin
      # 変換リクエストを送信
      client = @mock_socket_server.create_mock_client
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
      server_thread.join(0.1)
    end
  end

  def test_server_error_handling_integration
    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor,
      socket_server: @mock_socket_server
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.02

    begin
      # 無効なリクエストを送信
      client = @mock_socket_server.create_mock_client
      client.puts('invalid json')

      response = client.gets
      client.close

      # エラーレスポンスを確認
      response_data = JSON.parse(response)
      refute response_data['success']
      assert_equal 'INVALID_JSON', response_data['error']['code']
    ensure
      server.stop
      server_thread.join(0.1)
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
      command_executor: @mock_executor,
      socket_server: @mock_socket_server
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.02

    begin
      # 複数の同時リクエストを送信
      client_threads = []
      responses = []

      5.times do |i|
        client_threads << Thread.new do
          client = @mock_socket_server.create_mock_client
          request = {
            action: 'convert',
            from: 'markdown',
            to: 'redmine-textile',
            content: "# Header #{i}\n\nContent #{i}"
          }.to_json

          client.puts(request)
          response = client.gets
          client.close

          responses << JSON.parse(response) if response
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
      server_thread.join(0.1)
    end
  end

  def test_performance_comparison
    # 性能テスト（時間測定）
    start_time = Time.now

    server = PandocRunnerServer.new(
      socket_path: @test_socket_path,
      log_level: Logger::WARN,
      command_executor: @mock_executor,
      socket_server: @mock_socket_server
    )

    server_thread = Thread.new do
      server.start
    end

    sleep 0.02

    begin
      # 10回のpingリクエスト
      10.times do
        client = @mock_socket_server.create_mock_client
        request = { action: 'ping' }.to_json
        client.puts(request)
        response = client.gets
        client.close

        response_data = JSON.parse(response)
        assert response_data['success']
      end
    ensure
      server.stop
      server_thread.join(0.1)
    end

    end_time = Time.now
    duration = end_time - start_time

    # MockSocketServerを使用すると、実際のUnixSocketより高速になることを確認
    assert duration < 1.0, "Test took too long: #{duration} seconds"
    puts "Fast test completed in #{duration.round(3)} seconds"
  end
end
