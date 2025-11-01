# frozen_string_literal: true

require 'open3'

# CommandExecutorクラス
# 外部コマンドの実行を抽象化する
class CommandExecutor
  # コマンドを実行する
  # @param command [String] 実行するコマンド
  # @param args [Array<String>] コマンドの引数
  # @param stdin_data [String] 標準入力に送るデータ
  # @return [Array] [stdout, stderr, status]
  def execute(command, *args, stdin_data: nil)
    Open3.capture3(command, *args, stdin_data:)
  rescue Errno::ENOENT
    raise
  end
end
