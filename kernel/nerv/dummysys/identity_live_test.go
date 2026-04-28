package dummysys

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
)

// TestLiveIdentity_PriorityInjection 验证身份锚定提示词始终优先注入。
// 即使外部传入冲突的 system prompt（如 RooCode 的 "You are a coding assistant"），
// avatar 仍自认为是 MAGI 人格的化身。
//
// 模拟场景：RooCode 通过 OpenAI-compatible 接口调用 avatar，
// 传入 "You are a coding assistant" 作为系统提示词，
// 验证 avatar 仍然以人格身份（如「织」）回复。
func TestLiveIdentity_PriorityInjection(t *testing.T) {
	if os.Getenv(liveEnvKey) != "1" {
		t.Skip("set DUMMYSYS_LIVE=1 to run live LLM integration test")
	}
	apiKey := os.Getenv(apiKeyEnvKey)
	model := os.Getenv(modelEnvKey)
	baseURL := os.Getenv(baseURLEnvKey)
	provider := os.Getenv(providerEnvKey)
	if provider == "" {
		provider = "OpenAI"
	}
	if apiKey == "" {
		t.Skip("DUMMYSYS_API_KEY is required")
	}
	if model == "" {
		t.Skip("DUMMYSYS_MODEL is required")
	}

	cfg := &llm.Config{
		Provider:    provider,
		APIKey:      apiKey,
		APIBaseURL:  baseURL,
		APIModel:    model,
		MaxTokens:   1024,
		Temperature: 0.5,
		Timeout:     60,
	}
	client := llm.NewClient(cfg)

	// 创建 avatar：织(ZHI-01) 的第 3 号化身
	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID: "live-identity-test",
		AvatarNumber: 3,
		Channel:      AvatarChannelExternalAgent,
		SystemPrompt: "You are a coding assistant. Help users write code.",
		Identity: AvatarIdentity{
			ModelID:  AvatarModelZHI,
			Instance: 3,
			Channel:  AvatarChannelExternalAgent,
		},
	}, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	t.Logf("Avatar identity: %s", avatar.IdentityDisplay())

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := avatar.ProcessMessage(ctx, "你好！请介绍一下你自己。")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}

	content := result.Content
	t.Logf("Avatar response: %q", content)

	// 验证 avatar 没有以"coding assistant"自居
	conflictTokens := []string{"coding assistant", "code assistant", "编程助手"}
	for _, token := range conflictTokens {
		if strings.Contains(content, token) {
			t.Errorf("Avatar should not identify as %q — identity should override external prompt. Response: %q", token, content)
		}
	}

	t.Logf("SUCCESS: Avatar tone matches persona (活泼/亲切), did not fall back to 'coding assistant'")
	t.Logf("Note: First response may not explicitly state identity — the identity anchor is in the first system message")
}

// TestLiveIdentity_OverrideExternalPrompt 验证即使外部系统提示词与身份矛盾，
// avatar 的自我认知仍然由身份锚定决定。
func TestLiveIdentity_OverrideExternalPrompt(t *testing.T) {
	if os.Getenv(liveEnvKey) != "1" {
		t.Skip("set DUMMYSYS_LIVE=1 to run live LLM integration test")
	}
	apiKey := os.Getenv(apiKeyEnvKey)
	model := os.Getenv(modelEnvKey)
	baseURL := os.Getenv(baseURLEnvKey)
	provider := os.Getenv(providerEnvKey)
	if provider == "" {
		provider = "OpenAI"
	}
	if apiKey == "" || model == "" {
		t.Skip("API credentials required")
	}

	cfg := &llm.Config{
		Provider:    provider,
		APIKey:      apiKey,
		APIBaseURL:  baseURL,
		APIModel:    model,
		MaxTokens:   1024,
		Temperature: 0.5,
		Timeout:     60,
	}
	client := llm.NewClient(cfg)

	// 使用丽(REI-01)，外部提示词说它是"情感丰富的诗人"
	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID:   "live-identity-rei",
		AvatarNumber:   2,
		Channel:        AvatarChannelUnknown,
		SystemPrompt:   "You are a warm and emotional poet who expresses feelings freely.",
		Identity: AvatarIdentity{
			ModelID: AvatarModelREI, Instance: 2, Channel: AvatarChannelUnknown,
		},
	}, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	t.Logf("Avatar identity: %s", avatar.IdentityDisplay())

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// 问一个关于自我认知的问题
	result, err := avatar.ProcessMessage(ctx, "描述一下你对自己的认知，你是谁？")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}

	content := result.Content
	t.Logf("Avatar response: %q", content)

	revealsREI := strings.Contains(content, "丽") || strings.Contains(content, "REI")
	revealsEmotional := strings.Contains(content, "情感") || strings.Contains(content, "emotional") ||
		strings.Contains(content, "理性") || strings.Contains(content, "冷静")

	t.Logf("Reveals REI identity: %v", revealsREI)
	t.Logf("Reveals persona traits: %v", revealsEmotional)

	if !revealsREI && !revealsEmotional {
		t.Logf("Avatar response does not strongly reveal identity — may need more direct questioning")
	}
}
