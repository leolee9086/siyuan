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
