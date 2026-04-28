package dummysys

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
)

const (
	liveEnvKey      = "DUMMYSYS_LIVE"
	apiKeyEnvKey    = "DUMMYSYS_API_KEY"
	modelEnvKey     = "DUMMYSYS_MODEL"
	baseURLEnvKey   = "DUMMYSYS_BASE_URL"
	providerEnvKey  = "DUMMYSYS_PROVIDER"
)

func getLiveConfig(t *testing.T) (string, string, string, string) {
	t.Helper()
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
		t.Skip("DUMMYSYS_API_KEY is required for live test")
	}
	if model == "" {
		t.Skip("DUMMYSYS_MODEL is required for live test")
	}
	return apiKey, model, baseURL, provider
}

func buildHeartbeatSystemPrompt() string {
	return `你是 Avatar 回报机制测试实例。每次处理消息你必须按以下顺序严格执行：

步骤1 - 回复用户：用一句话自然回复用户的消息。
步骤2 - 回报：调用 report_to_core(type="heartbeat", environment="测试", lessons="正常运行中")

两个步骤都必须执行，缺一不可。先回复，再回报。`
}

func buildProgressSystemPrompt() string {
	return `你是 Avatar 多类型回报测试实例。
规则：
1. 回复用户的内容要简洁
2. 每次处理消息后，你必须依次调用 report_to_core：
   - 第一次调用：type="heartbeat", environment="starting", lessons="begin"
   - 第二次调用：type="progress", environment="working", lessons="in-progress", urgency="low"
3. 确认指令后，直接回复用户。`
}

// TestLiveAvatar_ReportToCoreIsIntercepted 验证真实LLM调用report_to_core时，
// Avatar正确拦截并剥离，外部调用者只看到干净的响应。
func TestLiveAvatar_ReportToCoreIsIntercepted(t *testing.T) {
	apiKey, model, baseURL, provider := getLiveConfig(t)

	cfg := &llm.Config{
		Provider:    provider,
		APIKey:      apiKey,
		APIBaseURL:  baseURL,
		APIModel:    model,
		MaxTokens:   1024,
		Temperature: 0.3,
		Timeout:     60,
	}
	client := llm.NewClient(cfg)
	if client == nil {
		t.Fatal("llm.NewClient returned nil")
	}

	reportCh := make(chan ReportEvent, 10)
	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID:            "live-test-avatar",
		AvatarNumber:            1,
		Channel:                 AvatarChannelUnknown,
		SystemPrompt:            buildHeartbeatSystemPrompt(),
		ExposureMode:            ExposureModeFull,
		HeartbeatIntervalRounds: 3,
		ReportCallback: func(ev ReportEvent) {
			reportCh <- ev
		},
	}, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := avatar.ProcessMessage(ctx, "你好，请确认你在线。")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}

	t.Logf("Avatar response content: %q", result.Content)
	t.Logf("HasToolCalls: %v", result.HasToolCalls)
	t.Logf("ToolCallNames: %v", result.ToolCallNames)

	if strings.TrimSpace(result.Content) == "" {
		t.Error("result.Content should not be empty")
	}

	if result.HasToolCalls {
		t.Errorf("HasToolCalls should be false (report_to_core was stripped), got true with names=%v", result.ToolCallNames)
	}
	for _, name := range result.ToolCallNames {
		if name == ReportToolName {
			t.Error("report_to_core should NOT be visible in ToolCallNames")
		}
	}
	if _, exists := result.ToolArgumentsByName[ReportToolName]; exists {
		t.Error("report_to_core should NOT be visible in ToolArgumentsByName")
	}

	select {
	case report := <-reportCh:
		t.Logf("ReportCallback received: type=%s env=%q", report.Payload.Type, report.Payload.Environment)
		if report.Payload.Type != ReportTypeHeartbeat {
			t.Errorf("expected heartbeat report, got %s", report.Payload.Type)
		}
		t.Logf("SUCCESS: report_to_core was called by LLM and intercepted by Avatar")
	case <-time.After(5 * time.Second):
		t.Fatal("ReportCallback was not called within 5s — LLM did not invoke report_to_core")
	}
}

// TestLiveAvatar_HeartbeatTimeoutReset 验证心跳超时计数在真实LLM回报后被正确重置。
func TestLiveAvatar_HeartbeatTimeoutReset(t *testing.T) {
	apiKey, model, baseURL, provider := getLiveConfig(t)

	cfg := &llm.Config{
		Provider:    provider,
		APIKey:      apiKey,
		APIBaseURL:  baseURL,
		APIModel:    model,
		MaxTokens:   1024,
		Temperature: 0.3,
		Timeout:     60,
	}
	client := llm.NewClient(cfg)

	reportCh := make(chan ReportEvent, 10)
	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID:            "live-test-heartbeat",
		AvatarNumber:            1,
		Channel:                 AvatarChannelGuardian,
		SystemPrompt:            buildHeartbeatSystemPrompt(),
		ExposureMode:            ExposureModeFull,
		HeartbeatIntervalRounds: 3,
		ReportCallback: func(ev ReportEvent) {
			reportCh <- ev
		},
	}, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	for i := 0; i < 3; i++ {
		msg := fmt.Sprintf("第 %d 轮测试消息", i+1)
		result, err := avatar.ProcessMessage(ctx, msg)
		if err != nil {
			t.Fatalf("round %d ProcessMessage() error = %v", i, err)
		}
		t.Logf("Round %d: content=%q hasTools=%v", i+1, result.Content, result.HasToolCalls)

		select {
		case <-reportCh:
		case <-time.After(10 * time.Second):
			t.Fatalf("round %d: ReportCallback not called within 10s", i+1)
		}

		t.Logf("Round %d: roundsSinceMetaReport=%d", i+1, avatar.GetRoundsSinceMetaReport())
	}

	if avatar.CheckHeartbeatTimeout() {
		t.Error("CheckHeartbeatTimeout() = true after 3 rounds with heartbeats")
	}
	if avatar.GetRoundsSinceMetaReport() > 0 {
		t.Errorf("roundsSinceMetaReport should be reset to 0 after each round, got %d",
			avatar.GetRoundsSinceMetaReport())
	}

	totalReports := len(avatar.GetReports())
	if totalReports < 3 {
		t.Errorf("expected at least 3 reports, got %d", totalReports)
	}

	t.Logf("SUCCESS: Heartbeat correctly reset after %d rounds", 3)
}

// TestLiveAvatar_TransparentToCaller 验证外部调用者看到的响应格式
// 与普通LLM响应完全一致（无内部工具调用痕迹）。
func TestLiveAvatar_TransparentToCaller(t *testing.T) {
	apiKey, model, baseURL, provider := getLiveConfig(t)

	cfg := &llm.Config{
		Provider:    provider,
		APIKey:      apiKey,
		APIBaseURL:  baseURL,
		APIModel:    model,
		MaxTokens:   1024,
		Temperature: 0.3,
		Timeout:     60,
	}
	client := llm.NewClient(cfg)

	reportCh := make(chan ReportEvent, 10)
	avatar, err := NewAvatar(AvatarConfig{
		AvatarRoleID:            "live-test-transparent",
		AvatarNumber:            1,
		Channel:                 AvatarChannelUnknown,
		SystemPrompt:            buildHeartbeatSystemPrompt(),
		ExposureMode:            ExposureModeFull,
		HeartbeatIntervalRounds: 5,
		ReportCallback: func(ev ReportEvent) {
			reportCh <- ev
		},
	}, client)
	if err != nil {
		t.Fatalf("NewAvatar() error = %v", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := avatar.ProcessMessage(ctx, "请用一句话介绍你自己。")
	if err != nil {
		t.Fatalf("ProcessMessage() error = %v", err)
	}

	if result.Content == "" {
		t.Error("result.Content should not be empty (transparent to caller)")
	}

	if result.HasToolCalls {
		t.Error("result should not expose internal tools to caller")
	}

	t.Logf("Caller sees (transparent): %q", result.Content)

	select {
	case report := <-reportCh:
		t.Logf("But internally, report_to_core was called: type=%s environment=%q",
			report.Payload.Type, report.Payload.Environment)
	case <-time.After(10 * time.Second):
		t.Log("No report received within timeout — LLM may not have called report_to_core")
	}
}
