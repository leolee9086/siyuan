package coordinator

import (
	"context"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/model"
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
	chunks    []types.StreamChunk
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
	syncResponses   []string
	syncIndex       int
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
			if len(turn.chunks) > 0 {
				for _, chunk := range turn.chunks {
					ch <- chunk
				}
				return
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

func streamToolCallChunk(index int, name, arguments string) types.StreamChunk {
	return types.StreamChunk{
		Choices: []types.ChunkChoice{{
			Delta: types.ChunkDelta{
				ToolCalls: []types.ToolCallDelta{{
					Index: index,
					Function: &types.ToolCallFunctionDelta{
						Name:      name,
						Arguments: arguments,
					},
				}},
			},
		}},
	}
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
	m.mu.Lock()
	if m.syncIndex < len(m.syncResponses) {
		resp := m.syncResponses[m.syncIndex]
		m.syncIndex++
		m.mu.Unlock()
		return resp, nil
	}
	m.mu.Unlock()
	return m.responseContent, nil
}

func (m *mockLLMClient) SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error) {
	m.mu.Lock()
	if m.syncIndex < len(m.syncResponses) {
		resp := m.syncResponses[m.syncIndex]
		m.syncIndex++
		m.mu.Unlock()
		toolName := ""
		if len(tools) == 1 && tools[0].Function != nil {
			toolName = strings.TrimSpace(tools[0].Function.Name)
		}
		return &types.SyncChatResult{
			ToolCalls: []types.ToolCall{
				{
					ID:   "mock-sync-tool-call",
					Type: "function",
					Function: types.ToolCallFunction{
						Name:      toolName,
						Arguments: resp,
					},
				},
			},
			FinishReason: "tool_calls",
		}, nil
	}
	m.mu.Unlock()
	return &types.SyncChatResult{Content: m.responseContent}, nil
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

	sage := sages.NewSage(name, cfg, client, strategy)
	sage.SetProfile(buildDominantReplyTestProfile())
	return sage
}

func TestCollectSingleSageResponseAddsTodoUnchangedPromptOnlyOnce(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	searchCalls := 0
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		searchCalls++
		updated := "20260802170000"
		if searchCalls >= 4 {
			updated = "20260802170100"
		}
		return []*model.Block{{ID: "todo-1", Updated: updated}}, 1, 1, 0, false
	}
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
	})

	repeatedWorkTurn := mockTurn{toolCalls: []types.ToolCallDelta{
		toolCallDelta(0, config.NoteKeywordSearchToolName, `{"purpose":"检查待办","query":"#todo#"}`),
		toolCallDelta(1, config.WriteDiaryToolName, `{"motivation":"记录检查结果","markdown":"记录"}`),
	}}
	client := &mockLLMClient{scriptedTurns: []mockTurn{
		repeatedWorkTurn,
		repeatedWorkTurn,
		completedSpeakTurn("待办已经更新"),
	}}
	cfg := &config.AgentConfig{SEELConfig: config.SEELConfig{Name: "Melchior"}}
	sage := sages.NewSage(
		"melchior",
		cfg,
		client,
		&config.ContextStrategy{Type: "message_count", Count: 100},
	)

	response, err := NewResponseCollector(5*time.Second).collectSingleSageResponse(
		context.Background(),
		"todo-prompt-session",
		"todo-prompt-round",
		sage,
		"检查并推进待办",
		CollectResponsesOptions{
			AllowWannaSleep: true,
			RuntimeTools: []openai.Tool{
				buildRuntimeTool(config.BuildNoteKeywordSearchToolDef()),
				buildRuntimeTool(config.BuildWriteDiaryToolDef()),
			},
		},
	)
	if err != nil {
		t.Fatalf("collectSingleSageResponse() error = %v", err)
	}
	if response == nil || response.Content != "待办已经更新" {
		t.Fatalf("响应未正常收敛: %+v", response)
	}
	if searchCalls != 4 {
		t.Fatalf("TODO 快照搜索次数 = %d, want 4", searchCalls)
	}

	const todoUnchangedPrompt = "[系统提示] 本轮 #todo# 无任何变化，必须在笔记中标记完成或新增待办,使得#todo#标签搜索结果发生变化后才能进入工作日志。"
	promptCount := 0
	for _, message := range sage.GetContextForSession("todo-prompt-session") {
		if message.Content != todoUnchangedPrompt {
			continue
		}
		promptCount++
		if message.Role != types.RoleUser {
			t.Fatalf("TODO 无变化提示角色 = %s, want user", message.Role)
		}
	}
	if promptCount != 1 {
		t.Fatalf("TODO 无变化提示注入次数 = %d, want 1", promptCount)
	}
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
	var replySnapshots []string
	response, err := collector.collectSingleSageResponse(ctx, "test-session", "test-round", melchior, "测试消息", CollectResponsesOptions{
		ReplyStreamObserver: func(content string) error {
			replySnapshots = append(replySnapshots, content)
			return nil
		},
	})

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
	if len(replySnapshots) != 1 || replySnapshots[0] != response.Content {
		t.Fatalf("wanna_speak_continue 未进入对外流: snapshots=%#v response=%q", replySnapshots, response.Content)
	}
}

func TestCollectSingleSageResponseStreamsIncrementalWannaSpeakArguments(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)
	cfg := &config.AgentConfig{SEELConfig: config.SEELConfig{Name: "Melchior"}}
	strategy := &config.ContextStrategy{Type: "message_count", Count: 7}
	client := &mockLLMClient{scriptedTurns: []mockTurn{{
		chunks: []types.StreamChunk{
			streamToolCallChunk(0, config.WannaSpeakStartToolName, `{}`),
			streamToolCallChunk(1, config.WannaSpeakContinueToolName, `{"content":"中`),
			streamToolCallChunk(1, "", `文`),
			streamToolCallChunk(1, "", `"}`),
			streamToolCallChunk(2, config.WannaSpeakStopToolName, `{}`),
		},
	}}}
	sage := sages.NewSage("melchior", cfg, client, strategy)

	var snapshots []string
	response, err := collector.collectSingleSageResponse(
		context.Background(),
		"test-session",
		"test-round",
		sage,
		"测试消息",
		CollectResponsesOptions{ReplyStreamObserver: func(content string) error {
			snapshots = append(snapshots, content)
			return nil
		}},
	)
	if err != nil {
		t.Fatalf("collect streamed response failed: %v", err)
	}
	if response.Content != "中文" {
		t.Fatalf("unexpected final response: %q", response.Content)
	}
	want := []string{"中", "中文"}
	if !reflect.DeepEqual(snapshots, want) {
		t.Fatalf("unexpected observer snapshots: got %#v, want %#v", snapshots, want)
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

	madeProgress, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.WannaSpeakStartToolName),
		toolCall(config.WannaSpeakStartToolName),
	})
	if err != nil {
		t.Fatalf("重复调用 wanna_speak_start 不应阻塞: %v", err)
	}
	if !madeProgress {
		t.Fatal("重复调用 wanna_speak_start 应计为有效进展")
	}
	if len(tracker.transitionErrors) == 0 {
		t.Fatal("重复调用 wanna_speak_start 应记录警告")
	}
	if !tracker.capturing {
		t.Fatal("重复调用 wanna_speak_start 后应仍处于表达状态")
	}
}

func TestWannaSpeakTracker_AllowsReadOnlyForgeAfterSpeakStart(t *testing.T) {
	tracker := newWannaSpeakStateTracker()

	madeProgress, err := tracker.ApplyTurnToolCalls([]types.ToolCall{
		toolCall(config.WannaSpeakStartToolName),
		toolCall(config.ForgeDevRepoReadToolName),
	})
	if err != nil {
		t.Fatalf("表达状态后调用只读 forge 工具不应报错: %v", err)
	}
	if !madeProgress {
		t.Fatal("表达状态后调用只读 forge 工具应计为有效进展")
	}
}

func TestCollectHeartbeatResponses_WaitsForAllSleepingSages(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	sleepClient := &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepPlanToolName, `{"summary":"检查了待办并确认暂时无事可做","nextStepPlan":"明早先确认新的调度信号"}`),
				},
			},
		},
	}
	melchior := createMockSageWithClient("melchior", "Melchior", sleepClient)
	balthazar := createMockSageWithClient("balthazar", "Balthazar", &mockLLMClient{
		delay: 2 * time.Second,
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepDreamToolName, `{"summary":"我把今天残留的感受收起来了","dreamScene":"夜色中的工作台，屏幕映着雨后的窗，手边摊着未合上的笔记本，空气安静而清醒"}`),
				},
			},
		},
	})
	casper := createMockSageWithClient("casper", "Casper", &mockLLMClient{
		delay: 2 * time.Second,
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepRecordToolName, `{"summary":"目前没有必须立刻处理的新事，先把这一轮看到的细节记下来"}`),
				},
			},
		},
	})

	result, err := collector.CollectHeartbeatResponses(
		context.Background(),
		"heartbeat-session",
		"heartbeat-round",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		"heartbeat",
		nil,
		buildHeartbeatRuntimeToolsBySage(false, nil),
		buildHeartbeatRuntimeToolChoiceBySage(false),
		false,
	)
	if err != nil {
		t.Fatalf("心跳收集不应报错: %v", err)
	}
	if result == nil || !result.AllDowntime {
		t.Fatal("期望三贤人全部 wanna_sleep 后心跳轮次进入休眠")
	}
	if result.DowntimeSage != "all" {
		t.Fatalf("期望所有贤者完成休眠，实际=%s", result.DowntimeSage)
	}
	if len(result.Responses) != 3 {
		t.Fatalf("期望收集到3个休眠响应，实际=%d", len(result.Responses))
	}

	respBySeel := map[string]types.SageResponse{}
	for _, resp := range result.Responses {
		respBySeel[resp.Seel] = resp
	}
	if respBySeel["melchior"].DowntimeNote == nil || respBySeel["melchior"].DowntimeNote.NextStepPlan == "" {
		t.Fatal("期望 Melchior 的睡前笔记携带下一步计划")
	}
	if respBySeel["balthazar"].DowntimeNote == nil || respBySeel["balthazar"].DowntimeNote.DreamScene == "" {
		t.Fatal("期望 Balthazar 的睡前笔记携带梦境画面描述")
	}
	if respBySeel["casper"].DowntimeNote == nil || !strings.Contains(respBySeel["casper"].DowntimeNote.Summary, "细节") {
		t.Fatal("期望 Casper 的睡前笔记保留当前记录")
	}
}

func TestCollectHeartbeatResponses_AnySageStillAwakeKeepsHeartbeatAwake(t *testing.T) {
	collector := NewResponseCollector(5 * time.Second)

	melchior := createMockSageWithClient("melchior", "Melchior", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepPlanToolName, `{"summary":"先记录检查结果","nextStepPlan":"继续观察队列变化"}`),
				},
			},
		},
	})
	balthazar := createMockSageWithClient("balthazar", "Balthazar", &mockLLMClient{
		scriptedTurns: []mockTurn{completedSpeakTurn("我还在想这件事的情绪余波，先不睡")},
	})
	casper := createMockSageWithClient("casper", "Casper", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepRecordToolName, `{"summary":"当前没有新的异常，先把线索记下"}`),
				},
			},
		},
	})

	result, err := collector.CollectHeartbeatResponses(
		context.Background(),
		"heartbeat-session-2",
		"heartbeat-round-2",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		"heartbeat",
		nil,
		buildHeartbeatRuntimeToolsBySage(false, nil),
		buildHeartbeatRuntimeToolChoiceBySage(false),
		false,
	)
	if err != nil {
		t.Fatalf("心跳收集不应报错: %v", err)
	}
	if result == nil {
		t.Fatal("期望返回心跳结果")
	}
	if result.AllDowntime {
		t.Fatal("只要有一位没有通过 wanna_sleep 结束，本轮就不应进入 sleeping")
	}
}

func TestParseWannaSleepToolContent_ValidatesToolSpecificFields(t *testing.T) {
	tests := []struct {
		name     string
		toolName string
		rawArgs  string
		wantErr  string
	}{
		{
			name:     "plan requires nextStepPlan",
			toolName: config.WannaSleepPlanToolName,
			rawArgs:  `{"summary":"做完检查了"}`,
			wantErr:  "nextStepPlan",
		},
		{
			name:     "dream requires scene",
			toolName: config.WannaSleepDreamToolName,
			rawArgs:  `{"summary":"我把感受记下来了"}`,
			wantErr:  "dreamScene",
		},
		{
			name:     "record keeps summary only",
			toolName: config.WannaSleepRecordToolName,
			rawArgs:  `{"summary":"当前一切平稳"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			note, hasSleep, err := parseWannaDowntimeToolContent([]types.ToolCall{
				{
					ID:   "sleep-call",
					Type: "function",
					Function: types.ToolCallFunction{
						Name:      tt.toolName,
						Arguments: tt.rawArgs,
					},
				},
			})

			if tt.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("期望错误包含 %q，实际=%v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("不期望报错: %v", err)
			}
			if !hasSleep || note == nil || strings.TrimSpace(note.Summary) == "" {
				t.Fatal("期望成功解析 wanna_sleep 笔记")
			}
		})
	}
}
