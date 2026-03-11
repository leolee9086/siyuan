package stream

import (
	"context"
	"testing"
)

func TestProcessor_AccumulateContent(t *testing.T) {
	p := NewProcessor()

	p.AccumulateContent("Hello ")
	p.AccumulateContent("World")

	if got := p.GetAccumulated(); got != "Hello World" {
		t.Errorf("GetAccumulated() = %q, want %q", got, "Hello World")
	}
}

func TestProcessor_MergeToolCalls(t *testing.T) {
	p := NewProcessor()

	// 模拟增量工具调用
	p.MergeToolCalls([]ToolCallDelta{
		{
			Index: 0,
			ID:    "call_1",
			Type:  "function",
			Function: &ToolCallFunctionDelta{
				Name: "test_tool",
			},
		},
	})

	p.MergeToolCalls([]ToolCallDelta{
		{
			Index: 0,
			Function: &ToolCallFunctionDelta{
				Arguments: `{"arg1":`,
			},
		},
	})

	p.MergeToolCalls([]ToolCallDelta{
		{
			Index: 0,
			Function: &ToolCallFunctionDelta{
				Arguments: `"value1"}`,
			},
		},
	})

	result := p.GetResult(true)

	if !result.HasToolCalls {
		t.Error("Expected HasToolCalls to be true")
	}

	if len(result.ToolCallNames) != 1 || result.ToolCallNames[0] != "test_tool" {
		t.Errorf("ToolCallNames = %v, want [test_tool]", result.ToolCallNames)
	}

	args := result.ToolArgumentsByName["test_tool"]
	if len(args) != 1 {
		t.Fatalf("Expected 1 argument, got %d", len(args))
	}

	expectedArgs := `{"arg1":"value1"}`
	if args[0] != expectedArgs {
		t.Errorf("Arguments = %q, want %q", args[0], expectedArgs)
	}
}

func TestProcessor_MultipleToolCalls(t *testing.T) {
	p := NewProcessor()

	// 工具调用 0
	p.MergeToolCalls([]ToolCallDelta{
		{
			Index: 0,
			ID:    "call_1",
			Type:  "function",
			Function: &ToolCallFunctionDelta{
				Name:      "tool_a",
				Arguments: `{"x":1}`,
			},
		},
	})

	// 工具调用 1
	p.MergeToolCalls([]ToolCallDelta{
		{
			Index: 1,
			ID:    "call_2",
			Type:  "function",
			Function: &ToolCallFunctionDelta{
				Name:      "tool_b",
				Arguments: `{"y":2}`,
			},
		},
	})

	result := p.GetResult(true)

	if len(result.ToolCallNames) != 2 {
		t.Errorf("Expected 2 tool calls, got %d", len(result.ToolCallNames))
	}

	// 验证按名称归档
	if len(result.ToolArgumentsByName["tool_a"]) != 1 {
		t.Error("Expected tool_a to have 1 argument")
	}
	if len(result.ToolArgumentsByName["tool_b"]) != 1 {
		t.Error("Expected tool_b to have 1 argument")
	}
}

func TestProcessor_ProcessChannel(t *testing.T) {
	ctx := context.Background()
	chunkChan := make(chan StreamChunk, 3)

	// 发送测试 chunks
	chunkChan <- StreamChunk{
		Choices: []StreamChoice{
			{
				Delta: StreamDelta{
					Content: "Hello ",
				},
			},
		},
	}

	chunkChan <- StreamChunk{
		Choices: []StreamChoice{
			{
				Delta: StreamDelta{
					Content: "World",
					ToolCalls: []ToolCallDelta{
						{
							Index: 0,
							ID:    "call_1",
							Type:  "function",
							Function: &ToolCallFunctionDelta{
								Name:      "test",
								Arguments: `{"a":1}`,
							},
						},
					},
				},
			},
		},
	}

	close(chunkChan)

	p := NewProcessor()
	result, err := p.ProcessChannel(ctx, chunkChan)

	if err != nil {
		t.Fatalf("ProcessChannel() error = %v", err)
	}

	if result.Content != "Hello World" {
		t.Errorf("Content = %q, want %q", result.Content, "Hello World")
	}

	if !result.Success {
		t.Error("Expected Success to be true")
	}

	if !result.HasToolCalls {
		t.Error("Expected HasToolCalls to be true")
	}
}

func TestProcessor_ProcessChannel_ContextCancel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	chunkChan := make(chan StreamChunk)

	// 立即取消
	cancel()

	p := NewProcessor()
	_, err := p.ProcessChannel(ctx, chunkChan)

	if err != context.Canceled {
		t.Errorf("Expected context.Canceled, got %v", err)
	}
}

func TestProcessor_WithHandlers(t *testing.T) {
	contentReceived := ""
	toolCallReceived := false
	completeReceived := false

	handler := &testHandler{
		onContent: func(content string) {
			contentReceived += content
		},
		onToolCall: func(tc *ToolCallDelta) {
			toolCallReceived = true
		},
		onComplete: func(result *StreamResult) {
			completeReceived = true
		},
	}

	p := NewProcessor(handler)
	p.AccumulateContent("test")
	p.MergeToolCalls([]ToolCallDelta{
		{Index: 0, Function: &ToolCallFunctionDelta{Name: "tool"}},
	})
	p.GetResult(true)

	if contentReceived != "test" {
		t.Errorf("Handler received content %q, want %q", contentReceived, "test")
	}
	if !toolCallReceived {
		t.Error("Handler did not receive tool call")
	}
	if !completeReceived {
		t.Error("Handler did not receive complete")
	}
}

// testHandler 测试用的 handler 实现
type testHandler struct {
	onContent  func(string)
	onToolCall func(*ToolCallDelta)
	onComplete func(*StreamResult)
}

func (h *testHandler) OnContent(content string) {
	if h.onContent != nil {
		h.onContent(content)
	}
}

func (h *testHandler) OnToolCall(tc *ToolCallDelta) {
	if h.onToolCall != nil {
		h.onToolCall(tc)
	}
}

func (h *testHandler) OnComplete(result *StreamResult) {
	if h.onComplete != nil {
		h.onComplete(result)
	}
}

func TestProcessor_EmptyContent(t *testing.T) {
	p := NewProcessor()
	p.AccumulateContent("")

	if got := p.GetAccumulated(); got != "" {
		t.Errorf("Expected empty string, got %q", got)
	}
}

func TestProcessor_OutOfOrderToolCalls(t *testing.T) {
	p := NewProcessor()

	// 乱序 index
	p.MergeToolCalls([]ToolCallDelta{
		{Index: 2, Function: &ToolCallFunctionDelta{Name: "tool_c", Arguments: "c"}},
	})
	p.MergeToolCalls([]ToolCallDelta{
		{Index: 0, Function: &ToolCallFunctionDelta{Name: "tool_a", Arguments: "a"}},
	})
	p.MergeToolCalls([]ToolCallDelta{
		{Index: 1, Function: &ToolCallFunctionDelta{Name: "tool_b", Arguments: "b"}},
	})

	result := p.GetResult(true)

	// 验证按 index 排序
	argsByName := result.ToolArgumentsByName
	if argsByName["tool_a"][0] != "a" || argsByName["tool_b"][0] != "b" || argsByName["tool_c"][0] != "c" {
		t.Error("Tool calls not properly ordered")
	}
}
