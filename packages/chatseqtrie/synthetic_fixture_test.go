package chatseqtrie

import (
	"encoding/json"
	"fmt"
	"os"
	"testing"
)

const (
	syntheticFixturePath        = "testdata/synthetic_requests.json"
	syntheticFixtureVersion     = 1
	syntheticSystemMessageIndex = 1460
)

type syntheticFixture struct {
	SchemaVersion int   `json:"schemaVersion"`
	ToolCount     int   `json:"toolCount"`
	MessageCounts []int `json:"messageCounts"`
}

type syntheticRequest struct {
	Seq      int64
	Messages []map[string]any
}

func loadSyntheticRequests(t *testing.T) []syntheticRequest {
	t.Helper()
	data, err := os.ReadFile(syntheticFixturePath)
	if err != nil {
		t.Fatalf("读取 %s 失败: %v", syntheticFixturePath, err)
	}
	var fixture syntheticFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("解析 %s 失败: %v", syntheticFixturePath, err)
	}
	validateSyntheticFixture(t, fixture)

	requests := make([]syntheticRequest, 0, len(fixture.MessageCounts))
	for i, count := range fixture.MessageCounts {
		requests = append(requests, syntheticRequest{
			Seq:      int64(i + 1),
			Messages: buildSyntheticMessages(count),
		})
	}
	return requests
}

func validateSyntheticFixture(t *testing.T, fixture syntheticFixture) {
	t.Helper()
	if fixture.SchemaVersion != syntheticFixtureVersion {
		t.Fatalf("合成夹具版本=%d, want %d", fixture.SchemaVersion, syntheticFixtureVersion)
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

func buildSyntheticMessages(count int) []map[string]any {
	messages := make([]map[string]any, 0, count)
	for i := 0; i < count; i++ {
		messages = append(messages, buildSyntheticMessage(i))
	}
	return messages
}

func buildSyntheticMessage(index int) map[string]any {
	switch {
	case index == 0:
		return map[string]any{"role": "system", "content": "synthetic stable system prompt"}
	case index == syntheticSystemMessageIndex:
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
