package dummysys

import (
	"context"
	"testing"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// mockLLMClient is a mock implementation of llm.Client for testing
type mockLLMClient struct{}

func (m *mockLLMClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk)
	close(ch)
	return ch, nil
}

func (m *mockLLMClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (string, error) {
	return "mock response", nil
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

	// Test idle -> active
	if avatar.GetState() != AvatarStateIdle {
		t.Errorf("Initial state = %v, want %v", avatar.GetState(), AvatarStateIdle)
	}

	avatar.SetState(AvatarStateActive)
	if avatar.GetState() != AvatarStateActive {
		t.Errorf("After SetState(Active) state = %v, want %v", avatar.GetState(), AvatarStateActive)
	}

	// Test active -> idle
	avatar.SetState(AvatarStateIdle)
	if avatar.GetState() != AvatarStateIdle {
		t.Errorf("After SetState(Idle) state = %v, want %v", avatar.GetState(), AvatarStateIdle)
	}

	// Test destroy
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

	// Initially no timeout
	if avatar.CheckHeartbeatTimeout() {
		t.Error("CheckHeartbeatTimeout() = true, want false initially")
	}

	// Simulate rounds without heartbeat
	for i := 0; i < 5; i++ {
		avatar.roundsSinceMetaReport++
	}

	// Should timeout now
	if !avatar.CheckHeartbeatTimeout() {
		t.Error("CheckHeartbeatTimeout() = false, want true after 5 rounds")
	}

	// Simulate report_to_core(type="heartbeat") tool call
	result := &types.StreamResult{
		HasToolCalls: true,
		ToolArgumentsByName: map[string][]string{
			"report_to_core": {`{"type":"heartbeat","content":"still alive","urgency":"low"}`},
		},
	}
	avatar.parseToolCallsForHeartbeat(result)

	// Should reset after heartbeat
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

	// Initial context should have system prompt
	ctx := avatar.GetContext()
	if len(ctx) != 1 {
		t.Errorf("Initial context length = %v, want 1", len(ctx))
	}
	if ctx[0].Role != "system" {
		t.Errorf("Initial context role = %v, want system", ctx[0].Role)
	}

	// Add user message
	avatar.AddToContext(types.ContextMessage{
		Role:    "user",
		Content: "Hello",
	})
	ctx = avatar.GetContext()
	if len(ctx) != 2 {
		t.Errorf("Context length after AddToContext = %v, want 2", len(ctx))
	}

	// Add assistant message
	avatar.AddToContext(types.ContextMessage{
		Role:    "assistant",
		Content: "Hi there",
	})
	ctx = avatar.GetContext()
	if len(ctx) != 3 {
		t.Errorf("Context length after second AddToContext = %v, want 3", len(ctx))
	}
}
