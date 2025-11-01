# frozen_string_literal: true

require 'json'
require 'time'

# RequestHandlerクラス
# JSONリクエストの解析と処理、レスポンスの生成を行う
class RequestHandler
  def initialize(converter)
    @converter = converter
  end

  # JSONリクエストを処理してJSONレスポンスを返す
  # @param request_json [String] JSONリクエスト文字列
  # @return [String] JSONレスポンス文字列
  def handle_request(request_json)
    request = parse_request(request_json)

    case request['action']
    when 'convert'
      handle_convert_request(request)
    when 'ping'
      handle_ping_request
    else
      create_error_response('Unknown action', 'UNKNOWN_ACTION')
    end
  rescue JSON::ParserError => e
    create_error_response("Invalid JSON: #{e.message}", 'INVALID_JSON')
  rescue StandardError => e
    create_error_response("Internal error: #{e.message}", 'INTERNAL_ERROR')
  end

  private

  # JSONリクエストを解析する
  # @param request_json [String] JSONリクエスト文字列
  # @return [Hash] 解析されたリクエスト
  def parse_request(request_json)
    request = JSON.parse(request_json)

    raise ArgumentError, 'Request must be a JSON object' unless request.is_a?(Hash)

    raise ArgumentError, 'Request must include an action field' unless request['action']

    request
  end

  # 変換リクエストを処理する
  # @param request [Hash] 解析されたリクエスト
  # @return [String] JSONレスポンス文字列
  def handle_convert_request(request)
    validate_convert_request(request)

    from_format = request['from']
    to_format = request['to']
    content = request['content']

    # 現在はmarkdown -> redmine-textileのみサポート
    unless from_format == 'markdown' && to_format == 'redmine-textile'
      return create_error_response(
        "Unsupported conversion: #{from_format} -> #{to_format}",
        'UNSUPPORTED_CONVERSION'
      )
    end

    converted_content = @converter.convert_markdown_to_redmine_textile(content)

    create_success_response({
                              result: converted_content,
                              from: from_format,
                              to: to_format
                            })
  rescue StandardError => e
    raise e unless e.class.name.include?('ConversionError')

    create_error_response("Conversion failed: #{e.message}", 'CONVERSION_ERROR')
  end

  # pingリクエストを処理する
  # @return [String] JSONレスポンス文字列
  def handle_ping_request
    create_success_response({ message: 'pong' })
  end

  # 変換リクエストの妥当性を検証する
  # @param request [Hash] 解析されたリクエスト
  def validate_convert_request(request)
    required_fields = %w[from to content]

    required_fields.each do |field|
      raise ArgumentError, "Request must include #{field} field" unless request[field]
    end

    return if request['content'].is_a?(String)

    raise ArgumentError, 'Content must be a string'
  end

  # 成功レスポンスを作成する
  # @param data [Hash] レスポンスデータ
  # @return [String] JSONレスポンス文字列
  def create_success_response(data)
    {
      success: true,
      data:,
      timestamp: Time.now.iso8601
    }.to_json
  end

  # エラーレスポンスを作成する
  # @param message [String] エラーメッセージ
  # @param code [String] エラーコード
  # @return [String] JSONレスポンス文字列
  def create_error_response(message, code)
    {
      success: false,
      error: {
        message:,
        code:
      },
      timestamp: Time.now.iso8601
    }.to_json
  end
end
