#!/usr/bin/env ruby
# frozen_string_literal: true

require_relative 'lib/pandoc_converter'
require_relative 'lib/unix_socket_server'
require_relative 'lib/request_handler'
require 'logger'
require 'optparse'

class FilterSelector < PandocConverter::DefaultFilterSelector
  # フィルターを返す。使わない場合はnilを返す
  def get_filter_path(from_format, to_format)
    return unless from_format == 'markdown' && to_format == 'redmine-textile'

    File.expand_path('../dist/src/ToRedmine.js', __dir__) # TODO: adjust path as needed
  end
end

# Pandoc Runner Server
# Unixソケット経由でpandoc変換リクエストを処理するサーバー
class PandocRunnerServer
  DEFAULT_SOCKET_PATH = '/tmp/pandoc-runner.sock'
  DEFAULT_LOG_LEVEL = Logger::INFO

  def initialize(socket_path: DEFAULT_SOCKET_PATH, log_level: DEFAULT_LOG_LEVEL)
    @socket_path = socket_path
    @logger = Logger.new($stdout)
    @logger.level = log_level
    @logger.formatter = proc do |severity, datetime, _progname, msg|
      "[#{datetime}] #{severity}: #{msg}\n"
    end

    @converter = PandocConverter.new(filter_selector: FilterSelector.new)
    @request_handler = RequestHandler.new(@converter)
    @server = UnixSocketServer.new(socket_path: @socket_path, logger: @logger)
    @running = false
  end

  # サーバーを開始する
  def start
    @logger.info('Starting Pandoc Runner Server...')

    setup_signal_handlers

    @running = true

    # サーバーを開始し、リクエストハンドラーをブロックとして渡す
    @server.start do |request_line|
      @request_handler.handle_request(request_line)
    end
  rescue StandardError => e
    @logger.error("Server error: #{e.message}")
    @logger.error(e.backtrace)
    stop
  end

  # サーバーを停止する
  def stop
    return unless @running

    @logger.info('Stopping Pandoc Runner Server...')
    @running = false
    @server.stop
  end

  # サーバーが実行中かどうか
  def running?
    @running
  end

  private

  # シグナルハンドラーを設定する
  def setup_signal_handlers
    %w[INT TERM].each do |signal|
      Signal.trap(signal) do
        @logger.info("Received #{signal} signal")
        stop
        exit(0)
      end
    end
  end
end

# メイン実行部分
if __FILE__ == $PROGRAM_NAME
  options = {}

  OptionParser.new do |opts|
    opts.banner = 'Usage: pandoc-runner.rb [options]'

    opts.on('-s', '--socket PATH', 'Unix socket path (default: /tmp/pandoc-runner.sock)') do |path|
      options[:socket_path] = path
    end

    opts.on('-v', '--verbose', 'Verbose logging') do
      options[:log_level] = Logger::DEBUG
    end

    opts.on('-q', '--quiet', 'Quiet logging') do
      options[:log_level] = Logger::WARN
    end

    opts.on('-h', '--help', 'Show this help') do
      puts opts
      exit
    end
  end.parse!

  begin
    server = PandocRunnerServer.new(
      socket_path: options[:socket_path] || PandocRunnerServer::DEFAULT_SOCKET_PATH,
      log_level: options[:log_level] || PandocRunnerServer::DEFAULT_LOG_LEVEL
    )

    server.start
  rescue PandocConverter::ConversionError => e
    puts "Error: #{e.message}"
    puts 'Please make sure pandoc is installed and available in PATH'
    exit(1)
  rescue StandardError => e
    puts "Unexpected error: #{e.message}"
    exit(1)
  end
end
