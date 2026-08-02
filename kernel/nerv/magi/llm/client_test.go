package llm

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestOpenAIClientToolChoiceFailureIsReturnedWithoutRetry(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":{"message":"Upstream request failed","type":"invalid_request_error"}}`))
	}))
	defer server.Close()

	client := newOpenAIClient(&Config{
		APIKey:     "test-key",
		APIBaseURL: server.URL + "/v1",
		APIModel:   "test-model",
	})
	_, err := client.SendChatRequestSyncDetailed(
		context.Background(),
		[]types.ContextMessage{{Role: types.RoleUser, Content: "test"}},
		[]openai.Tool{{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:       "test_tool",
				Parameters: map[string]interface{}{"type": "object"},
			},
		}},
		"required",
	)
	if err == nil || !strings.Contains(err.Error(), "Upstream request failed") {
		t.Fatalf("expected explicit upstream error, got %v", err)
	}
	if requestCount != 1 {
		t.Fatalf("failed request must not be retried with a different payload, requests=%d", requestCount)
	}
}

func TestOpenAIClientOmitsNilToolChoice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read request body failed: %v", err)
		}
		var payload map[string]interface{}
		if err = json.Unmarshal(body, &payload); err != nil {
			t.Fatalf("decode request body failed: %v", err)
		}
		if _, exists := payload["tool_choice"]; exists {
			t.Fatalf("tool_choice must be omitted, payload keys=%v", payload)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"test","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","tool_calls":[{"id":"call-1","type":"function","function":{"name":"test_tool","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}`))
	}))
	defer server.Close()

	client := newOpenAIClient(&Config{
		APIKey:     "test-key",
		APIBaseURL: server.URL + "/v1",
		APIModel:   "test-model",
	})
	result, err := client.SendChatRequestSyncDetailed(
		context.Background(),
		[]types.ContextMessage{{Role: types.RoleUser, Content: "test"}},
		[]openai.Tool{{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:       "test_tool",
				Parameters: map[string]interface{}{"type": "object"},
			},
		}},
		nil,
	)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	if len(result.ToolCalls) != 1 || result.ToolCalls[0].Function.Name != "test_tool" {
		t.Fatalf("unexpected tool result: %+v", result)
	}
}

func TestOpenAIClientLogicalNoToolsKeepsFixedWrapperOnWire(t *testing.T) {
	tests := []struct {
		name           string
		omitToolChoice bool
		wantChoice     bool
	}{
		{name: "supports-none", wantChoice: true},
		{name: "gateway-omits-tool-choice", omitToolChoice: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				body, err := io.ReadAll(r.Body)
				if err != nil {
					t.Fatalf("read request body failed: %v", err)
				}
				var payload struct {
					Messages   []map[string]any `json:"messages"`
					Tools      []map[string]any `json:"tools"`
					ToolChoice any              `json:"tool_choice"`
				}
				if err = json.Unmarshal(body, &payload); err != nil {
					t.Fatalf("decode request body failed: %v", err)
				}
				if len(payload.Tools) != 1 {
					t.Fatalf("逻辑无工具请求仍应发送固定包装工具: tools=%v", payload.Tools)
				}
				function, _ := payload.Tools[0]["function"].(map[string]any)
				if function["name"] != config.MagiToolName {
					t.Fatalf("包装工具名=%v, want %s", function["name"], config.MagiToolName)
				}
				if len(payload.Messages) != 2 {
					t.Fatalf("应在原消息后追加空 tool_list: messages=%d", len(payload.Messages))
				}
				tail, _ := payload.Messages[len(payload.Messages)-1]["content"].(string)
				if !strings.Contains(tail, "<tool_list>\n[]\n</tool_list>") {
					t.Fatalf("尾部缺少空 tool_list: %q", tail)
				}
				if tt.wantChoice && payload.ToolChoice != "none" {
					t.Fatalf("逻辑无工具请求 tool_choice=%v, want none", payload.ToolChoice)
				}
				if !tt.wantChoice && payload.ToolChoice != nil {
					t.Fatalf("OmitToolChoice 通道应省略 tool_choice: %v", payload.ToolChoice)
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"id":"test","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}]}`))
			}))
			defer server.Close()

			client := newOpenAIClient(&Config{
				APIKey:         "test-key",
				APIBaseURL:     server.URL + "/v1",
				APIModel:       "test-model",
				OmitToolChoice: tt.omitToolChoice,
			})
			result, err := client.SendChatRequestSyncDetailed(
				context.Background(),
				[]types.ContextMessage{{Role: types.RoleUser, Content: "test"}},
				nil,
				nil,
			)
			if err != nil {
				t.Fatalf("request failed: %v", err)
			}
			if result.Content != "ok" {
				t.Fatalf("content=%q, want ok", result.Content)
			}
		})
	}
}

func TestConvertToOpenAIMessages(t *testing.T) {
	tests := []struct {
		name     string
		input    []types.ContextMessage
		expected int
	}{
		{
			name: "基本消息转换",
			input: []types.ContextMessage{
				{Role: types.RoleUser, Content: "Hello"},
				{Role: types.RoleAssistant, Content: "Hi there"},
			},
			expected: 2,
		},
		{
			name: "带工具调用的消息",
			input: []types.ContextMessage{
				{
					Role:    types.RoleAssistant,
					Content: "Let me check that",
					ToolCalls: []types.ToolCall{
						{
							ID:   "call_123",
							Type: "function",
							Function: types.ToolCallFunction{
								Name:      "get_weather",
								Arguments: `{"city":"Beijing"}`,
							},
						},
					},
				},
			},
			expected: 1,
		},
		{
			name: "工具结果消息",
			input: []types.ContextMessage{
				{
					Role:    types.RoleTool,
					Content: `{"temperature":20}`,
					ToolID:  "call_123",
				},
			},
			expected: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := convertToOpenAIMessages(tt.input)
			if len(result) != tt.expected {
				t.Errorf("expected %d messages, got %d", tt.expected, len(result))
			}

			// 验证角色转换
			for i, msg := range result {
				if msg.Role != string(tt.input[i].Role) {
					t.Errorf("message %d: expected role %s, got %s", i, tt.input[i].Role, msg.Role)
				}
			}

			// 验证工具调用转换
			if len(tt.input) > 0 && len(tt.input[0].ToolCalls) > 0 {
				if len(result[0].ToolCalls) != len(tt.input[0].ToolCalls) {
					t.Errorf("expected %d tool calls, got %d", len(tt.input[0].ToolCalls), len(result[0].ToolCalls))
				}
			}

			// 验证工具结果消息的ToolCallID
			if len(tt.input) > 0 && tt.input[0].Role == types.RoleTool {
				if result[0].ToolCallID != tt.input[0].ToolID {
					t.Errorf("expected ToolCallID %s, got %s", tt.input[0].ToolID, result[0].ToolCallID)
				}
			}
		})
	}
}

func TestSessionContext(t *testing.T) {
	t.Run("创建和添加消息", func(t *testing.T) {
		ctx := NewSessionContext()
		if len(ctx.GetMessages()) != 0 {
			t.Error("new context should be empty")
		}

		msg := types.ContextMessage{
			Role:    types.RoleUser,
			Content: "Test message",
		}
		ctx.AddMessage(msg)

		if len(ctx.GetMessages()) != 1 {
			t.Errorf("expected 1 message, got %d", len(ctx.GetMessages()))
		}

		if ctx.GetMessages()[0].Content != "Test message" {
			t.Errorf("message content mismatch")
		}
	})

	t.Run("清空上下文", func(t *testing.T) {
		ctx := NewSessionContext()
		ctx.AddMessage(types.ContextMessage{Role: types.RoleUser, Content: "Test"})
		ctx.Clear()

		if len(ctx.GetMessages()) != 0 {
			t.Error("context should be empty after Clear()")
		}
	})

	t.Run("限制消息数量", func(t *testing.T) {
		ctx := NewSessionContext()
		for i := 0; i < 10; i++ {
			ctx.AddMessage(types.ContextMessage{
				Role:    types.RoleUser,
				Content: string(rune('A' + i)),
			})
		}

		ctx.Limit(5)

		if len(ctx.GetMessages()) != 5 {
			t.Errorf("expected 5 messages after Limit(5), got %d", len(ctx.GetMessages()))
		}

		// 验证保留的是最后5条
		if ctx.GetMessages()[0].Content != "F" {
			t.Errorf("expected first message to be 'F', got '%s'", ctx.GetMessages()[0].Content)
		}
	})
}

func TestNewClient(t *testing.T) {
	t.Run("创建OpenAI客户端", func(t *testing.T) {
		cfg := &Config{
			Provider:    "OpenAI",
			APIKey:      "test-key",
			APIBaseURL:  "https://api.openai.com/v1",
			APIModel:    "gpt-4",
			MaxTokens:   1000,
			Temperature: 0.7,
			Timeout:     30,
		}

		client := NewClient(cfg)
		if client == nil {
			t.Error("client should not be nil")
		}

		_, ok := client.(*openaiClient)
		if !ok {
			t.Error("expected openaiClient type")
		}
	})

	t.Run("创建Claude客户端", func(t *testing.T) {
		cfg := &Config{
			Provider:    "Claude",
			APIKey:      "test-key",
			APIBaseURL:  "https://api.anthropic.com",
			APIModel:    "claude-3-opus",
			MaxTokens:   1000,
			Temperature: 0.7,
			Timeout:     30,
		}

		client := NewClient(cfg)
		if client == nil {
			t.Error("client should not be nil")
		}

		_, ok := client.(*claudeClient)
		if !ok {
			t.Error("expected claudeClient type")
		}
	})
}

func TestNewClientFromConf(t *testing.T) {
	aiConf := &conf.OpenAI{
		APIProvider:    "OpenAI",
		APIKey:         "test-key",
		APIBaseURL:     "https://api.openai.com/v1",
		APIModel:       "gpt-4",
		APIMaxTokens:   2000,
		APITemperature: 0.8,
		APITimeout:     60,
		APIUserAgent:   "test-agent",
		APIVersion:     "v1",
	}

	client := NewClientFromConf(aiConf)
	if client == nil {
		t.Error("client should not be nil")
	}

	oaiClient, ok := client.(*openaiClient)
	if !ok {
		t.Error("expected openaiClient type")
	}

	if oaiClient.config.APIModel != "gpt-4" {
		t.Errorf("expected model gpt-4, got %s", oaiClient.config.APIModel)
	}

	if oaiClient.config.MaxTokens != 2000 {
		t.Errorf("expected MaxTokens 2000, got %d", oaiClient.config.MaxTokens)
	}
}

func TestBuildToolResultMessage(t *testing.T) {
	result := map[string]interface{}{
		"temperature": 20,
		"city":        "Beijing",
	}

	msg := BuildToolResultMessage("call_123", result)

	if msg.Role != types.RoleTool {
		t.Errorf("expected role %s, got %s", types.RoleTool, msg.Role)
	}

	if msg.ToolID != "call_123" {
		t.Errorf("expected ToolID call_123, got %s", msg.ToolID)
	}

	if msg.Content == "" {
		t.Error("content should not be empty")
	}
}

func TestCreateTimeoutContext(t *testing.T) {
	ctx, cancel := CreateTimeoutContext(5)
	defer cancel()

	if ctx == nil {
		t.Error("context should not be nil")
	}

	if ctx.Err() != nil {
		t.Error("context should not be cancelled immediately")
	}
}
