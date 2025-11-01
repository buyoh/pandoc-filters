# frozen_string_literal: true

# MockPandocConverterクラス
# テスト用のPandocConverterのモック実装
class MockPandocConverter
  class ConversionError < StandardError; end

  def initialize
    @should_fail = false
    @error_message = 'Conversion failed'
  end

  # 変換を成功させるかどうかを設定
  def set_conversion_success(success, error_message = 'Conversion failed')
    @should_fail = !success
    @error_message = error_message
  end

  # markdownからredmine-textileに変換する（モック）
  def convert_markdown_to_redmine_textile(markdown_text)
    raise ArgumentError, 'markdown_text must be a string' unless markdown_text.is_a?(String)

    raise ConversionError, @error_message if @should_fail

    # 簡単な変換モック
    markdown_text.gsub(/^# (.+)/, 'h1. \1')
                 .gsub(/\*\*(.+?)\*\*/, '*\1*')
                 .gsub(/\[(.+?)\]\((.+?)\)/, '"\1":\2')
  end
end
