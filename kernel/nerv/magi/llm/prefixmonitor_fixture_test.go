package llm

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

const (
	prefixMonitorFixturePath        = "../../../../packages/chatseqtrie/testdata/synthetic_requests.json"
	prefixMonitorFixtureVersion     = 1
	prefixMonitorSystemMessageIndex = 1460
)

type prefixMonitorSyntheticFixture struct {
	SchemaVersion int   `json:"schemaVersion"`
	ToolCount     int   `json:"toolCount"`
	MessageCounts []int `json:"messageCounts"`
}

func loadSyntheticRequestBodies(t *testing.T) [][]byte {
	t.Helper()
	data, err := os.ReadFile(prefixMonitorFixturePath)
	if err != nil {
		t.Fatalf("读取 %s 失败: %v", prefixMonitorFixturePath, err)
	}
	var fixture prefixMonitorSyntheticFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("解析 %s 失败: %v", prefixMonitorFixturePath, err)
	}
	validatePrefixMonitorFixture(t, fixture)

	tools := buildSyntheticTools(fixture.ToolCount)
	bodies := make([][]byte, 0, len(fixture.MessageCounts))
	for _, count := range fixture.MessageCounts {
		body, err := json.Marshal(map[string]any{
			"model":    "synthetic-model",
			"messages": buildSyntheticMonitorMessages(count),
			"tools":    tools,
		})
		if err != nil {
			t.Fatalf("构造合成请求体失败: %v", err)
		}
		bodies = append(bodies, body)
	}
	return bodies
}

func validatePrefixMonitorFixture(t *testing.T, fixture prefixMonitorSyntheticFixture) {
	t.Helper()
	if fixture.SchemaVersion != prefixMonitorFixtureVersion {
		t.Fatalf("合成夹具版本=%d, want %d", fixture.SchemaVersion, prefixMonitorFixtureVersion)
	}
	if fixture.ToolCount != 11 {
		t.Fatalf("合成夹具工具数=%d, want 11", fixture.ToolCount)
	}
	if len(fixture.MessageCounts) != 23 {
		t.Fatalf("合成夹具请求数=%d, want 23", len(fixture.MessageCounts))
	}
	if fixture.MessageCounts[0] != 1418 || fixture.MessageCounts[len(fixture.MessageCounts)-1] != 1464 {
		t.Fatalf("合成夹具消息范围=%d..%d, want 1418..1464",
			fixture.MessageCounts[0], fixture.MessageCounts[len(fixture.MessageCounts)-1])
	}
	for i := 1; i < len(fixture.MessageCounts); i++ {
		wantDelta := 2
		if i >= 21 {
			wantDelta = 3
		}
		if delta := fixture.MessageCounts[i] - fixture.MessageCounts[i-1]; delta != wantDelta {
			t.Fatalf("合成夹具请求 #%d 消息增量=%d, want %d", i, delta, wantDelta)
		}
	}
}

func buildSyntheticMonitorMessages(count int) []map[string]any {
	messages := make([]map[string]any, 0, count)
	for i := 0; i < count; i++ {
		messages = append(messages, buildSyntheticMonitorMessage(i))
	}
	return messages
}

func buildSyntheticMonitorMessage(index int) map[string]any {
	switch {
	case index == 0:
		return map[string]any{"role": "system", "content": "synthetic stable system prompt"}
	case index == prefixMonitorSystemMessageIndex:
		return map[string]any{"role": "system", "content": "synthetic dynamic status"}
	case index%4 == 1:
		return map[string]any{"role": "user", "content": fmt.Sprintf("synthetic user message %04d", index)}
	case index%4 == 2:
		callID := fmt.Sprintf("synthetic_call_%04d", index)
		return map[string]any{
			"role":             "assistant",
			"content":          fmt.Sprintf("synthetic assistant message %04d", index),
			"reasoningContent": fmt.Sprintf("synthetic reasoning %04d", index),
			"toolCalls": []any{map[string]any{
				"id":        callID,
				"type":      "function",
				"name":      "synthetic_lookup",
				"arguments": fmt.Sprintf(`{"query":"fixture-%04d"}`, index),
			}},
		}
	case index%4 == 3:
		return map[string]any{
			"role":       "tool",
			"content":    fmt.Sprintf("synthetic tool result %04d", index),
			"toolCallId": fmt.Sprintf("synthetic_call_%04d", index-1),
		}
	default:
		return map[string]any{"role": "assistant", "content": fmt.Sprintf("synthetic reply %04d", index)}
	}
}

func buildSyntheticTools(count int) []map[string]any {
	tools := make([]map[string]any, 0, count)
	for i := 0; i < count; i++ {
		tools = append(tools, map[string]any{
			"type": "function",
			"function": map[string]any{
				"name":        fmt.Sprintf("synthetic_tool_%02d", i),
				"description": "synthetic fixture tool",
				"parameters":  map[string]any{"type": "object"},
			},
		})
	}
	return tools
}
