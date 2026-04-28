package dummysys

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type mockLLMClient struct{}

func (m *mockLLMClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk)
	close(ch)
	return ch, nil
}

func (m *mockLLMClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	return "mock response", nil
}

func (m *mockLLMClient) SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error) {
	return &types.SyncChatResult{Content: "mock response"}, nil
}

func (m *mockLLMClient) GetModel() string {
	return "gpt-4"
}

type mockStreamClient struct {
	chunks   []types.StreamChunk
	chunksFn func() []types.StreamChunk
}

func (m *mockStreamClient) getChunks() []types.StreamChunk {
	if m.chunksFn != nil {
		return m.chunksFn()
	}
	return m.chunks
}

func (m *mockStreamClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	return "mock response", nil
}

func (m *mockStreamClient) SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error) {
	return &types.SyncChatResult{Content: "mock response"}, nil
}

func (m *mockStreamClient) GetModel() string {
	return "gpt-4"
}

func (m *mockStreamClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	chunks := m.getChunks()
	ch := make(chan types.StreamChunk)
	go func() {
		defer close(ch)
		for _, chunk := range chunks {
			select {
			case ch <- chunk:
			case <-ctx.Done():
				return
			}
		}
	}()
	return ch, nil
}

func buildContentChunk(content string) types.StreamChunk {
	return types.StreamChunk{
		Choices: []types.ChunkChoice{
			{
				Delta: types.ChunkDelta{Content: content},
			},
		},
	}
}

func buildToolCallChunk(toolIndex int, toolID, toolName, args string) types.StreamChunk {
	return types.StreamChunk{
		Choices: []types.ChunkChoice{
			{
				Delta: types.ChunkDelta{
					ToolCalls: []types.ToolCallDelta{
						{
							Index: toolIndex,
							ID:    toolID,
							Type:  "function",
							Function: &types.ToolCallFunctionDelta{
								Name:      toolName,
								Arguments: args,
							},
						},
					},
				},
			},
		},
	}
}

func buildFinishChunk() types.StreamChunk {
	finish := "stop"
	return types.StreamChunk{
		Choices: []types.ChunkChoice{
			{
				FinishReason: &finish,
			},
		},
	}
}

func newTestAvatar(config AvatarConfig) (*AvatarDescriptor, error) {
	return NewAvatar(config, &mockLLMClient{})
}

func TestNewAvatar(t *testing.T) {
	client := &mockLLMClient{}

	tests := []struct {
		name    string
		config  AvatarConfig
		wantErr bool
	}{
		{
			name: "valid config",
			config: AvatarConfig{
				AvatarRoleID:            "avatar-role-1",
				AvatarNumber:            1,
				Channel:                 AvatarChannelGuardian,
				SystemPrompt:            "You are Avatar-01",
				ExposureMode:            ExposureModeFull,
				HeartbeatIntervalRounds: 5,
			},
			wantErr: false,
		},
		{
			name: "missing avatarRoleID",
			config: AvatarConfig{
				Channel:      AvatarChannelGuardian,
				SystemPrompt: "test",
			},
			wantErr: true,
		},
		{
			name: "missing channel",
			config: AvatarConfig{
				AvatarRoleID: "avatar-role-1",
				SystemPrompt: "test",
			},
			wantErr: true,
		},
		{
			name: "missing systemPrompt",
			config: AvatarConfig{
				AvatarRoleID: "avatar-role-1",
				Channel:      AvatarChannelGuardian,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			avatar, err := NewAvatar(tt.config, client)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewAvatar() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if avatar == nil {
					t.Error("NewAvatar() returned nil avatar")
					return
				}
				if avatar.GetState() != AvatarStateIdle {
					t.Errorf("NewAvatar() state = %v, want %v", avatar.GetState(), AvatarStateIdle)
				}
				if len(avatar.GetContext()) != 1 {
					t.Errorf("NewAvatar() context length = %v, want 1", len(avatar.GetContext()))
				}
			}
		})
	}
}

func TestAvatarStateTransitions(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID:            "avatar-role-1",
		AvatarNumber:            1,
		Channel:                 AvatarChannelGuardian,
		SystemPrompt:            "You are Avatar-01",
		ExposureMode:            ExposureModeFull,
		HeartbeatIntervalRounds: 5,
	}

	avatar, err := NewAvatar(config, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	if avatar.GetState() != AvatarStateIdle {
		t.Errorf("Initial state = %v, want %v", avatar.GetState(), AvatarStateIdle)
	}

	avatar.SetState(AvatarStateActive)
	if avatar.GetState() != AvatarStateActive {
		t.Errorf("After SetState(Active) state = %v, want %v", avatar.GetState(), AvatarStateActive)
	}

	avatar.SetState(AvatarStateIdle)
	if avatar.GetState() != AvatarStateIdle {
		t.Errorf("After SetState(Idle) state = %v, want %v", avatar.GetState(), AvatarStateIdle)
	}

	avatar.Destroy()
	if avatar.GetState() != AvatarStateDestroyed {
		t.Errorf("After Destroy() state = %v, want %v", avatar.GetState(), AvatarStateDestroyed)
	}
}

func TestAvatarHeartbeatTimeout(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID:            "avatar-role-1",
		AvatarNumber:            1,
		Channel:                 AvatarChannelGuardian,
		SystemPrompt:            "You are Avatar-01",
		ExposureMode:            ExposureModeFull,
		HeartbeatIntervalRounds: 5,
	}

	avatar, err := NewAvatar(config, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	if avatar.CheckHeartbeatTimeout() {
		t.Error("CheckHeartbeatTimeout() = true, want false initially")
	}

	for i := 0; i < 5; i++ {
		avatar.roundsSinceMetaReport++
	}

	if !avatar.CheckHeartbeatTimeout() {
		t.Error("CheckHeartbeatTimeout() = false, want true after 5 rounds")
	}

	result := &types.StreamResult{
		HasToolCalls: true,
		ToolCallNames: []string{"report_to_core"},
		ToolArgumentsByName: map[string][]string{
			"report_to_core": {`{"type":"heartbeat","environment":"test","lessons":"none"}`},
		},
	}
	filtered := avatar.filterAndHandleReports(result)
	if filtered == nil {
		t.Fatal("filterAndHandleReports() should not return nil")
	}
	if filtered.HasToolCalls {
		t.Error("filtered result should have HasToolCalls=false (report_to_core was stripped)")
	}
	if len(filtered.ToolCallNames) != 0 {
		t.Errorf("ToolCallNames = %v, want empty", filtered.ToolCallNames)
	}

	if avatar.CheckHeartbeatTimeout() {
		t.Error("CheckHeartbeatTimeout() = true, want false after heartbeat tool call")
	}
	if avatar.GetRoundsSinceMetaReport() != 0 {
		t.Errorf("GetRoundsSinceMetaReport() = %v, want 0 after heartbeat tool call", avatar.GetRoundsSinceMetaReport())
	}
}

func TestAvatarContextManagement(t *testing.T) {
	client := &mockLLMClient{}
	config := AvatarConfig{
		AvatarRoleID:            "avatar-role-1",
		AvatarNumber:            1,
		Channel:                 AvatarChannelGuardian,
		SystemPrompt:            "You are Avatar-01",
		ExposureMode:            ExposureModeFull,
		HeartbeatIntervalRounds: 5,
	}

	avatar, err := NewAvatar(config, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	ctx := avatar.GetContext()
	if len(ctx) != 1 {
		t.Errorf("Initial context length = %v, want 1", len(ctx))
	}
	if ctx[0].Role != "system" {
		t.Errorf("Initial context role = %v, want system", ctx[0].Role)
	}

	avatar.AddToContext(types.ContextMessage{
		Role:    "user",
		Content: "Hello",
	})
	ctx = avatar.GetContext()
	if len(ctx) != 2 {
		t.Errorf("Context length after AddToContext = %v, want 2", len(ctx))
	}

	avatar.AddToContext(types.ContextMessage{
		Role:    "assistant",
		Content: "Hi there",
	})
	ctx = avatar.GetContext()
	if len(ctx) != 3 {
		t.Errorf("Context length after second AddToContext = %v, want 3", len(ctx))
	}
}

func TestFilterAndHandleReports_ContentOnly(t *testing.T) {
	avatar, _ := newTestAvatar(AvatarConfig{
		AvatarRoleID: "test", Channel: AvatarChannelUnknown, SystemPrompt: "test",
	})

	result := &types.StreamResult{
		Content: "Hello, I am Avatar.",
		Success: true,
	}

	filtered := avatar.filterAndHandleReports(result)
	if filtered == nil {
		t.Fatal("filterAndHandleReports() returned nil for content-only response")
	}
	if filtered.Content != "Hello, I am Avatar." {
		t.Errorf("Content = %q, want %q", filtered.Content, "Hello, I am Avatar.")
	}
	if filtered.HasToolCalls {
		t.Error("HasToolCalls should be false")
	}
}

func TestFilterAndHandleReports_HeartbeatOnly_ReturnsNil(t *testing.T) {
	avatar, _ := newTestAvatar(AvatarConfig{
		AvatarRoleID: "test", Channel: AvatarChannelUnknown, SystemPrompt: "test",
		HeartbeatIntervalRounds: 5,
	})

	// Simulate rounds passing
	for i := 0; i < 5; i++ {
		avatar.roundsSinceMetaReport++
	}
	if !avatar.CheckHeartbeatTimeout() {
		t.Fatal("should be timed out before heartbeat")
	}

	result := &types.StreamResult{
		Content:      "",
		Success:      true,
		HasToolCalls: true,
		ToolCallNames: []string{"report_to_core"},
		ToolArgumentsByName: map[string][]string{
			"report_to_core": {`{"type":"heartbeat","environment":"test-run","lessons":"all-ok","urgency":"low"}`},
		},
	}

	filtered := avatar.filterAndHandleReports(result)
	if filtered == nil {
		t.Fatal("filterAndHandleReports() should not return nil")
	}
	if filtered.HasToolCalls {
		t.Error("HasToolCalls should be false (report_to_core stripped)")
	}
	if filtered.Content != "" {
		t.Errorf("Content = %q, want empty (only heartbeat)", filtered.Content)
	}

	if avatar.CheckHeartbeatTimeout() {
		t.Error("heartbeat timeout should be reset")
	}
	if avatar.GetRoundsSinceMetaReport() != 0 {
		t.Errorf("rounds should be 0, got %d", avatar.GetRoundsSinceMetaReport())
	}

	reports := avatar.GetReports()
	if len(reports) != 1 {
		t.Fatalf("expected 1 report, got %d", len(reports))
	}
	if reports[0].Payload.Type != ReportTypeHeartbeat {
		t.Errorf("report type = %v, want heartbeat", reports[0].Payload.Type)
	}
	if reports[0].Payload.Environment != "test-run" {
		t.Errorf("environment = %q, want test-run", reports[0].Payload.Environment)
	}
}

func TestFilterAndHandleReports_MixedContentAndReports(t *testing.T) {
	avatar, _ := newTestAvatar(AvatarConfig{
		AvatarRoleID: "test", Channel: AvatarChannelUnknown, SystemPrompt: "test",
	})

	result := &types.StreamResult{
		Content:      "I found the answer.",
		Success:      true,
		HasToolCalls: true,
		ToolCallNames: []string{
			"report_to_core",
			"external_search",
		},
		ToolArgumentsByName: map[string][]string{
			"report_to_core":  {`{"type":"progress","environment":"searching","lessons":"need-more-data"}`},
			"external_search": {`{"query":"answer"}`},
		},
	}

	filtered := avatar.filterAndHandleReports(result)
	if filtered == nil {
		t.Fatal("filterAndHandleReports() should NOT return nil when there's content + external tools")
	}
	if filtered.Content != "I found the answer." {
		t.Errorf("Content = %q, want %q", filtered.Content, "I found the answer.")
	}

	if !filtered.HasToolCalls {
		t.Error("HasToolCalls should be true (external_search remains)")
	}
	if len(filtered.ToolCallNames) != 1 || filtered.ToolCallNames[0] != "external_search" {
		t.Errorf("ToolCallNames = %v, want [external_search]", filtered.ToolCallNames)
	}
	if _, exists := filtered.ToolArgumentsByName["report_to_core"]; exists {
		t.Error("report_to_core should be removed from ToolArgumentsByName")
	}
	if _, exists := filtered.ToolArgumentsByName["external_search"]; !exists {
		t.Error("external_search should remain in ToolArgumentsByName")
	}

	reports := avatar.GetReports()
	if len(reports) != 1 {
		t.Fatalf("expected 1 report, got %d", len(reports))
	}
	if reports[0].Payload.Type != ReportTypeProgress {
		t.Errorf("report type = %v, want progress", reports[0].Payload.Type)
	}
}

func TestFilterAndHandleReports_MultipleReports(t *testing.T) {
	avatar, _ := newTestAvatar(AvatarConfig{
		AvatarRoleID: "test", Channel: AvatarChannelUnknown, SystemPrompt: "test",
	})

	result := &types.StreamResult{
		Content:      "Working...",
		Success:      true,
		HasToolCalls: true,
		ToolCallNames: []string{
			"report_to_core",
			"report_to_core",
		},
		ToolArgumentsByName: map[string][]string{
			"report_to_core": {
				`{"type":"heartbeat","environment":"phase-1","lessons":"ok"}`,
				`{"type":"progress","environment":"phase-2","lessons":"in-progress"}`,
			},
		},
	}

	filtered := avatar.filterAndHandleReports(result)
	if filtered == nil {
		t.Fatal("filterAndHandleReports() should NOT return nil (has content)")
	}
	if filtered.HasToolCalls {
		t.Error("HasToolCalls should be false (only report_to_core was present)")
	}

	reports := avatar.GetReports()
	if len(reports) != 2 {
		t.Fatalf("expected 2 reports, got %d", len(reports))
	}
	if reports[0].Payload.Type != ReportTypeHeartbeat {
		t.Errorf("report[0] type = %v, want heartbeat", reports[0].Payload.Type)
	}
	if reports[1].Payload.Type != ReportTypeProgress {
		t.Errorf("report[1] type = %v, want progress", reports[1].Payload.Type)
	}
}

func TestFilterAndHandleReports_ReportCallback(t *testing.T) {
	callbackCalled := false
	var capturedEvent ReportEvent

	avatar, _ := newTestAvatar(AvatarConfig{
		AvatarRoleID: "test", Channel: AvatarChannelUnknown, SystemPrompt: "test",
		ReportCallback: func(ev ReportEvent) {
			callbackCalled = true
			capturedEvent = ev
		},
	})

	result := &types.StreamResult{
		Content:      "done",
		Success:      true,
		HasToolCalls: true,
		ToolCallNames: []string{"report_to_core"},
		ToolArgumentsByName: map[string][]string{
			"report_to_core": {`{"type":"summary","environment":"task-complete","lessons":"success","urgency":"low"}`},
		},
	}

	avatar.filterAndHandleReports(result)
	if !callbackCalled {
		t.Error("ReportCallback was not called")
	}
	if capturedEvent.Payload.Type != ReportTypeSummary {
		t.Errorf("callback received type = %v, want summary", capturedEvent.Payload.Type)
	}
	if capturedEvent.Payload.Environment != "task-complete" {
		t.Errorf("callback received environment = %q, want task-complete", capturedEvent.Payload.Environment)
	}
	if capturedEvent.Payload.Urgency != ReportUrgencyLow {
		t.Errorf("callback received urgency = %v, want low", capturedEvent.Payload.Urgency)
	}
}

func TestProcessMessage_TransparentProxy_NoToolCalls(t *testing.T) {
	mock := &mockStreamClient{
		chunks: []types.StreamChunk{
			buildContentChunk("This is a normal response."),
			buildFinishChunk(),
		},
	}

	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID: "test", AvatarNumber: 1,
		Channel: AvatarChannelUnknown, SystemPrompt: "You are a helpful assistant.",
	}, mock)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	result, err := avatar.ProcessMessage(context.Background(), "Hello")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}
	if result.Content != "This is a normal response." {
		t.Errorf("Content = %q, want %q", result.Content, "This is a normal response.")
	}
	if result.HasToolCalls {
		t.Error("HasToolCalls should be false for normal response")
	}
}

func TestProcessMessage_TransparentProxy_InterceptsHeartbeat(t *testing.T) {
	heartbeatArgs := `{"type":"heartbeat","environment":"test-env","lessons":"all-ok","urgency":"low"}`

	mock := &mockStreamClient{
		chunks: []types.StreamChunk{
			buildContentChunk("Working on it."),
			buildToolCallChunk(0, "call_1", "report_to_core", heartbeatArgs),
			buildFinishChunk(),
		},
	}

	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID: "test", AvatarNumber: 1,
		Channel: AvatarChannelGuardian, SystemPrompt: "You must report heartbeats.",
		HeartbeatIntervalRounds: 5,
	}, mock)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	for i := 0; i < 5; i++ {
		avatar.roundsSinceMetaReport++
	}
	if !avatar.CheckHeartbeatTimeout() {
		t.Fatal("should be timed out before heartbeat")
	}

	result, err := avatar.ProcessMessage(context.Background(), "Do something")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}

	if result.Content != "Working on it." {
		t.Errorf("Content = %q, want %q", result.Content, "Working on it.")
	}
	if result.HasToolCalls {
		t.Error("HasToolCalls should be false (report_to_core was stripped)")
	}
	if len(result.ToolCallNames) != 0 {
		t.Errorf("ToolCallNames = %v, want empty", result.ToolCallNames)
	}

	if avatar.CheckHeartbeatTimeout() {
		t.Error("heartbeat timeout should have been reset")
	}

	reports := avatar.GetReports()
	if len(reports) != 1 {
		t.Fatalf("expected 1 report, got %d", len(reports))
	}
	if reports[0].Payload.Type != ReportTypeHeartbeat {
		t.Errorf("report type = %v, want heartbeat", reports[0].Payload.Type)
	}
}

func TestProcessMessage_TransparentProxy_MixedTools(t *testing.T) {
	heartbeatArgs := `{"type":"heartbeat","environment":"working","lessons":"none"}`
	searchArgs := `{"query":"test query"}`

	mock := &mockStreamClient{
		chunks: []types.StreamChunk{
			buildContentChunk("Let me search for that."),
			buildToolCallChunk(0, "call_heartbeat", "report_to_core", heartbeatArgs),
			buildToolCallChunk(1, "call_search", "external_search", searchArgs),
			buildFinishChunk(),
		},
	}

	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID: "test", AvatarNumber: 1,
		Channel: AvatarChannelUnknown, SystemPrompt: "test",
	}, mock)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	result, err := avatar.ProcessMessage(context.Background(), "Search something")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}

	if result.Content != "Let me search for that." {
		t.Errorf("Content = %q, want %q", result.Content, "Let me search for that.")
	}
	if !result.HasToolCalls {
		t.Error("HasToolCalls should be true (external_search remains)")
	}

	hasExternalSearch := false
	for _, name := range result.ToolCallNames {
		if name == "external_search" {
			hasExternalSearch = true
		}
		if name == "report_to_core" {
			t.Error("report_to_core should NOT be in ToolCallNames")
		}
	}
	if !hasExternalSearch {
		t.Error("external_search should be in ToolCallNames")
	}

	if _, exists := result.ToolArgumentsByName["report_to_core"]; exists {
		t.Error("report_to_core should be removed from ToolArgumentsByName")
	}
	if args, exists := result.ToolArgumentsByName["external_search"]; !exists || len(args) == 0 {
		t.Error("external_search should remain in ToolArgumentsByName")
	}

	reports := avatar.GetReports()
	if len(reports) != 1 {
		t.Fatalf("expected 1 report, got %d", len(reports))
	}
}

func TestBuildReportToolDefinition(t *testing.T) {
	tool := BuildReportToolDefinition()
	if tool.Type != "function" {
		t.Errorf("tool.Type = %q, want function", tool.Type)
	}
	if tool.Function == nil {
		t.Fatal("tool.Function is nil")
	}
	if tool.Function.Name != "report_to_core" {
		t.Errorf("tool.Function.Name = %q, want report_to_core", tool.Function.Name)
	}
	if tool.Function.Description == "" {
		t.Error("tool.Function.Description should not be empty")
	}

	params, ok := tool.Function.Parameters.(map[string]interface{})
	if !ok {
		t.Fatal("Parameters should be a map")
	}
	props, ok := params["properties"].(map[string]interface{})
	if !ok {
		t.Fatal("properties should be a map")
	}
	for _, field := range []string{"type", "environment", "lessons"} {
		if _, exists := props[field]; !exists {
			t.Errorf("required field %q missing from properties", field)
		}
	}

	if _, exists := params["required"]; !exists {
		t.Error("required field missing from parameters")
	}

	typProp := props["type"].(map[string]interface{})
	enumRaw := typProp["enum"]
	var enumVals []string
	switch e := enumRaw.(type) {
	case []interface{}:
		for _, v := range e {
			enumVals = append(enumVals, v.(string))
		}
	case []string:
		enumVals = e
	default:
		t.Fatalf("unexpected enum type: %T", enumRaw)
	}
	hasHeartbeat := false
	for _, v := range enumVals {
		if v == "heartbeat" {
			hasHeartbeat = true
		}
	}
	if !hasHeartbeat {
		t.Error("type enum should contain heartbeat")
	}
}

func TestParseReportPayloads(t *testing.T) {
	tests := []struct {
		name     string
		rawArgs  []string
		wantLen  int
		wantType ReportType
	}{
		{
			name:     "heartbeat",
			rawArgs:  []string{`{"type":"heartbeat","environment":"test","lessons":"ok"}`},
			wantLen:  1,
			wantType: ReportTypeHeartbeat,
		},
		{
			name:     "progress",
			rawArgs:  []string{`{"type":"progress","environment":"dev","lessons":"learning"}`},
			wantLen:  1,
			wantType: ReportTypeProgress,
		},
		{
			name:     "risk",
			rawArgs:  []string{`{"type":"risk","environment":"prod","lessons":"issue-detected","urgency":"high"}`},
			wantLen:  1,
			wantType: ReportTypeRisk,
		},
		{
			name:     "summary with all fields",
			rawArgs:  []string{`{"type":"summary","environment":"deploy","lessons":"done","content":"all good","urgency":"low"}`},
			wantLen:  1,
			wantType: ReportTypeSummary,
		},
		{
			name:     "invalid json is skipped",
			rawArgs:  []string{`not-json`, `{"type":"heartbeat","environment":"t","lessons":"t"}`},
			wantLen:  1,
			wantType: ReportTypeHeartbeat,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			events := parseReportPayloads(tt.rawArgs)
			if len(events) != tt.wantLen {
				t.Fatalf("got %d events, want %d", len(events), tt.wantLen)
			}
			if tt.wantLen > 0 && events[0].Payload.Type != tt.wantType {
				t.Errorf("event type = %v, want %v", events[0].Payload.Type, tt.wantType)
			}
		})
	}
}

func TestAvatarProcessMessage_Destroyed(t *testing.T) {
	avatar, _ := newTestAvatar(AvatarConfig{
		AvatarRoleID: "test", Channel: AvatarChannelUnknown, SystemPrompt: "test",
	})
	avatar.Destroy()

	_, err := avatar.ProcessMessage(context.Background(), "hello")
	if err == nil {
		t.Error("ProcessMessage should fail on destroyed avatar")
	}
}

func TestAvatarProcessMessage_OnlyInternalTools(t *testing.T) {
	heartbeatArgs := `{"type":"heartbeat","environment":"bg","lessons":"nothing"}`

	callCount := 0
	mock := &mockStreamClient{
		chunksFn: func() []types.StreamChunk {
			callCount++
			if callCount == 1 {
				// 第一次调用：仅返回 report_to_core，无内容
				return []types.StreamChunk{
					buildToolCallChunk(0, "call_hb", "report_to_core", heartbeatArgs),
					buildFinishChunk(),
				}
			}
			// 第二次调用：返回内容
			return []types.StreamChunk{
				buildContentChunk("ok"),
				buildFinishChunk(),
			}
		},
	}

	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID: "test", AvatarNumber: 1,
		Channel: AvatarChannelUnknown, SystemPrompt: "test",
	}, mock)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	result, err := avatar.ProcessMessage(context.Background(), "ping")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}
	if result.Content != "ok" {
		t.Errorf("Content = %q, want 'ok' (from retry)", result.Content)
	}

	reports := avatar.GetReports()
	if len(reports) != 1 {
		t.Fatalf("expected 1 report, got %d", len(reports))
	}
}

func TestReportPayload_JSONRoundTrip(t *testing.T) {
	payload := ReportPayload{
		Type:        ReportTypeHeartbeat,
		Environment: "production",
		Lessons:     "stable",
		Content:     "all systems operational",
		Urgency:     ReportUrgencyLow,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("Marshal error = %v", err)
	}

	var decoded ReportPayload
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal error = %v", err)
	}

	if decoded.Type != ReportTypeHeartbeat {
		t.Errorf("type = %v, want heartbeat", decoded.Type)
	}
	if decoded.Environment != "production" {
		t.Errorf("environment = %q, want production", decoded.Environment)
	}
	if decoded.Lessons != "stable" {
		t.Errorf("lessons = %q, want stable", decoded.Lessons)
	}
	if decoded.Content != "all systems operational" {
		t.Errorf("content = %q, want all systems operational", decoded.Content)
	}
	if decoded.Urgency != ReportUrgencyLow {
		t.Errorf("urgency = %v, want low", decoded.Urgency)
	}
}
