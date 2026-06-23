// Package handler は JSON リクエストの解析と処理を担当する。
package handler

import (
	"encoding/json"
	"time"

	"pandoc-runner-go/internal/types"
)

// PandocConverterIface は PandocConverter が実装すべきインターフェース。
type PandocConverterIface interface {
	// ConvertMarkdownToRedmineTextile は markdown を redmine-textile に変換する。
	ConvertMarkdownToRedmineTextile(markdownText string) (string, error)
}

// RequestHandler は JSON リクエストを受け取り、JSON レスポンスを返す。
type RequestHandler struct {
	// converter は pandoc 変換処理を担当する。
	converter PandocConverterIface
}

// New は RequestHandler を生成する。
func New(converter PandocConverterIface) *RequestHandler {
	return &RequestHandler{converter: converter}
}

// HandleRequest は JSON 文字列のリクエストを処理し、JSON 文字列のレスポンスを返す。
// 全てのエラーは JSON エラーレスポンスとして返し、パニックしない。
func (h *RequestHandler) HandleRequest(requestJSON string) string {
	// action を取得するために RawRequest をパース
	var raw types.RawRequest
	if err := json.Unmarshal([]byte(requestJSON), &raw); err != nil {
		return h.errorResponse("Invalid JSON: "+err.Error(), "INVALID_JSON")
	}

	switch raw.Action {
	case "convert":
		return h.handleConvert(requestJSON)
	case "ping":
		return h.handlePing()
	case "":
		return h.errorResponse("Request must include an action field", "INVALID_JSON")
	default:
		return h.errorResponse("Unknown action: "+raw.Action, "UNKNOWN_ACTION")
	}
}

func (h *RequestHandler) handleConvert(requestJSON string) string {
	var req types.ConversionRequest
	if err := json.Unmarshal([]byte(requestJSON), &req); err != nil {
		return h.errorResponse("Invalid JSON: "+err.Error(), "INVALID_JSON")
	}

	// 必須フィールドの検証
	if req.From == "" {
		return h.errorResponse("Request must include from field", "INVALID_JSON")
	}
	if req.To == "" {
		return h.errorResponse("Request must include to field", "INVALID_JSON")
	}
	if req.Content == "" {
		return h.errorResponse("Request must include content field", "INVALID_JSON")
	}

	// 現在は markdown -> redmine-textile のみサポート
	if req.From != "markdown" || req.To != "redmine-textile" {
		return h.errorResponse(
			"Unsupported conversion: "+req.From+" -> "+req.To,
			"UNSUPPORTED_CONVERSION",
		)
	}

	converted, err := h.converter.ConvertMarkdownToRedmineTextile(req.Content)
	if err != nil {
		if _, ok := err.(*types.ConversionError); ok {
			return h.errorResponse("Conversion failed: "+err.Error(), "CONVERSION_ERROR")
		}
		return h.errorResponse("Internal error: "+err.Error(), "INTERNAL_ERROR")
	}

	return h.successResponse(types.ConversionResult{
		Result: converted,
		From:   req.From,
		To:     req.To,
	})
}

func (h *RequestHandler) handlePing() string {
	return h.successResponse(types.PingResult{Message: "pong"})
}

func (h *RequestHandler) successResponse(data interface{}) string {
	resp := types.SuccessResponse{
		Success:   true,
		Data:      data,
		Timestamp: now(),
	}
	b, err := json.Marshal(resp)
	if err != nil {
		// SuccessResponse の型が固定されているため通常は発生しない。
		// 発生した場合はフォールバックとして固定エラーレスポンスを返す。
		return `{"success":false,"error":{"message":"failed to serialize response","code":"INTERNAL_ERROR"},"timestamp":""}`
	}
	return string(b)
}

func (h *RequestHandler) errorResponse(message, code string) string {
	resp := types.ErrorResponse{
		Success: false,
		Error: types.ErrorDetail{
			Message: message,
			Code:    code,
		},
		Timestamp: now(),
	}
	b, err := json.Marshal(resp)
	if err != nil {
		// ErrorResponse の型が固定されているため通常は発生しない。
		// 発生した場合はフォールバックとして固定エラーレスポンスを返す。
		return `{"success":false,"error":{"message":"failed to serialize error response","code":"INTERNAL_ERROR"},"timestamp":""}`
	}
	return string(b)
}

// now は現在時刻を RFC3339Nano（UTC）形式の文字列で返す。
func now() string {
	return time.Now().UTC().Format(time.RFC3339Nano)
}
