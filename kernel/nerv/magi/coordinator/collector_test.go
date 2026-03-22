package coordinator

import (
	"context"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func toolCall(name string) types.ToolCall {
	return types.ToolCall{
		ID:    "test-call-" + name,
		Type:  "function",
		Index: 0,
		Function: types.ToolCallFunction{
			Name:      name,
			Arguments: "{}",
		},
	}
}

func toolCallDelta(index int, name, args string) types.ToolCallDelta {
	if args == "" {
		args = "{}"
	}
	return types.ToolCallDelta{
		Index: index,
		ID:    "test-delta-" + name,
		Type:  "function",
		Function: &types.ToolCallFunctionDelta{
			Name:      name,
			Arguments: args,
		},
	}
}

type mockTurn struct {
	content   string
	toolCalls []types.ToolCallDelta
	object    string
}

func completedSpeakTurn(content string) mockTurn {
	return mockTurn{
		toolCalls: []types.ToolCallDelta{
			toolCallDelta(0, config.WannaSpeakStartToolName, `{}`),
			toolCallDelta(1, config.WannaSpeakContinueToolName, `{"content":"`+content+`"}`),
			toolCallDelta(2, config.WannaSpeakStopToolName, `{}`),
		},
	}
}

// mockLLMClient 模拟LLM客户端
type mockLLMClient struct {
	responseContent string
	shouldFail      bool
	delay           time.Duration
	hasToolCall     bool
	toolCallArgs    string
	scriptedTurns   []mockTurn
	mu              sync.Mutex
	turnIndex       int
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

		if turn, ok := m.nextTurn(); ok {
			if turn.object != "" {
				ch <- types.StreamChunk{
					ID:     turn.object,
					Object: turn.object,
				}
				return
			}
			if turn.content != "" {
				ch <- types.StreamChunk{
					Choices: []types.ChunkChoice{
						{
							Delta: types.ChunkDelta{
								Content: turn.content,
							},
						},
					},
				}
			}
			if len(turn.toolCalls) > 0 {
				ch <- types.StreamChunk{
					Choices: []types.ChunkChoice{
						{
							Delta: types.ChunkDelta{
								ToolCalls: turn.toolCalls,
							},
						},
					},
				}
			}
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

func (m *mockLLMClient) nextTurn() (mockTurn, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.scriptedTurns) == 0 {
		return mockTurn{}, false
	}
	if m.turnIndex >= len(m.scriptedTurns) {
		m.turnIndex++
		return mockTurn{}, true
	}

	turn := m.scriptedTurns[m.turnIndex]
	m.turnIndex++
	return turn, true
}

func (m *mockLLMClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	return m.responseContent, nil
}

func (m *mockLLMClient) GetModel() string {
	return "gpt-4"
}

func createMockSage(name, displayName, content string, shouldFail bool, delay time.Duration) *sages.Sage {
	client := &mockLLMClient{
		responseContent: content,
		shouldFail:      shouldFail,
		delay:           delay,
	}
	if !shouldFail && content != "" {
		client.scriptedTurns = []mockTurn{completedSpeakTurn(content)}
	}
	return createMockSageWithClient(name, displayName, client)
}

func createMockSageWithClient(name, displayName string, client *mockLLMClient) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: displayName,
		},
	}

	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 7,
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
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, "deliberation_signal", `{"requires_deliberation":true,"reason":"测试原因"}`),
					toolCallDelta(1, config.WannaSpeakStartToolName, `{}`),
					toolCallDelta(2, config.WannaSpeakContinueToolName, `{"content":"整理后的内部结论"}`),
					toolCallDelta(3, config.WannaSpeakStopToolName, `{}`),
				},
			},
		},
	}
	melchior := sages.NewSage("melchior", cfg, client, strategy)

	ctx := context.Background()
	response, err := collector.collectSingleSageResponse(ctx, "test-session", "test-round", melchior, "测试消息", CollectResponsesOptions{})

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

	if response.Content != "整理后的内部结论" {
		t.Fatalf("期望Content为整理后的内部结论，得到 '%s'", response.Content)
	}
}

// TestCollectSingleSageResponse_WithInvalidToolArgs 测试工具调用参数非法
func TestCollectSingleSageResponse_WithInvalidToolArgs(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

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
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, "deliberation_signal", `{invalid json}`),
					toolCallDelta(1, config.WannaSpeakStartToolName, `{}`),
					toolCallDelta(2, config.WannaSpeakContinueToolName, `{"content":"分析内容"}`),
					toolCallDelta(3, config.WannaSpeakStopToolName, `{}`),
				},
			},
		},
	}
	melchior := sages.NewSage("melchior", cfg, client, strategy)

	ctx := context.Background()
	response, err := collector.collectSingleSageResponse(ctx, "test-session", "test-round", melchior, "测试消息", CollectResponsesOptions{})

	if err != nil {
		t.Fatalf("期望成功（解析失败不应导致整体失败），但得到错误: %v", err)
	}

	if !response.UsedToolCall {
		t.Fatal("期望UsedToolCall为true（检测到工具调用），但为false")
	}

	// 非法JSON应该导致审慎决策字段保持默认值
	if response.RequiresDeliberation {
		t.Fatal("期望RequiresDeliberation为false（解析失败），但为true")
	}

	if response.DeliberationReason != "" {
		t.Fatalf("期望DeliberationReason为空（解析失败），得到 '%s'", response.DeliberationReason)
	}

	if response.Content != "分析内容" {
		t.Fatalf("期望Content为分析内容，得到 '%s'", response.Content)
	}
}

// TestCollectSingleSageResponse_WithoutToolCallsFails 测试未调用 speak 工具时会失败
func TestCollectSingleSageResponse_WithoutToolCallsFails(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

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
		responseContent: "直接分析内容",
		hasToolCall:     false, // 未调用工具
	}
	melchior := sages.NewSage("melchior", cfg, client, strategy)

	ctx := context.Background()
	response, err := collector.collectSingleSageResponse(ctx, "test-session", "test-round", melchior, "测试消息", CollectResponsesOptions{})

	if err == nil {
		t.Fatalf("期望因为缺少 speak 状态转移而失败，但返回了响应: %+v", response)
	}
	if !strings.Contains(err.Error(), "工具状态转移连续失败次数达到上限") {
		t.Fatalf("期望得到状态转移失败错误，实际为: %v", err)
	}
}

func TestWannaSpeakTracker_ReadingTurnCountsAsProgress(t *testing.T) {
	tracker := newWannaSpeakStateTracker()

	madeProgress, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.NoteKeywordSearchToolName),
	})
	if err != nil {
		t.Fatalf("阅读阶段不应报错: %v", err)
	}
	if !madeProgress {
		t.Fatal("阅读阶段的工具调用应计为有效进展")
	}
	if tracker.ShouldInjectContinuationPrompt() {
		t.Fatal("尚未进入表达状态时不应注入 continuation prompt")
	}
}

func TestWannaSpeakTracker_AllowsReadingBeforeSpeakInSameTurn(t *testing.T) {
	tracker := newWannaSpeakStateTracker()

	madeProgress, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.NoteKeywordSearchToolName),
		toolCall(config.WannaSpeakStartToolName),
		{
			ID:    "continue-call",
			Type:  "function",
			Index: 2,
			Function: types.ToolCallFunction{
				Name:      config.WannaSpeakContinueToolName,
				Arguments: `{"content":"形成后的内部想法"}`,
			},
		},
		toolCall(config.WannaSpeakStopToolName),
	})
	if err != nil {
		t.Fatalf("阅读后进入表达并完成时不应报错: %v", err)
	}
	if !madeProgress {
		t.Fatal("同轮完成阅读并表达应计为有效进展")
	}
	if !tracker.IsCompletedPair() {
		t.Fatal("期望状态转移已经完整闭合")
	}
}

func TestWannaSpeakTracker_AllowsSpeakingAcrossTurns(t *testing.T) {
	tracker := newWannaSpeakStateTracker()

	madeProgress, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.WannaSpeakStartToolName),
		{
			ID:    "continue-call-1",
			Type:  "function",
			Index: 1,
			Function: types.ToolCallFunction{
				Name:      config.WannaSpeakContinueToolName,
				Arguments: `{"content":"第一段想法"}`,
			},
		},
	})
	if err != nil {
		t.Fatalf("开始表达的首轮不应报错: %v", err)
	}
	if !madeProgress {
		t.Fatal("开始表达的首轮应计为有效进展")
	}
	if !tracker.ShouldInjectContinuationPrompt() {
		t.Fatal("表达未结束时应继续注入 continuation prompt")
	}

	madeProgress, err = tracker.ApplyTurnToolCalls([]types.ToolCall{
		{
			ID:    "continue-call-2",
			Type:  "function",
			Index: 2,
			Function: types.ToolCallFunction{
				Name:      config.WannaSpeakContinueToolName,
				Arguments: `{"content":"第二段想法"}`,
			},
		},
		toolCall(config.WannaSpeakStopToolName),
	})
	if err != nil {
		t.Fatalf("跨轮补全表达时不应报错: %v", err)
	}
	if !madeProgress {
		t.Fatal("补全表达的次轮应计为有效进展")
	}
	if !tracker.IsCompletedPair() {
		t.Fatal("跨轮表达完成后应处于闭合状态")
	}
	if tracker.ShouldInjectContinuationPrompt() {
		t.Fatal("表达完成后不应继续注入 continuation prompt")
	}
}

func TestWannaSpeakTracker_RejectsDuplicateStart(t *testing.T) {
	tracker := newWannaSpeakStateTracker()

	_, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.WannaSpeakStartToolName),
		toolCall(config.WannaSpeakStartToolName),
	})
	if err == nil {
		t.Fatal("表达未结束时重复调用 wanna_speak_start 应报错")
	}
}

func TestWannaSpeakTracker_RejectsReadingAfterSpeakStart(t *testing.T) {
	tracker := newWannaSpeakStateTracker()

	_, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.WannaSpeakStartToolName),
		toolCall(config.ForgeDevRepoReadToolName),
	})
	if err == nil {
		t.Fatal("进入表达状态后再调用阅读工具应报错")
	}
}

func TestCollectHeartbeatResponses_WannaSleepStopsOtherSages(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	sleepClient := &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.WannaSleepToolName, `{"summary":"检查了待办并确认暂时无事可做"}`),
				},
			},
		},
	}
	melchior := createMockSageWithClient("melchior", "Melchior", sleepClient)
	balthazar := createMockSageWithClient("balthazar", "Balthazar", &mockLLMClient{
		delay:         2 * time.Second,
		scriptedTurns: []mockTurn{completedSpeakTurn("仍在分析")},
	})
	casper := createMockSageWithClient("casper", "Casper", &mockLLMClient{
		delay:         2 * time.Second,
		scriptedTurns: []mockTurn{completedSpeakTurn("仍在分析")},
	})

	runtimeTools := []openai.Tool{
		{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        config.WannaSleepToolName,
				Description: "sleep",
			},
		},
	}

	result, err := collector.CollectHeartbeatResponses(
		context.Background(),
		"heartbeat-session",
		"heartbeat-round",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		"heartbeat",
		runtimeTools,
		"required",
	)
	if err != nil {
		t.Fatalf("心跳收集不应报错: %v", err)
	}
	if result == nil || !result.Sleeping {
		t.Fatal("期望心跳轮次被 wanna_sleep 收束")
	}
	if result.Sleeper != "melchior" {
		t.Fatalf("期望 Melchior 发起休眠，实际=%s", result.Sleeper)
	}
	if !strings.Contains(result.SleepSummary, "无事可做") {
		t.Fatalf("期望休眠摘要被保留，实际=%s", result.SleepSummary)
	}

	contextMessages := melchior.GetContextForSession("heartbeat-session")
	foundToolCall := false
	foundToolResult := false
	for _, msg := range contextMessages {
		if len(msg.ToolCalls) > 0 && msg.ToolCalls[0].Function.Name == config.WannaSleepToolName {
			foundToolCall = true
		}
		if msg.Role == types.RoleTool && strings.Contains(msg.Content, `"state":"sleeping"`) {
			foundToolResult = true
		}
	}
	if !foundToolCall {
		t.Fatal("wanna_sleep 工具调用应写入贤者记忆")
	}
	if !foundToolResult {
		t.Fatal("wanna_sleep 工具结果应写入贤者记忆")
	}
}
