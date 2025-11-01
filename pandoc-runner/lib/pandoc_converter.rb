# frozen_string_literal: true

require_relative 'command_executor'

# PandocConverterクラス
# pandocコマンドを実行してmarkdownからredmine-textileに変換する
class PandocConverter
  class ConversionError < StandardError; end

  class DefaultFilterSelector
    # フィルターを返す。使わない場合はnilを返す
    def get_filter_path(_from_format, _to_format)
      nil
    end
  end

  def initialize(command_executor: CommandExecutor.new, filter_selector: DefaultFilterSelector)
    @command_executor = command_executor
    validate_pandoc_availability
  end

  # markdownからredmine-textileに変換する
  # @param markdown_text [String] 変換元のmarkdownテキスト
  # @return [String] 変換後のredmine-textileテキスト
  # @raise [ConversionError] 変換に失敗した場合
  def convert_markdown_to_redmine_textile(markdown_text)
    raise ArgumentError, 'markdown_text must be a string' unless markdown_text.is_a?(String)

    filter_arg = @filter_selector.get_filter_path('markdown', 'redmine-textile')
    command_args = ['pandoc', '-f', 'markdown', '-t', 'textile']
    command_args += ['--filter', filter_arg] if filter_arg

    stdout, stderr, status = @command_executor.execute(
      *command_args,
      stdin_data: markdown_text
    )

    raise ConversionError, "Pandoc conversion failed: #{stderr}" unless status.success?

    stdout
  rescue Errno::ENOENT
    raise ConversionError, 'pandoc command not found'
  end

  private

  # pandocコマンドが利用可能かチェック
  def validate_pandoc_availability
    _, _, status = @command_executor.execute('pandoc', '--version')
    raise ConversionError, 'pandoc command not available' unless status.success?
  rescue Errno::ENOENT
    raise ConversionError, 'pandoc command not found'
  end
end
