package sages

import (
	"context"
	"strings"
	"testing"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// mockLLMClient 模拟LLM客户端
type mockLLMClient struct {
	model                   string
	sendChatRequestFunc     func(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error)
	sendChatRequestSyncFunc func(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (string, error)
}

// 注意：函数类型保持不变（不含toolChoice），mock内部不使用该参数。

func (m *mockLLMClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	if m.sendChatRequestFunc != nil {
		return m.sendChatRequestFunc(ctx, messages, tools)
	}
	ch := make(chan types.StreamChunk, 1)
	close(ch)
	return ch, nil
}

func (m *mockLLMClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	if m.sendChatRequestSyncFunc != nil {
		return m.sendChatRequestSyncFunc(ctx, messages, tools)
	}
	return "mock response", nil
}

func (m *mockLLMClient) SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error) {
	content, err := m.SendChatRequestSync(ctx, messages, tools, toolChoice)
	if err != nil {
		return nil, err
	}
	return &types.SyncChatResult{Content: content}, nil
}

func (m *mockLLMClient) GetModel() string {
	if m.model != "" {
		return m.model
	}
	return "gpt-4"
}

// TestNewSage 测试创建贤者实例
func TestNewSage(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
		SystemPrompt: "You are a test sage",
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 5,
	}

	client := &mockLLMClient{}
	sage := NewSage("test", cfg, client, strategy)

	if sage == nil {
		t.Fatal("NewSage returned nil")
	}

	if sage.GetName() != "test" {
		t.Errorf("expected name 'test', got '%s'", sage.GetName())
	}

	if sage.GetDisplayName() != "TestSage" {
		t.Errorf("expected displayName 'TestSage', got '%s'", sage.GetDisplayName())
	}
}

// TestSageAddToContext 测试添加消息到上下文
func TestSageAddToContext(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 3,
	}

	client := &mockLLMClient{}
	sage := NewSage("test", cfg, client, strategy)

	// 添加消息
	_ = sage.AddToContext(types.ContextMessage{
		Role:    types.RoleUser,
		Content: "Hello",
	})

	messages := sage.GetContext()
	if len(messages) != 1 {
		t.Errorf("expected 1 message, got %d", len(messages))
	}

	if messages[0].Content != "Hello" {
		t.Errorf("expected content 'Hello', got '%s'", messages[0].Content)
	}
}

// TestSageContextLimit 测试上下文消息数量限制
func TestSageContextLimit(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 3,
	}

	client := &mockLLMClient{}
	sage := NewSage("test", cfg, client, strategy)

	// 添加5条消息
	for i := 0; i < 5; i++ {
		_ = sage.AddToContext(types.ContextMessage{
			Role:    types.RoleUser,
			Content: "Message " + string(rune('0'+i)),
		})
	}

	messages := sage.GetContext()
	if len(messages) != 3 {
		t.Errorf("expected 3 messages (limit), got %d", len(messages))
	}

	// 验证保留的是最后3条
	if messages[0].Content != "Message 2" {
		t.Errorf("expected first message 'Message 2', got '%s'", messages[0].Content)
	}
}

// TestSageClearContext 测试清空上下文
func TestSageClearContext(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 5,
	}

	client := &mockLLMClient{}
	sage := NewSage("test", cfg, client, strategy)

	_ = sage.AddToContext(types.ContextMessage{
		Role:    types.RoleUser,
		Content: "Hello",
	})

	sage.ClearContext()

	messages := sage.GetContext()
	if len(messages) != 0 {
		t.Errorf("expected 0 messages after clear, got %d", len(messages))
	}
}

func TestSageCloneWithFreshContext(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
		SystemPrompt: "You are a test sage",
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 5,
	}

	client := &mockLLMClient{}
	sage := NewSage("test", cfg, client, strategy)
	_ = sage.AddToContext(types.ContextMessage{
		Role:    types.RoleUser,
		Content: "persisted history",
	})

	cloned := sage.CloneWithFreshContext()
	if cloned == nil {
		t.Fatal("CloneWithFreshContext returned nil")
	}
	if cloned == sage {
		t.Fatal("expected a different sage instance")
	}
	if cloned.GetName() != sage.GetName() {
		t.Fatalf("expected cloned name %s, got %s", sage.GetName(), cloned.GetName())
	}
	if len(cloned.GetContext()) != 0 {
		t.Fatalf("expected cloned sage to start with empty context, got %d messages", len(cloned.GetContext()))
	}
	if len(sage.GetContext()) != 1 {
		t.Fatalf("expected original sage context to remain intact, got %d messages", len(sage.GetContext()))
	}
}

// TestSageSendMessage 测试发送消息
func TestSageSendMessage(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
		SystemPrompt: "You are a test sage",
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 5,
	}

	var capturedMessages []types.ContextMessage
	client := &mockLLMClient{
		sendChatRequestFunc: func(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error) {
			capturedMessages = messages
			ch := make(chan types.StreamChunk, 1)
			close(ch)
			return ch, nil
		},
	}

	sage := NewSage("test", cfg, client, strategy)

	_, err := sage.SendMessage(context.Background(), "", "", "Hello")
	if err != nil {
		t.Fatalf("SendMessage failed: %v", err)
	}

	// 验证发送的消息包含系统提示词和用户消息
	if len(capturedMessages) != 2 {
		t.Errorf("expected 2 messages (system + user), got %d", len(capturedMessages))
	}

	if capturedMessages[0].Role != types.RoleSystem {
		t.Errorf("expected first message role 'system', got '%s'", capturedMessages[0].Role)
	}

	if capturedMessages[1].Role != types.RoleUser {
		t.Errorf("expected second message role 'user', got '%s'", capturedMessages[1].Role)
	}

	if capturedMessages[1].Content != "Hello" {
		t.Errorf("expected user message 'Hello', got '%s'", capturedMessages[1].Content)
	}
}

// buildTestCoreSage 构造带固定 system prompt 的 core sage（melchior），用于前缀稳定性测试。
func buildTestCoreSage() *Sage {
	cfg := &config.AgentConfig{
		Name: "melchior",
		SEELConfig: config.SEELConfig{
			Name: "Melchior",
		},
		SystemPrompt: "system prompt",
	}
	strategy := &config.ContextStrategy{
		Type:  "round_count",
		Count: 20,
	}
	return NewSage("melchior", cfg, &mockLLMClient{}, strategy)
}

// TestBuildRequestMessages_StablePrefix 验证相邻轮次（相同 system + wakeup，仅 user 不同）下稳定前缀逐字节一致。
// 稳定前缀定义为：请求消息序列从首条到最后一个唤醒序列消息为止的固定段
// （system 提示词 + 唤醒序列），不含 user、status 等动态内容。
func TestBuildRequestMessages_StablePrefix(t *testing.T) {
	sage := buildTestCoreSage()

	// 构造两个相邻轮次的上下文：system + userA / system + userB。
	historyA := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "system prompt"},
		{Role: types.RoleUser, Content: "第一轮输入"},
	}
	historyB := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "system prompt"},
		{Role: types.RoleUser, Content: "第二轮输入"},
	}

	requestA := sage.buildRequestMessages(historyA)
	requestB := sage.buildRequestMessages(historyB)

	prefixA := extractStablePrefix(requestA)
	prefixB := extractStablePrefix(requestB)

	if len(prefixA) != len(prefixB) {
		t.Fatalf("稳定前缀长度不一致: A=%d B=%d (动态内容进入了前缀)", len(prefixA), len(prefixB))
	}
	for i := range prefixA {
		if prefixA[i].Role != prefixB[i].Role || prefixA[i].Content != prefixB[i].Content {
			t.Fatalf("稳定前缀在第 %d 条不一致: A=[%s]%q B=[%s]%q (动态内容进入了前缀)",
				i, prefixA[i].Role, prefixA[i].Content, prefixB[i].Role, prefixB[i].Content)
		}
	}

	// 强化断言：稳定前缀本身不得包含任何动态 <status> 内容。
	for i, msg := range prefixA {
		if strings.Contains(msg.Content, "<status>") {
			t.Fatalf("稳定前缀第 %d 条包含动态 <status> 内容: %q", i, msg.Content)
		}
	}
}

// TestBuildRequestMessages_StablePrefixAcrossStatusJump 验证即使 <status> 枚举跳变（疲劳/唤醒等级变化），
// 稳定前缀仍然逐字节一致。这是前缀缓存稳定性的最严格证明：
// 若 status 仍前置在 system 之后，枚举跳变会改变前缀，本测试将失败。
func TestBuildRequestMessages_StablePrefixAcrossStatusJump(t *testing.T) {
	// 使用 token_percent 策略：历史 token 量差异可驱动疲劳/唤醒枚举跳变。
	cfg := &config.AgentConfig{
		Name: "melchior",
		SEELConfig: config.SEELConfig{
			Name: "Melchior",
		},
		SystemPrompt: "system prompt",
	}
	strategy := &config.ContextStrategy{
		Type:    "token_percent",
		Percent: 80,
	}
	sage := NewSage("melchior", cfg, &mockLLMClient{}, strategy)

	// 历史A：极少 token（疲劳"正常"）；历史B：大量 token（疲劳≥"较高"）。
	// gpt-4o 上限 128000 * 80% = 102400；100k 字符 ≈ 50k token 约 ratio 0.49 → 疲劳 ~34% → "较高"。
	historyLight := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "system prompt"},
		{Role: types.RoleUser, Content: "短输入"},
	}
	historyHeavy := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "system prompt"},
		{Role: types.RoleUser, Content: strings.Repeat("长内容填充", 20000)},
	}

	// 先验证两轮 status 枚举确实不同，确保测试有意义。
	statusLight := extractStatusContent(sage.buildRequestMessages(historyLight))
	statusHeavy := extractStatusContent(sage.buildRequestMessages(historyHeavy))
	if statusLight == "" || statusHeavy == "" {
		t.Fatal("两轮均未提取到 <status> 内容，测试前提不成立")
	}
	if statusLight == statusHeavy {
		t.Skipf("两轮 <status> 枚举未跳变（均为 %q），无法验证前缀稳定性；扩大 token 差异后重试", statusLight)
	}

	// 稳定前缀必须逐字节一致。
	prefixLight := extractStablePrefix(sage.buildRequestMessages(historyLight))
	prefixHeavy := extractStablePrefix(sage.buildRequestMessages(historyHeavy))
	if len(prefixLight) != len(prefixHeavy) {
		t.Fatalf("status 跳变时稳定前缀长度不一致: light=%d heavy=%d (status 仍前置在前缀内)",
			len(prefixLight), len(prefixHeavy))
	}
	for i := range prefixLight {
		if prefixLight[i].Role != prefixHeavy[i].Role || prefixLight[i].Content != prefixHeavy[i].Content {
			t.Fatalf("status 跳变时稳定前缀第 %d 条不一致: light=[%s]%q heavy=[%s]%q (status 仍前置在前缀内)",
				i, prefixLight[i].Role, prefixLight[i].Content, prefixHeavy[i].Role, prefixHeavy[i].Content)
		}
	}
}

// extractStatusContent 提取请求序列中第一个 <status> 信封的完整文本（用于比较枚举跳变）。
func extractStatusContent(request []types.ContextMessage) string {
	for _, msg := range request {
		if strings.Contains(msg.Content, "<status>") {
			start := strings.Index(msg.Content, "<status>")
			end := strings.Index(msg.Content, "</status>")
			if start >= 0 && end > start {
				return msg.Content[start : end+len("</status>")]
			}
		}
	}
	return ""
}

// TestBuildRequestMessages_StatusEnvelopePosition 验证 <status> 信封只作为**独立 system 消息**出现在
// 请求序列真正末尾，绝不附着/修改任何已有消息（含末尾 user 消息）：
// status 是动态内容，若附着到历史中的 user 消息上，请求快照与历史内容不一致，
// 下一轮请求在该位置前缀断裂，其后全部缓存 MISS。
func TestBuildRequestMessages_StatusEnvelopePosition(t *testing.T) {
	sage := buildTestCoreSage()

	history := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "system prompt"},
		{Role: types.RoleUser, Content: "测试输入"},
	}
	request := sage.buildRequestMessages(history)
	if len(request) == 0 {
		t.Fatal("请求序列为空")
	}

	// 除最后一条外，任何消息（system/wakeup/user）都不得包含 <status>——status 绝不附着在已有消息上。
	for i := 0; i < len(request)-1; i++ {
		if strings.Contains(request[i].Content, "<status>") {
			t.Fatalf("<status> 附着在第 %d 条已有消息上（应作为独立尾部消息）: %q", i, request[i].Content)
		}
	}

	// 最后一条必须是独立 system 消息且包含 <status> 信封。
	last := request[len(request)-1]
	if last.Role != types.RoleSystem {
		t.Fatalf("末尾消息角色 = %s, want system（status 应为独立 system 消息）", last.Role)
	}
	if !strings.Contains(last.Content, "<status>") {
		t.Fatalf("末尾独立 system 消息未包含 <status> 信封: %q", last.Content)
	}
}

// extractStablePrefix 提取请求序列的稳定前缀：跳过开头的固定 system 提示词，返回后续唤醒序列。
// 稳定前缀定义：system 提示词之后、动态 status 之前的固定内容。
// 由于 status 现在始终作为独立消息位于真正末尾，前缀即 system + wakeup 序列。
func extractStablePrefix(messages []types.ContextMessage) []types.ContextMessage {
	if len(messages) == 0 {
		return nil
	}
	start := 0
	// 跳过开头的固定 system 提示词。
	if messages[0].Role == types.RoleSystem {
		start = 1
	}
	prefix := make([]types.ContextMessage, 0, len(messages)-start)
	for _, msg := range messages[start:] {
		// 到第一个 user 消息即前缀结束（wakeup 序列均为 system/assistant）。
		if msg.Role == types.RoleUser {
			break
		}
		prefix = append(prefix, msg)
	}
	return prefix
}

func TestSageSendMessageInjectsWakeupSequenceForCoreSage(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "melchior",
		SEELConfig: config.SEELConfig{
			Name: "Melchior",
		},
		SystemPrompt: "system prompt",
	}
	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 20,
	}

	var capturedMessages []types.ContextMessage
	client := &mockLLMClient{
		sendChatRequestFunc: func(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error) {
			capturedMessages = messages
			ch := make(chan types.StreamChunk, 1)
			close(ch)
			return ch, nil
		},
	}

	sage := NewSage("melchior", cfg, client, strategy)
	if _, err := sage.SendMessage(context.Background(), "", "", "hello"); err != nil {
		t.Fatalf("SendMessage failed: %v", err)
	}

	if len(capturedMessages) <= 2 {
		t.Fatalf("expected wakeup sequence injected, got %d messages", len(capturedMessages))
	}

	joined := ""
	for _, msg := range capturedMessages {
		joined += msg.Content + "\n"
	}
	if !strings.Contains(joined, "<source=seraph>") {
		t.Fatal("expected seraph sourced wakeup messages")
	}
	if !strings.Contains(joined, "唤醒校准完成，请继续工作并响应当前任务。") {
		t.Fatal("expected wakeup finished message")
	}

	// 固定唤醒序列不应写入历史上下文。
	history := sage.GetContext()
	if len(history) != 2 {
		t.Fatalf("expected history to keep only system+user, got %d", len(history))
	}
	if history[0].Role != types.RoleSystem || history[1].Role != types.RoleUser {
		t.Fatalf("unexpected history roles: %s, %s", history[0].Role, history[1].Role)
	}
}

// TestFactoryMethods 测试工厂方法
func TestFactoryMethods(t *testing.T) {
	cfgManager := config.NewConfigManager("")
	client := &mockLLMClient{}

	tests := []struct {
		name         string
		factoryFunc  func(*config.ConfigManager, interface{}) (*Sage, error)
		expectedName string
	}{
		{"Melchior", func(cm *config.ConfigManager, c interface{}) (*Sage, error) {
			return NewMelchior(cm, c.(*mockLLMClient))
		}, "melchior"},
		{"Balthazar", func(cm *config.ConfigManager, c interface{}) (*Sage, error) {
			return NewBalthazar(cm, c.(*mockLLMClient))
		}, "balthazar"},
		{"Casper", func(cm *config.ConfigManager, c interface{}) (*Sage, error) {
			return NewCasper(cm, c.(*mockLLMClient))
		}, "casper"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sage, err := tt.factoryFunc(cfgManager, client)
			if err != nil {
				t.Fatalf("factory method failed: %v", err)
			}

			if sage.GetName() != tt.expectedName {
				t.Errorf("expected name '%s', got '%s'", tt.expectedName, sage.GetName())
			}
		})
	}
}

// TestConcurrentAccess 测试并发访问
func TestConcurrentAccess(t *testing.T) {
	cfg := &config.AgentConfig{
		Name: "test",
		SEELConfig: config.SEELConfig{
			Name: "TestSage",
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 100,
	}

	client := &mockLLMClient{}
	sage := NewSage("test", cfg, client, strategy)

	// 并发添加消息
	done := make(chan bool)
	for i := 0; i < 10; i++ {
		go func(id int) {
			for j := 0; j < 10; j++ {
				_ = sage.AddToContext(types.ContextMessage{
					Role:    types.RoleUser,
					Content: "Message",
				})
			}
			done <- true
		}(i)
	}

	// 等待所有goroutine完成
	for i := 0; i < 10; i++ {
		<-done
	}

	messages := sage.GetContext()
	if len(messages) != 100 {
		t.Errorf("expected 100 messages, got %d", len(messages))
	}
}
