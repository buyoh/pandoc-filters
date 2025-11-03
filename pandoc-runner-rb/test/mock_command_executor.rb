# frozen_string_literal: true

# MockCommandExecutorクラス
# テスト用のCommandExecutorのモック実装
class MockCommandExecutor
  def initialize
    @commands = []
    @responses = {}
    @default_response = ['', '', mock_status(true)]
  end

  # コマンドの実行をモックする
  def execute(command, *args, stdin_data: nil)
    full_command = [command, *args].join(' ')
    @commands << { command: full_command, stdin_data: }

    @responses[full_command] || @default_response
  end

  # 特定のコマンドに対するレスポンスを設定
  def set_response(command, stdout, stderr, success)
    @responses[command] = [stdout, stderr, mock_status(success)]
  end

  # 実行されたコマンドの履歴を取得
  def executed_commands
    @commands
  end

  # コマンドが実行されたかチェック
  def command_executed?(command)
    @commands.any? { |cmd| cmd[:command].include?(command) }
  end

  # 最後に実行されたコマンドの標準入力データを取得
  def last_stdin_data
    @commands.last&.dig(:stdin_data)
  end

  private

  # モックのステータスオブジェクトを作成
  def mock_status(success)
    status = Object.new
    status.define_singleton_method(:success?) { success }
    status
  end
end
