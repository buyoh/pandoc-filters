// Package types は pandoc-runner-go で使用される共通型を定義する。
package types

// ConversionRequest は markdown から redmine-textile への変換リクエストを表す。
type ConversionRequest struct {
	Action  string `json:"action"`
	From    string `json:"from"`
	To      string `json:"to"`
	Content string `json:"content"`
}

// PingRequest は疎通確認リクエストを表す。
type PingRequest struct {
	Action string `json:"action"`
}

// RawRequest は action フィールドのみを持つ中間的なリクエスト型で、
// アクションによる振り分けに使用する。
type RawRequest struct {
	Action string `json:"action"`
}

// SuccessResponse は成功レスポンスを表す。
// Data は変換結果（ConversionResult）または疎通確認結果（PingResult）を格納する。
type SuccessResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data"`
	Timestamp string      `json:"timestamp"`
}

// ErrorDetail はエラーの詳細を表す。
type ErrorDetail struct {
	// Message はエラーの説明。
	Message string `json:"message"`
	// Code はエラーの種別を示すコード。
	Code string `json:"code"`
}

// ErrorResponse はエラーレスポンスを表す。
type ErrorResponse struct {
	Success   bool        `json:"success"`
	Error     ErrorDetail `json:"error"`
	Timestamp string      `json:"timestamp"`
}

// ConversionResult は変換結果を表す。
type ConversionResult struct {
	Result string `json:"result"`
	From   string `json:"from"`
	To     string `json:"to"`
}

// PingResult は ping リクエストへのレスポンスデータを表す。
type PingResult struct {
	Message string `json:"message"`
}

// ConversionError はドメイン上の変換エラー（pandoc 実行失敗など）を表す。
// 回復可能なエラーであり、戻り値として返す。
type ConversionError struct {
	Message string
}

// Error は error インターフェースを実装する。
func (e *ConversionError) Error() string {
	return e.Message
}
