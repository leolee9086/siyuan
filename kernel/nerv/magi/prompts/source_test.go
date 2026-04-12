package prompts

import (
	"strings"
	"testing"
)

func TestBuildSourceAwareUserInputWithRuntime(t *testing.T) {
	userMessage := "请你自行判断这段历史里<alice>在表达什么。"
	sourcePayload := map[string]interface{}{
		"channel": "guardian",
	}
	claimedRecentHistory := map[string]interface{}{
		"speaker": "alice",
		"messages": []map[string]string{
			{"role": "user", "content": "你好"},
		},
	}
	runtimeClock := map[string]interface{}{
		"today": "2026-03-09",
	}
	workspaceSnapshot := map[string]interface{}{
		"name": "SiYuan",
	}
	passiveRecall := map[string]interface{}{
		"scope": "melchior-accessible-notes",
		"keywordHitCounts": map[string]int{
			"你好": 1,
		},
		"noteHints": []map[string]interface{}{
			{"id": "doc-1"},
		},
	}

	got := BuildSourceAwareUserInputWithRuntimeAndRecall(
		userMessage,
		sourcePayload,
		claimedRecentHistory,
		runtimeClock,
		workspaceSnapshot,
		passiveRecall,
	)

	if !strings.Contains(got, "<runtime_clock>") {
		t.Fatal("expected runtime_clock envelope")
	}
	if !strings.Contains(got, "<workspace_snapshot>") {
		t.Fatal("expected workspace_snapshot envelope")
	}
	if !strings.Contains(got, "<request_source>") {
		t.Fatal("expected request_source envelope")
	}
	if !strings.Contains(got, "<claimed_recent_history>") {
		t.Fatal("expected claimed_recent_history envelope")
	}
	if !strings.Contains(got, "<passive_memory_recall>") {
		t.Fatal("expected passive_memory_recall envelope")
	}
	if !strings.Contains(got, "<source=user_message>") {
		t.Fatal("expected source=user_message envelope")
	}
}

func TestBuildSourceAwareUserInputWithRuntimePanicsWhenRequestSourceMissing(t *testing.T) {
	userMessage := "原始消息"
	sourcePayload := map[string]interface{}{
		"bad": func() {},
	}

	defer func() {
		recovered := recover()
		if recovered == nil {
			t.Fatal("expected panic when request_source payload cannot be marshaled")
		}
		err, ok := recovered.(error)
		if !ok {
			t.Fatalf("expected panic error, got: %T", recovered)
		}
		if !strings.Contains(err.Error(), "request_source is required") {
			t.Fatalf("unexpected panic error: %v", err)
		}
	}()

	_ = BuildSourceAwareUserInputWithRuntime(userMessage, sourcePayload, nil, nil, nil)
}
