package stream

import (
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util/stream"
)

func TestSpeakToolHandler_PublicChannel(t *testing.T) {
	handler := NewSpeakToolHandler()

	// 模拟 speak 工具调用 - public channel
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name: TrinitySpeakToolName,
		},
	})

	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Arguments: `{"content":"Hello","channel":"public"}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasPublicSpeakCall() {
		t.Error("Expected HasPublicSpeakCall to be true")
	}

	if got := handler.GetPublicContent(); got != "Hello" {
		t.Errorf("GetPublicContent() = %q, want %q", got, "Hello")
	}

	if len(handler.GetInternalMessages()) != 0 {
		t.Errorf("Expected no internal messages, got %d", len(handler.GetInternalMessages()))
	}
}

func TestSpeakToolHandler_InternalChannel(t *testing.T) {
	handler := NewSpeakToolHandler()

	// 模拟 speak 工具调用 - internal channel
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name:      TrinitySpeakToolName,
			Arguments: `{"content":"Internal message","channel":"internal"}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if handler.HasPublicSpeakCall() {
		t.Error("Expected HasPublicSpeakCall to be false")
	}

	if got := handler.GetPublicContent(); got != "" {
		t.Errorf("GetPublicContent() = %q, want empty", got)
	}

	messages := handler.GetInternalMessages()
	if len(messages) != 1 {
		t.Fatalf("Expected 1 internal message, got %d", len(messages))
	}

	if messages[0] != "Internal message" {
		t.Errorf("Internal message = %q, want %q", messages[0], "Internal message")
	}
}

func TestSpeakToolHandler_MixedChannels(t *testing.T) {
	handler := NewSpeakToolHandler()

	// Internal message (index 0)
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name:      TrinitySpeakToolName,
			Arguments: `{"content":"Internal 1","channel":"internal"}`,
		},
	})

	// Public message (index 1)
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 1,
		Function: &stream.ToolCallFunctionDelta{
			Name:      TrinitySpeakToolName,
			Arguments: `{"content":"Public message","channel":"public"}`,
		},
	})

	// Another internal message (index 2)
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 2,
		Function: &stream.ToolCallFunctionDelta{
			Name:      TrinitySpeakToolName,
			Arguments: `{"content":"Internal 2","channel":"internal"}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasPublicSpeakCall() {
		t.Error("Expected HasPublicSpeakCall to be true")
	}

	if got := handler.GetPublicContent(); got != "Public message" {
		t.Errorf("GetPublicContent() = %q, want %q", got, "Public message")
	}

	messages := handler.GetInternalMessages()
	if len(messages) != 2 {
		t.Fatalf("Expected 2 internal messages, got %d", len(messages))
	}

	if messages[0] != "Internal 1" || messages[1] != "Internal 2" {
		t.Errorf("Internal messages = %v, want [Internal 1, Internal 2]", messages)
	}
}

func TestDeliberationHandler_RequiresDeliberation(t *testing.T) {
	handler := NewDeliberationHandler()

	// 模拟 deliberation_signal 工具调用
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name:      DeliberationSignalToolName,
			Arguments: `{"requires_deliberation":true,"reason":"Complex decision needed"}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasSignal() {
		t.Error("Expected HasSignal to be true")
	}

	if !handler.RequiresDeliberation() {
		t.Error("Expected RequiresDeliberation to be true")
	}

	if got := handler.GetReason(); got != "Complex decision needed" {
		t.Errorf("GetReason() = %q, want %q", got, "Complex decision needed")
	}

	signal := handler.GetSignal()
	if signal == nil {
		t.Fatal("Expected non-nil signal")
	}

	if !signal.RequiresDeliberation {
		t.Error("Signal.RequiresDeliberation should be true")
	}
}

func TestDeliberationHandler_NoDeliberation(t *testing.T) {
	handler := NewDeliberationHandler()

	// 模拟 deliberation_signal 工具调用 - 不需要审慎决策
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name:      DeliberationSignalToolName,
			Arguments: `{"requires_deliberation":false,"reason":"Simple case"}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasSignal() {
		t.Error("Expected HasSignal to be true")
	}

	if handler.RequiresDeliberation() {
		t.Error("Expected RequiresDeliberation to be false")
	}

	if got := handler.GetReason(); got != "Simple case" {
		t.Errorf("GetReason() = %q, want %q", got, "Simple case")
	}
}

func TestDeliberationHandler_NoSignal(t *testing.T) {
	handler := NewDeliberationHandler()

	// 没有 deliberation_signal 工具调用
	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if handler.HasSignal() {
		t.Error("Expected HasSignal to be false")
	}

	if handler.GetSignal() != nil {
		t.Error("Expected GetSignal to return nil")
	}
}

func TestSpeakToolHandler_InvalidJSON(t *testing.T) {
	handler := NewSpeakToolHandler()

	// 无效的 JSON
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name:      TrinitySpeakToolName,
			Arguments: `{invalid json}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	// 应该优雅处理错误
	if handler.HasPublicSpeakCall() {
		t.Error("Expected HasPublicSpeakCall to be false for invalid JSON")
	}
}

func TestSpeakToolHandler_IncrementalArguments(t *testing.T) {
	handler := NewSpeakToolHandler()

	// 模拟增量参数
	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Name: TrinitySpeakToolName,
		},
	})

	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Arguments: `{"content":"He`,
		},
	})

	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Arguments: `llo World",`,
		},
	})

	handler.OnToolCall(&stream.ToolCallDelta{
		Index: 0,
		Function: &stream.ToolCallFunctionDelta{
			Arguments: `"channel":"public"}`,
		},
	})

	result := &stream.StreamResult{}
	handler.OnComplete(result)

	if !handler.HasPublicSpeakCall() {
		t.Error("Expected HasPublicSpeakCall to be true")
	}

	if got := handler.GetPublicContent(); got != "Hello World" {
		t.Errorf("GetPublicContent() = %q, want %q", got, "Hello World")
	}
}
