package coordinator

import (
	"context"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// mockLLMClient 模拟LLM客户端
type mockLLMClient struct {
	responseContent string
	shouldFail      bool
	delay           time.Duration
	hasToolCall     bool
	toolCallArgs    string
}

func (m *mockLLMClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk, 10)

	go func() {
		defer close(ch)

		if m.delay > 0 {
			select {
			case <-time.After(m.delay):
			case <-ctx.Done():
				return
			}
		}

		if m.shouldFail {
			// 失败情况：不发送任何chunk，直接关闭
			return
		}

		// 发送内容chunk
		if m.responseContent != "" {
			ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							Content: m.responseContent,
						},
					},
				},
			}
		}

		// 发送工具调用chunk
		if m.hasToolCall {
			ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: []types.ToolCallDelta{
								{
									Index: 0,
									Function: &types.ToolCallFunctionDelta{
										Name:      "deliberation_signal",
										Arguments: m.toolCallArgs,
									},
								},
							},
						},
					},
				},
			}
		}
	}()

	return ch, nil
}

func (m *mockLLMClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	return m.responseContent, nil
}

func (m *mockLLMClient) GetModel() string {
	return "gpt-4"
}

func createMockSage(name, displayName, content string, shouldFail bool, delay time.Duration) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: displayName,
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 7,
	}

	client := &mockLLMClient{
		responseContent: content,
		shouldFail:      shouldFail,
		delay:           delay,
	}

	return sages.NewSage(name, cfg, client, strategy)
}

func TestCollectResponses_AllSuccess(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	melchior := createMockSage("melchior", "Melchior", "逻辑分析", false, 0)
	balthazar := createMockSage("balthazar", "Balthazar", "情感分析", false, 0)
	casper := createMockSage("casper", "Casper", "直觉分析", false, 0)

	ctx := context.Background()
	responses, err := collector.CollectResponses(ctx, "test-session", "test-round", melchior, balthazar, casper, "测试消息", "测试消息")

	if err != nil {
		t.Fatalf("期望成功，但得到错误: %v", err)
	}

	if len(responses) != 3 {
		t.Fatalf("期望3个响应，得到 %d", len(responses))
	}
}

func TestCollectResponses_TwoSuccess(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	melchior := createMockSage("melchior", "Melchior", "逻辑分析", false, 0)
	balthazar := createMockSage("balthazar", "Balthazar", "情感分析", false, 0)
	casper := createMockSage("casper", "Casper", "", true, 0) // 失败

	ctx := context.Background()
	responses, err := collector.CollectResponses(ctx, "test-session", "test-round", melchior, balthazar, casper, "测试消息", "测试消息")

	if err != nil {
		t.Fatalf("期望成功（2个响应足够），但得到错误: %v", err)
	}

	if len(responses) != 2 {
		t.Fatalf("期望2个响应，得到 %d", len(responses))
	}
}

func TestCollectResponses_OnlyOneSuccess(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	melchior := createMockSage("melchior", "Melchior", "逻辑分析", false, 0)
	balthazar := createMockSage("balthazar", "Balthazar", "", true, 0) // 失败
	casper := createMockSage("casper", "Casper", "", true, 0)          // 失败

	ctx := context.Background()
	_, err := collector.CollectResponses(ctx, "test-session", "test-round", melchior, balthazar, casper, "测试消息", "测试消息")

	if err == nil {
		t.Fatal("期望错误（只有1个成功），但得到成功")
	}
}

func TestCollectResponses_Timeout(t *testing.T) {
	collector := NewResponseCollector(100 * time.Millisecond)

	melchior := createMockSage("melchior", "Melchior", "逻辑分析", false, 200*time.Millisecond)
	balthazar := createMockSage("balthazar", "Balthazar", "情感分析", false, 200*time.Millisecond)
	casper := createMockSage("casper", "Casper", "直觉分析", false, 0)

	ctx := context.Background()
	_, err := collector.CollectResponses(ctx, "test-session", "test-round", melchior, balthazar, casper, "测试消息", "测试消息")

	if err == nil {
		t.Fatal("期望超时错误，但得到成功")
	}
}

// TestCollectSingleSageResponse_WithToolCalls 测试单个贤者响应包含工具调用
func TestCollectSingleSageResponse_WithToolCalls(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	// 创建带有工具调用的mock客户端
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: "Melchior",
		},
	}
	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 7,
	}
	client := &mockLLMClient{
		responseContent: "需要投票",
		hasToolCall:     true,
		toolCallArgs:    `{"requires_deliberation":true,"reason":"测试原因"}`,
	}
	melchior := sages.NewSage("melchior", cfg, client, strategy)

	ctx := context.Background()
	response, err := collector.collectSingleSageResponse(ctx, "test-session", "test-round", melchior, "测试消息")

	if err != nil {
		t.Fatalf("期望成功，但得到错误: %v", err)
	}

	if !response.UsedToolCall {
		t.Fatal("期望UsedToolCall为true，但为false")
	}

	if !response.RequiresDeliberation {
		t.Fatal("期望RequiresDeliberation为true，但为false")
	}

	if response.DeliberationReason != "测试原因" {
		t.Fatalf("期望DeliberationReason为'测试原因'，得到 '%s'", response.DeliberationReason)
	}
}
