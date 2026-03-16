package coordinator

import (
	"context"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/stream"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// mockTrinitySpeakClient 模拟Trinity speak工具调用的客户端
type mockTrinitySpeakClient struct {
	publicContent  string
	internalMsgs   []string
	shouldFail     bool
	failUntilRetry int
	currentAttempt int
}

func (m *mockTrinitySpeakClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	// 在返回前同步递增计数器，避免竞态条件
	m.currentAttempt++

	ch := make(chan types.StreamChunk, 10)

	go func() {
		defer close(ch)

		// 模拟重试失败
		if m.shouldFail && m.currentAttempt <= m.failUntilRetry {
			return
		}

		// 发送 public 表达状态开始
		ch <- types.StreamChunk{
			Choices: []types.ChunkChoice{
				{
					Delta: types.ChunkDelta{
						ToolCalls: []types.ToolCallDelta{
							{
								Index: 0,
								Function: &types.ToolCallFunctionDelta{
									Name: stream.TrinitySpeakStartToolName,
								},
							},
						},
					},
				},
			},
		}

		// 发送 public 正文
		ch <- types.StreamChunk{
			Choices: []types.ChunkChoice{
				{
					Delta: types.ChunkDelta{
						ToolCalls: []types.ToolCallDelta{
							{
								Index: 1,
								Function: &types.ToolCallFunctionDelta{
									Name:      stream.TrinitySpeakContinueToolName,
									Arguments: `{"content":"` + m.publicContent + `"}`,
								},
							},
						},
					},
				},
			},
		}

		// 发送 public 表达状态结束
		ch <- types.StreamChunk{
			Choices: []types.ChunkChoice{
				{
					Delta: types.ChunkDelta{
						ToolCalls: []types.ToolCallDelta{
							{
								Index: 2,
								Function: &types.ToolCallFunctionDelta{
									Name: stream.TrinitySpeakStopToolName,
								},
							},
						},
					},
				},
			},
		}

		// 发送 internal 表达状态
		for i, msg := range m.internalMsgs {
			startIdx := 3 + i*3
			continueIdx := startIdx + 1
			stopIdx := startIdx + 2

			ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: []types.ToolCallDelta{
								{
									Index: startIdx,
									Function: &types.ToolCallFunctionDelta{
										Name: stream.TrinitySpeakInternalStartToolName,
									},
								},
							},
						},
					},
				},
			}

			ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: []types.ToolCallDelta{
								{
									Index: continueIdx,
									Function: &types.ToolCallFunctionDelta{
										Name:      stream.TrinitySpeakInternalContinueToolName,
										Arguments: `{"content":"` + msg + `"}`,
									},
								},
							},
						},
					},
				},
			}

			ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: []types.ToolCallDelta{
								{
									Index: stopIdx,
									Function: &types.ToolCallFunctionDelta{
										Name: stream.TrinitySpeakInternalStopToolName,
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

func (m *mockTrinitySpeakClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	return "", nil
}

func (m *mockTrinitySpeakClient) GetModel() string {
	return "gpt-4"
}

type mockTrinityPlainTextClient struct {
	content string
}

func (m *mockTrinityPlainTextClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk, 1)
	go func() {
		defer close(ch)
		ch <- types.StreamChunk{
			Choices: []types.ChunkChoice{
				{
					Delta: types.ChunkDelta{
						Content: m.content,
					},
				},
			},
		}
	}()
	return ch, nil
}

func (m *mockTrinityPlainTextClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	return m.content, nil
}

func (m *mockTrinityPlainTextClient) GetModel() string {
	return "gpt-4"
}

func createMockTrinity(publicContent string, internalMsgs []string, shouldFail bool, failUntilRetry int) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: "Trinity",
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 3,
	}

	client := &mockTrinitySpeakClient{
		publicContent:  publicContent,
		internalMsgs:   internalMsgs,
		shouldFail:     shouldFail,
		failUntilRetry: failUntilRetry,
	}

	return sages.NewSage("trinity", cfg, client, strategy)
}

func TestBuildIntrospectionInput(t *testing.T) {
	tc := NewTrinityCoordinator()

	responses := []types.SageResponse{
		{Seel: "melchior", Content: "逻辑分析结果"},
		{Seel: "balthazar", Content: "情绪感知结果"},
		{Seel: "casper", Content: "直觉判断结果"},
	}

	result := tc.buildIntrospectionInput(responses)

	expected := `逻辑告诉我：逻辑分析结果

情绪告诉我：情绪感知结果

直觉告诉我：直觉判断结果`

	if result != expected {
		t.Errorf("内省输入构建错误\n期望:\n%s\n实际:\n%s", expected, result)
	}
}

func TestBuildIntrospectionInputWithMissingSage(t *testing.T) {
	tc := NewTrinityCoordinator()

	responses := []types.SageResponse{
		{Seel: "melchior", Content: "逻辑分析结果"},
	}

	result := tc.buildIntrospectionInput(responses)

	expected := `逻辑告诉我：逻辑分析结果

情绪告诉我：我还在感受这件事的情绪波动。

直觉告诉我：我暂时没有明确的本能倾向。`

	if result != expected {
		t.Errorf("缺失贤者时内省输入构建错误\n期望:\n%s\n实际:\n%s", expected, result)
	}
}

func TestHandleTrinitySummarySuccess(t *testing.T) {
	tc := NewTrinityCoordinator()
	trinity := createMockTrinity("综合结论", []string{"内部消息1", "内部消息2"}, false, 0)

	responses := []types.SageResponse{
		{Seel: "melchior", Content: "逻辑分析"},
		{Seel: "balthazar", Content: "情绪感知"},
		{Seel: "casper", Content: "直觉判断"},
	}

	ctx := context.Background()
	result, err := tc.HandleTrinitySummary(ctx, "test-session", "test-round", trinity, responses, "test user message")

	if err != nil {
		t.Fatalf("Trinity统合失败: %v", err)
	}

	if !result.Success {
		t.Error("期望Success为true")
	}

	if result.Content != "综合结论" {
		t.Errorf("期望Content为'综合结论'，实际为'%s'", result.Content)
	}

	if len(result.InternalToolMessages) != 2 {
		t.Errorf("期望2条内部消息，实际为%d条", len(result.InternalToolMessages))
	}
}

func TestHandleTrinitySummaryEmptyResponses(t *testing.T) {
	tc := NewTrinityCoordinator()
	trinity := createMockTrinity("", nil, false, 0)

	ctx := context.Background()
	result, err := tc.HandleTrinitySummary(ctx, "test-session", "test-round", trinity, []types.SageResponse{}, "test user message")

	if err != nil {
		t.Fatalf("期望无错误，实际: %v", err)
	}

	if result.Success {
		t.Error("期望Success为false")
	}
}

func TestHandleTrinitySummaryRetrySuccess(t *testing.T) {
	tc := NewTrinityCoordinator()
	tc.initialBackoff = 10 * time.Millisecond // 加快测试速度

	// 前2次失败，第3次成功
	trinity := createMockTrinity("重试后成功", nil, true, 2)

	responses := []types.SageResponse{
		{Seel: "melchior", Content: "逻辑分析"},
	}

	ctx := context.Background()
	result, err := tc.HandleTrinitySummary(ctx, "test-session", "test-round", trinity, responses, "test user message")

	if err != nil {
		t.Fatalf("期望重试成功，实际失败: %v", err)
	}

	if !result.Success {
		t.Error("期望Success为true")
	}

	if result.Content != "重试后成功" {
		t.Errorf("期望Content为'重试后成功'，实际为'%s'", result.Content)
	}
}

func TestHandleTrinitySummaryMaxRetriesExceeded(t *testing.T) {
	tc := NewTrinityCoordinator()
	tc.maxRetries = 3
	tc.initialBackoff = 10 * time.Millisecond

	// 始终失败
	trinity := createMockTrinity("", nil, true, 999)

	responses := []types.SageResponse{
		{Seel: "melchior", Content: "逻辑分析"},
	}

	ctx := context.Background()
	_, err := tc.HandleTrinitySummary(ctx, "test-session", "test-round", trinity, responses, "test user message")

	if err == nil {
		t.Fatal("期望返回错误，实际成功")
	}
}

func TestInjectIntrospection(t *testing.T) {
	tc := NewTrinityCoordinator()
	trinity := createMockTrinity("", nil, false, 0)

	introspection := "测试内省输入"
	userInput := "测试用户输入"
	sessionId := "test-session-id"
	tc.injectIntrospection(sessionId, trinity, introspection, userInput)

	context := trinity.GetContext()

	if len(context) != 2 {
		t.Fatalf("期望注入2条消息，实际为%d条", len(context))
	}

	// 检查工具调用消息
	if context[0].Role != types.RoleAssistant {
		t.Errorf("期望第1条消息角色为assistant，实际为%s", context[0].Role)
	}

	if len(context[0].ToolCalls) != 1 {
		t.Fatalf("期望1个工具调用，实际为%d个", len(context[0].ToolCalls))
	}

	if context[0].ToolCalls[0].Function.Name != "think_about" {
		t.Errorf("期望工具名为think_about，实际为%s", context[0].ToolCalls[0].Function.Name)
	}

	// 检查工具结果消息
	if context[1].Role != types.RoleTool {
		t.Errorf("期望第2条消息角色为tool，实际为%s", context[1].Role)
	}
}

func TestHandleTrinitySummaryRejectsPlainTextWithoutSpeakTools(t *testing.T) {
	tc := NewTrinityCoordinator()
	tc.maxRetries = 1
	tc.initialBackoff = 1 * time.Millisecond
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: "Trinity",
		},
	}
	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 3,
	}
	trinity := sages.NewSage("trinity", cfg, &mockTrinityPlainTextClient{content: "这是Trinity直接文本统合结论。"}, strategy)

	responses := []types.SageResponse{
		{Seel: "melchior", Content: "逻辑分析"},
		{Seel: "balthazar", Content: "情绪感知"},
		{Seel: "casper", Content: "直觉判断"},
	}

	ctx := context.Background()
	result, err := tc.HandleTrinitySummary(ctx, "test-session", "test-round", trinity, responses, "test user message")
	if err == nil {
		t.Fatal("期望返回错误（Trinity未调用状态转移工具），实际成功")
	}
	if result != nil && result.Success {
		t.Fatal("期望Success为false")
	}
}
