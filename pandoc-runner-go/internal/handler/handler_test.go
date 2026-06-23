// handler_test.go は Unit-Fake テスト（StubPandocConverter を使用）
package handler

import (
	"encoding/json"
	"testing"

	"pandoc-runner-go/internal/types"
)

// StubPandocConverter はテスト用の PandocConverter スタブ。
type StubPandocConverter struct {
	// result は ConvertMarkdownToRedmineTextile が返す成功結果。
	result string
	// err は ConvertMarkdownToRedmineTextile が返すエラー。nilの場合は成功。
	err error
}

func (s *StubPandocConverter) ConvertMarkdownToRedmineTextile(markdownText string) (string, error) {
	return s.result, s.err
}

func parseResponse(t *testing.T, jsonStr string) map[string]interface{} {
	t.Helper()
	var m map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &m); err != nil {
		t.Fatalf("failed to parse response JSON: %v\nJSON: %s", err, jsonStr)
	}
	return m
}

func TestHandleRequest_ConvertSuccess(t *testing.T) {
	stub := &StubPandocConverter{result: "h1. Hello World"}
	h := New(stub)

	req := `{"action":"convert","from":"markdown","to":"redmine-textile","content":"# Hello World"}`
	resp := parseResponse(t, h.HandleRequest(req))

	if resp["success"] != true {
		t.Errorf("expected success=true, got %v", resp["success"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data to be object, got %T", resp["data"])
	}
	if data["result"] != "h1. Hello World" {
		t.Errorf("expected result 'h1. Hello World', got %v", data["result"])
	}
	if data["from"] != "markdown" {
		t.Errorf("expected from 'markdown', got %v", data["from"])
	}
	if data["to"] != "redmine-textile" {
		t.Errorf("expected to 'redmine-textile', got %v", data["to"])
	}
}

func TestHandleRequest_Ping(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	resp := parseResponse(t, h.HandleRequest(`{"action":"ping"}`))

	if resp["success"] != true {
		t.Errorf("expected success=true, got %v", resp["success"])
	}
	data, ok := resp["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected data to be object, got %T", resp["data"])
	}
	if data["message"] != "pong" {
		t.Errorf("expected message 'pong', got %v", data["message"])
	}
}

func TestHandleRequest_InvalidJSON(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	resp := parseResponse(t, h.HandleRequest("invalid json"))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
	errObj, _ := resp["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_JSON" {
		t.Errorf("expected code INVALID_JSON, got %v", errObj["code"])
	}
}

func TestHandleRequest_UnknownAction(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	resp := parseResponse(t, h.HandleRequest(`{"action":"unknown"}`))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
	errObj, _ := resp["error"].(map[string]interface{})
	if errObj["code"] != "UNKNOWN_ACTION" {
		t.Errorf("expected code UNKNOWN_ACTION, got %v", errObj["code"])
	}
}

func TestHandleRequest_UnsupportedConversion(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	req := `{"action":"convert","from":"html","to":"markdown","content":"<h1>Hello</h1>"}`
	resp := parseResponse(t, h.HandleRequest(req))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
	errObj, _ := resp["error"].(map[string]interface{})
	if errObj["code"] != "UNSUPPORTED_CONVERSION" {
		t.Errorf("expected code UNSUPPORTED_CONVERSION, got %v", errObj["code"])
	}
}

func TestHandleRequest_ConversionError(t *testing.T) {
	stub := &StubPandocConverter{
		err: &types.ConversionError{Message: "pandoc failed"},
	}
	h := New(stub)

	req := `{"action":"convert","from":"markdown","to":"redmine-textile","content":"# Hello"}`
	resp := parseResponse(t, h.HandleRequest(req))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
	errObj, _ := resp["error"].(map[string]interface{})
	if errObj["code"] != "CONVERSION_ERROR" {
		t.Errorf("expected code CONVERSION_ERROR, got %v", errObj["code"])
	}
	msg, _ := errObj["message"].(string)
	if msg == "" {
		t.Error("expected non-empty error message")
	}
}

func TestHandleRequest_MissingFromField(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	req := `{"action":"convert","to":"redmine-textile","content":"# Hello"}`
	resp := parseResponse(t, h.HandleRequest(req))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
}

func TestHandleRequest_MissingToField(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	req := `{"action":"convert","from":"markdown","content":"# Hello"}`
	resp := parseResponse(t, h.HandleRequest(req))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
}

func TestHandleRequest_MissingContentField(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	req := `{"action":"convert","from":"markdown","to":"redmine-textile"}`
	resp := parseResponse(t, h.HandleRequest(req))

	if resp["success"] != false {
		t.Errorf("expected success=false, got %v", resp["success"])
	}
}

func TestHandleRequest_TimestampPresent(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	resp := parseResponse(t, h.HandleRequest(`{"action":"ping"}`))

	ts, ok := resp["timestamp"].(string)
	if !ok || ts == "" {
		t.Error("expected non-empty timestamp field")
	}
	// RFC3339Nano 形式であること（Z で終わる UTC 形式）
	if len(ts) < 20 || ts[len(ts)-1] != 'Z' {
		t.Errorf("expected UTC timestamp ending with Z, got %q", ts)
	}
}

func TestHandleRequest_EmptyAction(t *testing.T) {
	stub := &StubPandocConverter{}
	h := New(stub)

	resp := parseResponse(t, h.HandleRequest(`{"action":""}`))

	if resp["success"] != false {
		t.Errorf("expected success=false for empty action, got %v", resp["success"])
	}
	errObj, _ := resp["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_JSON" {
		t.Errorf("expected code INVALID_JSON, got %v", errObj["code"])
	}
}
