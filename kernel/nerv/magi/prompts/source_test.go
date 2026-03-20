package prompts

import (
	"strings"
	"testing"
)

func TestBuildSourceAwareUserInputWithRuntime(t *testing.T) {
	userMessage := "你好"
	sourcePayload := map[string]interface{}{
		"channel": "guardian",
	}
	runtimeClock := map[string]interface{}{
		"today": "2026-03-09",
	}
	workspaceSnapshot := map[string]interface{}{
		"name": "SiYuan",
	}

	got := BuildSourceAwareUserInputWithRuntime(userMessage, sourcePayload, runtimeClock, workspaceSnapshot)

	if !strings.Contains(got, "<runtime_clock>") {
		t.Fatal("expected runtime_clock envelope")
	}
	if !strings.Contains(got, "<workspace_snapshot>") {
		t.Fatal("expected workspace_snapshot envelope")
	}
	if !strings.Contains(got, "<request_source>") {
		t.Fatal("expected request_source envelope")
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

	_ = BuildSourceAwareUserInputWithRuntime(userMessage, sourcePayload, nil, nil)
}
