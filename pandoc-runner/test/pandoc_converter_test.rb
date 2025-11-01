# frozen_string_literal: true

require 'minitest/autorun'
require_relative '../lib/pandoc_converter'
require_relative 'mock_command_executor'

class PandocConverterTest < Minitest::Test
  def setup
    @mock_executor = MockCommandExecutor.new
    # pandoc --version コマンドを成功させる
    @mock_executor.set_response('pandoc --version', 'pandoc 2.19.2', '', true)
    @converter = PandocConverter.new(command_executor: @mock_executor)
  end

  def test_convert_markdown_to_redmine_textile_success
    # pandoc変換コマンドのレスポンスを設定
    @mock_executor.set_response(
      'pandoc -f markdown -t textile',
      'h1. Hello World\n\nThis is a *bold* text.',
      '',
      true
    )

    markdown = "# Hello World\n\nThis is a **bold** text."
    result = @converter.convert_markdown_to_redmine_textile(markdown)

    assert_equal 'h1. Hello World\n\nThis is a *bold* text.', result
    assert @mock_executor.command_executed?('pandoc -f markdown -t textile')
    assert_equal markdown, @mock_executor.last_stdin_data
  end

  def test_convert_markdown_to_redmine_textile_empty_string
    @mock_executor.set_response('pandoc -f markdown -t textile', '', '', true)

    result = @converter.convert_markdown_to_redmine_textile('')
    assert_equal '', result
    assert_equal '', @mock_executor.last_stdin_data
  end

  def test_convert_markdown_to_redmine_textile_conversion_error
    # pandocコマンドが失敗する場合
    @mock_executor.set_response(
      'pandoc -f markdown -t textile',
      '',
      'pandoc: error parsing',
      false
    )

    assert_raises PandocConverter::ConversionError do
      @converter.convert_markdown_to_redmine_textile('invalid markdown')
    end
  end

  def test_convert_markdown_to_redmine_textile_invalid_input
    assert_raises ArgumentError do
      @converter.convert_markdown_to_redmine_textile(nil)
    end

    assert_raises ArgumentError do
      @converter.convert_markdown_to_redmine_textile(123)
    end
  end

  def test_pandoc_not_available_during_initialization
    mock_executor = MockCommandExecutor.new
    # pandoc --versionを失敗させる
    mock_executor.set_response('pandoc --version', '', 'command not found', false)

    assert_raises PandocConverter::ConversionError do
      PandocConverter.new(command_executor: mock_executor)
    end
  end

  def test_pandoc_command_not_found_during_conversion
    # Errno::ENOENTをシミュレート
    mock_executor = MockCommandExecutor.new
    mock_executor.set_response('pandoc --version', 'pandoc 2.19.2', '', true)

    # executeメソッドでErrno::ENOENTを発生させる
    def mock_executor.execute(command, *args, stdin_data: nil)
      raise Errno::ENOENT if command == 'pandoc' && args.include?('-f')

      super
    end

    converter = PandocConverter.new(command_executor: mock_executor)

    assert_raises PandocConverter::ConversionError do
      converter.convert_markdown_to_redmine_textile('test')
    end
  end
end
