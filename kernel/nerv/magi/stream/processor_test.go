package stream

import (
	"encoding/json"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestExtractChunkData_DoneMarker(t *testing.T) {
	chunk := "data: [DONE]"
	result, err := extractChunkData(chunk)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Content != "" {
		t.Errorf("expected empty content, got %q", result.Content)
	}
	if len(result.ToolCalls) != 0 {
		t.Errorf("expected no tool calls, got %d", len(result.ToolCalls))
	}
}

func TestExtractChunkData_PlainText(t *testing.T) {
	chunk := "Hello, world!"
	result, err := extractChunkData(chunk)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Content != "Hello, world!" {
		t.Errorf("expected 'Hello, world!', got %q", result.Content)
	}
}

func TestExtractChunkData_SSEFormat(t *testing.T) {
	streamChunk := types.StreamChunk{
		Choices: []types.ChunkChoice{
			{
				Index: 0,
				Delta: types.ChunkDelta{
					Content: "test content",
				},
			},
		},
	}
	jsonBytes, _ := json.Marshal(streamChunk)
	chunk := "data: " + string(jsonBytes)

	result, err := extractChunkData(chunk)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Content != "test content" {
		t.Errorf("expected 'test content', got %q", result.Content)
	}
}

func TestExtractChunkData_WithToolCalls(t *testing.T) {
	streamChunk := types.StreamChunk{
		Choices: []types.ChunkChoice{
			{
				Index: 0,
				Delta: types.ChunkDelta{
					ToolCalls: []types.ToolCallDelta{
						{
							Index: 0,
							Function: &types.ToolCallFunctionDelta{
								Name:      TrinitySpeakToolName,
								Arguments: `{"content":"test"}`,
							},
						},
					},
				},
			},
		},
	}
	jsonBytes, _ := json.Marshal(streamChunk)
	chunk := "data: " + string(jsonBytes)

	result, err := extractChunkData(chunk)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.ToolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(result.ToolCalls))
	}
	if result.ToolCalls[0].Function.Name != TrinitySpeakToolName {
		t.Errorf("expected %q, got %q", TrinitySpeakToolName, result.ToolCalls[0].Function.Name)
	}
}

func TestProcessor_AccumulateContent(t *testing.T) {
	p := NewProcessor()
	p.AccumulateContent("Hello, ")
	p.AccumulateContent("world!")

	if p.GetAccumulated() != "Hello, world!" {
		t.Errorf("expected 'Hello, world!', got %q", p.GetAccumulated())
	}
}

func TestProcessor_MergeToolCalls_SpeakTool(t *testing.T) {
	p := NewProcessor()
	toolCalls := []types.ToolCallDelta{
		{
			Index: 0,
			Function: &types.ToolCallFunctionDelta{
				Name: TrinitySpeakToolName,
			},
		},
		{
			Index: 0,
			Function: &types.ToolCallFunctionDelta{
				Arguments: `{"content":"Hello","channel":"public"}`,
			},
		},
	}

	p.MergeToolCalls(toolCalls)

	if !p.toolState.HasSpeakToolCall {
		t.Error("expected HasSpeakToolCall to be true")
	}
	if p.toolState.NamesByIndex[0] != TrinitySpeakToolName {
		t.Errorf("expected %q, got %q", TrinitySpeakToolName, p.toolState.NamesByIndex[0])
	}
}

func TestProcessor_MergeToolCalls_DeliberationSignal(t *testing.T) {
	p := NewProcessor()
	toolCalls := []types.ToolCallDelta{
		{
			Index: 0,
			Function: &types.ToolCallFunctionDelta{
				Name:      "deliberation_signal",
				Arguments: `{"requires_deliberation":true,"reason":"complex"}`,
			},
		},
	}

	p.MergeToolCalls(toolCalls)

	if !p.toolState.HasDeliberationSignal {
		t.Error("expected HasDeliberationSignal to be true")
	}
}

func TestProcessor_ResolveSpeakChannels_Public(t *testing.T) {
	p := NewProcessor()
	p.toolState.NamesByIndex[0] = TrinitySpeakToolName
	p.toolState.ArgsByIndex[0] = `{"content":"Public message","channel":"public"}`

	content := p.ResolveSpeakChannels()

	if content != "Public message" {
		t.Errorf("expected 'Public message', got %q", content)
	}
	if !p.toolState.HasPublicSpeakToolCall {
		t.Error("expected HasPublicSpeakToolCall to be true")
	}
}

func TestProcessor_ResolveSpeakChannels_Internal(t *testing.T) {
	p := NewProcessor()
	p.toolState.NamesByIndex[0] = TrinitySpeakToolName
	p.toolState.ArgsByIndex[0] = `{"content":"Internal message","channel":"internal"}`

	content := p.ResolveSpeakChannels()

	if content != "" {
		t.Errorf("expected empty public content, got %q", content)
	}
	if len(p.toolState.InternalSpokenMessages) != 1 {
		t.Fatalf("expected 1 internal message, got %d", len(p.toolState.InternalSpokenMessages))
	}
	if p.toolState.InternalSpokenMessages[0] != "Internal message" {
		t.Errorf("expected 'Internal message', got %q", p.toolState.InternalSpokenMessages[0])
	}
}

func TestProcessor_ResolveDeliberationSignal(t *testing.T) {
	p := NewProcessor()
	p.toolState.HasDeliberationSignal = true
	p.toolState.NamesByIndex[0] = "deliberation_signal"
	p.toolState.ArgsByIndex[0] = `{"requires_deliberation":true,"reason":"test reason"}`

	signal := p.ResolveDeliberationSignal()

	if signal == nil {
		t.Fatal("expected non-nil signal")
	}
	if !signal.RequiresDeliberation {
		t.Error("expected RequiresDeliberation to be true")
	}
	if signal.Reason != "test reason" {
		t.Errorf("expected 'test reason', got %q", signal.Reason)
	}
}

func TestProcessor_GetResult(t *testing.T) {
	p := NewProcessor()
	p.AccumulateContent("test content")
	p.observedToolNames[TrinitySpeakToolName] = true
	p.toolState.InternalSpokenMessages = []string{"internal1", "internal2"}

	result := p.GetResult(true)

	if !result.Success {
		t.Error("expected Success to be true")
	}
	if result.Content != "test content" {
		t.Errorf("expected 'test content', got %q", result.Content)
	}
	if !result.HasToolCalls {
		t.Error("expected HasToolCalls to be true")
	}
	if len(result.ToolCallNames) != 1 {
		t.Fatalf("expected 1 tool call name, got %d", len(result.ToolCallNames))
	}
	if len(result.InternalToolMessages) != 2 {
		t.Errorf("expected 2 internal messages, got %d", len(result.InternalToolMessages))
	}
}

func TestProcessor_StreamingWorkflow(t *testing.T) {
	p := NewProcessor()

	// 模拟流式chunk序列
	chunks := []string{
		`data: {"choices":[{"index":0,"delta":{"content":"Hello"}}]}`,
		`data: {"choices":[{"index":0,"delta":{"content":" world"}}]}`,
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"speak"}}]}}]}`,
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"content\":\""}}]}}]}`,
		`data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"Final\",\"channel\":\"public\"}"}}]}}]}`,
		`data: [DONE]`,
	}

	for _, chunk := range chunks {
		parsed, err := p.ProcessChunk(chunk)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if parsed.Content != "" {
			p.AccumulateContent(parsed.Content)
		}

		if len(parsed.ToolCalls) > 0 {
			p.MergeToolCalls(parsed.ToolCalls)
		}
	}

	// 验证累积内容
	if p.GetAccumulated() != "Hello world" {
		t.Errorf("expected 'Hello world', got %q", p.GetAccumulated())
	}

	// 验证工具调用
	if !p.toolState.HasSpeakToolCall {
		t.Error("expected HasSpeakToolCall to be true")
	}

	// 解析speak内容
	spokenContent := p.ResolveSpeakChannels()
	if spokenContent != "Final" {
		t.Errorf("expected 'Final', got %q", spokenContent)
	}
}
