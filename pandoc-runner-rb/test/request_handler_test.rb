# frozen_string_literal: true

require 'minitest/autorun'
require 'json'
require_relative '../lib/request_handler'
require_relative 'mock_pandoc_converter'

class RequestHandlerTest < Minitest::Test
  def setup
    @converter = MockPandocConverter.new
    @handler = RequestHandler.new(@converter)
  end

  def test_handle_ping_request
    request = { action: 'ping' }.to_json
    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    assert response['success']
    assert_equal 'pong', response['data']['message']
    assert response['timestamp']
  end

  def test_handle_convert_request_success
    request = {
      action: 'convert',
      from: 'markdown',
      to: 'redmine-textile',
      content: '# Test\n\nHello **world**!'
    }.to_json

    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    assert response['success']
    assert_equal 'h1. Test\n\nHello *world*!', response['data']['result']
    assert_equal 'markdown', response['data']['from']
    assert_equal 'redmine-textile', response['data']['to']
    assert response['timestamp']
  end

  def test_handle_convert_request_unsupported_conversion
    request = {
      action: 'convert',
      from: 'markdown',
      to: 'html',
      content: '# Test'
    }.to_json

    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_equal 'UNSUPPORTED_CONVERSION', response['error']['code']
    assert_includes response['error']['message'], 'Unsupported conversion'
  end

  def test_handle_convert_request_missing_fields
    # fromフィールドが欠けている場合
    request = {
      action: 'convert',
      to: 'redmine-textile',
      content: '# Test'
    }.to_json

    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_includes response['error']['message'], 'from field'
  end

  def test_handle_convert_request_invalid_content_type
    request = {
      action: 'convert',
      from: 'markdown',
      to: 'redmine-textile',
      content: 123
    }.to_json

    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_includes response['error']['message'], 'Content must be a string'
  end

  def test_handle_unknown_action
    request = { action: 'unknown' }.to_json
    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_equal 'UNKNOWN_ACTION', response['error']['code']
  end

  def test_handle_invalid_json
    invalid_json = '{ invalid json'
    response_json = @handler.handle_request(invalid_json)
    response = JSON.parse(response_json)

    refute response['success']
    assert_equal 'INVALID_JSON', response['error']['code']
  end

  def test_handle_non_object_json
    request = '["not", "an", "object"]'
    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_includes response['error']['message'], 'JSON object'
  end

  def test_handle_missing_action
    request = { content: 'test' }.to_json
    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_includes response['error']['message'], 'action field'
  end

  def test_handle_convert_request_conversion_error
    # 変換を失敗させる
    @converter.set_conversion_success(false, 'Mock pandoc error')

    request = {
      action: 'convert',
      from: 'markdown',
      to: 'redmine-textile',
      content: '# Test'
    }.to_json

    response_json = @handler.handle_request(request)
    response = JSON.parse(response_json)

    refute response['success']
    assert_equal 'CONVERSION_ERROR', response['error']['code']
    assert_includes response['error']['message'], 'Mock pandoc error'
  end
end
