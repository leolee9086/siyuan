package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

func testServer() *Server {
	return NewServer(Deps{
		SearchFn: func(query string, opts shared.SearchOptions) (shared.SearchResponse, error) {
			return shared.SearchResponse{
				Query:       query,
				Provider:    shared.ProviderMeta,
				UsedEngines: []string{"duckduckgo"},
				Results: []shared.AggregatedResult{{
					Title: "fake title", URL: "https://example.com", Score: 1,
					Engines: []string{"duckduckgo"}, Positions: []int{1},
				}},
			}, nil
		},
		StatusFn: func(names []string, probe bool, query string) []shared.EngineDiagnostic {
			return []shared.EngineDiagnostic{{Name: "duckduckgo", Enabled: true, Status: "ready"}}
		},
	})
}

func call(t *testing.T, s *Server, raw string) ([]byte, bool) {
	t.Helper()
	resp, notification := s.Handle([]byte(raw))
	return resp, notification
}

func unmarshalResponse(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatalf("invalid response JSON %q: %v", raw, err)
	}
	return m
}

func TestInitializeHandshake(t *testing.T) {
	s := testServer()
	resp, notification := call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}`)
	if notification {
		t.Fatal("initialize must produce a response")
	}
	m := unmarshalResponse(t, resp)
	if m["jsonrpc"] != "2.0" || m["id"].(float64) != 1 {
		t.Fatalf("bad envelope: %v", m)
	}
	result := m["result"].(map[string]any)
	if result["protocolVersion"] != "2025-06-18" {
		t.Fatalf("protocolVersion = %v", result["protocolVersion"])
	}
	info := result["serverInfo"].(map[string]any)
	if info["name"] != "websearch-mcp" || info["version"] != shared.Version {
		t.Fatalf("serverInfo = %v", info)
	}
	capabilities := result["capabilities"].(map[string]any)
	if _, ok := capabilities["tools"]; !ok {
		t.Fatalf("tools capability missing: %v", capabilities)
	}
}

func TestInitializeNegotiatesSupportedVersion(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}`)
	m := unmarshalResponse(t, resp)
	if got := m["result"].(map[string]any)["protocolVersion"]; got != "2024-11-05" {
		t.Fatalf("protocolVersion = %v, want 2024-11-05", got)
	}
	// Unsupported version falls back to the server default.
	resp, _ = call(t, s, `{"jsonrpc":"2.0","id":2,"method":"initialize","params":{"protocolVersion":"2099-01-01"}}`)
	m = unmarshalResponse(t, resp)
	if got := m["result"].(map[string]any)["protocolVersion"]; got != defaultProtocolVersion {
		t.Fatalf("protocolVersion = %v, want default %s", got, defaultProtocolVersion)
	}
}

func TestToolsList(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	if len(resp) == 0 {
		t.Fatal("initialize failed")
	}
	resp, notification := call(t, s, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)
	if notification {
		t.Fatal("tools/list must produce a response")
	}
	m := unmarshalResponse(t, resp)
	tools := m["result"].(map[string]any)["tools"].([]any)
	names := map[string]bool{}
	for _, tool := range tools {
		names[tool.(map[string]any)["name"].(string)] = true
	}
	for _, want := range []string{"web_search", "web_search_status"} {
		if !names[want] {
			t.Fatalf("tool %s missing from %v", want, names)
		}
	}
}

func TestToolsCallWebSearch(t *testing.T) {
	s := testServer()
	call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"golang"}}}`)
	m := unmarshalResponse(t, resp)
	result := m["result"].(map[string]any)
	if isError, _ := result["isError"].(bool); isError {
		t.Fatalf("unexpected isError: %v", result)
	}
	content := result["content"].([]any)
	text := content[0].(map[string]any)["text"].(string)
	var sr shared.SearchResponse
	if err := json.Unmarshal([]byte(text), &sr); err != nil {
		t.Fatalf("web_search payload is not a SearchResponse: %v", err)
	}
	if sr.Query != "golang" || len(sr.Results) != 1 || sr.Results[0].URL != "https://example.com" {
		t.Fatalf("unexpected SearchResponse: %+v", sr)
	}
}

func TestToolsCallWebSearchEmptyQuery(t *testing.T) {
	s := testServer()
	call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"web_search","arguments":{}}}`)
	m := unmarshalResponse(t, resp)
	result := m["result"].(map[string]any)
	if isError, _ := result["isError"].(bool); !isError {
		t.Fatal("empty query must be a tool error")
	}
}

func TestToolsCallUnknownTool(t *testing.T) {
	s := testServer()
	call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"nope","arguments":{}}}`)
	m := unmarshalResponse(t, resp)
	result := m["result"].(map[string]any)
	if isError, _ := result["isError"].(bool); !isError {
		t.Fatal("unknown tool must be a tool error")
	}
	text := result["content"].([]any)[0].(map[string]any)["text"].(string)
	if !strings.Contains(text, "tool not found") {
		t.Fatalf("unexpected error text: %s", text)
	}
}

func TestToolsCallStatus(t *testing.T) {
	s := testServer()
	call(t, s, `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"web_search_status","arguments":{}}}`)
	m := unmarshalResponse(t, resp)
	result := m["result"].(map[string]any)
	if isError, _ := result["isError"].(bool); isError {
		t.Fatalf("unexpected isError: %v", result)
	}
	text := result["content"].([]any)[0].(map[string]any)["text"].(string)
	var status map[string]any
	if err := json.Unmarshal([]byte(text), &status); err != nil {
		t.Fatalf("status payload invalid JSON: %v", err)
	}
	for _, key := range []string{"engines", "rateLimiter", "cache"} {
		if _, ok := status[key]; !ok {
			t.Fatalf("status missing %q: %v", key, status)
		}
	}
}

func TestMethodNotFound(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":1,"method":"unknown/method"}`)
	m := unmarshalResponse(t, resp)
	if code := m["error"].(map[string]any)["code"].(float64); code != -32601 {
		t.Fatalf("error code = %v, want -32601", code)
	}
}

func TestParseError(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{not json`)
	m := unmarshalResponse(t, resp)
	if code := m["error"].(map[string]any)["code"].(float64); code != -32700 {
		t.Fatalf("error code = %v, want -32700", code)
	}
}

func TestInvalidRequest(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{"jsonrpc":"1.0","id":1,"method":"ping"}`)
	m := unmarshalResponse(t, resp)
	if code := m["error"].(map[string]any)["code"].(float64); code != -32600 {
		t.Fatalf("error code = %v, want -32600", code)
	}
}

func TestNotificationGetsNoResponse(t *testing.T) {
	s := testServer()
	resp, notification := call(t, s, `{"jsonrpc":"2.0","method":"ping"}`)
	if !notification || resp != nil {
		t.Fatal("notification must not produce a response")
	}
}

func TestNotInitialized(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`)
	m := unmarshalResponse(t, resp)
	if code := m["error"].(map[string]any)["code"].(float64); code != -32002 {
		t.Fatalf("error code = %v, want -32002", code)
	}
}

func TestPing(t *testing.T) {
	s := testServer()
	resp, _ := call(t, s, `{"jsonrpc":"2.0","id":1,"method":"ping"}`)
	m := unmarshalResponse(t, resp)
	if _, ok := m["result"]; !ok {
		t.Fatalf("ping must return a result: %v", m)
	}
}

// ── streamable HTTP 传输 ───────────────────────────────

func TestHTTPInitializeAndCall(t *testing.T) {
	handler := newHTTPHandler(testServer(), nil)
	ts := httptest.NewServer(handler)
	defer ts.Close()

	// initialize 建立会话，响应头带回会话 ID
	resp, err := http.Post(ts.URL+"/mcp", "application/json",
		strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}`))
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("initialize status = %d", resp.StatusCode)
	}
	sessionID := resp.Header.Get("Mcp-Session-Id")
	if sessionID == "" {
		t.Fatal("initialize response must carry Mcp-Session-Id")
	}
	if got := resp.Header.Get("Mcp-Protocol-Version"); got != "2025-06-18" {
		t.Fatalf("Mcp-Protocol-Version = %q", got)
	}

	// 无会话的 tools/call 返回 400
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/mcp",
		strings.NewReader(`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"x"}}}`))
	req.Header.Set("Content-Type", "application/json")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing session status = %d, want 400", resp.StatusCode)
	}

	// 带会话的 tools/call 返回 200 与结果
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/mcp",
		strings.NewReader(`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"web_search","arguments":{"query":"golang"}}}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Mcp-Session-Id", sessionID)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ = io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("tools/call status = %d", resp.StatusCode)
	}
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("tools/call response invalid: %v", err)
	}
	if _, ok := m["result"]; !ok {
		t.Fatalf("tools/call missing result: %v", m)
	}

	// 通知返回 202
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/mcp",
		strings.NewReader(`{"jsonrpc":"2.0","method":"notifications/initialized"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Mcp-Session-Id", sessionID)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("notification status = %d, want 202", resp.StatusCode)
	}

	// DELETE 返回 204，之后会话失效
	req, _ = http.NewRequest(http.MethodDelete, ts.URL+"/mcp", nil)
	req.Header.Set("Mcp-Session-Id", sessionID)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("DELETE status = %d, want 204", resp.StatusCode)
	}
	req, _ = http.NewRequest(http.MethodPost, ts.URL+"/mcp",
		strings.NewReader(`{"jsonrpc":"2.0","id":3,"method":"ping"}`))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Mcp-Session-Id", sessionID)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("deleted session status = %d, want 404", resp.StatusCode)
	}
}

func TestHTTPSSEStream(t *testing.T) {
	handler := newHTTPHandler(testServer(), nil)
	ts := httptest.NewServer(handler)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/mcp", nil)
	req.Header.Set("Accept", "text/event-stream")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("Content-Type = %q", ct)
	}
	buf := make([]byte, 64)
	n, err := resp.Body.Read(buf)
	if err != nil && err != io.EOF {
		t.Fatal(err)
	}
	if !bytes.Contains(buf[:n], []byte("event: endpoint")) {
		t.Fatalf("SSE stream missing endpoint event: %q", buf[:n])
	}
}

func TestHTTPCORS(t *testing.T) {
	handler := newHTTPHandler(testServer(), nil)
	ts := httptest.NewServer(handler)
	defer ts.Close()

	req, _ := http.NewRequest(http.MethodOptions, ts.URL+"/mcp", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("OPTIONS status = %d, want 204", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "*" {
		t.Fatalf("Access-Control-Allow-Origin = %q", got)
	}
}
