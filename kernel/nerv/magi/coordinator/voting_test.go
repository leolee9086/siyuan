package coordinator

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

var defaultTestVotingCfg = VotingConfig{
	Timeout:     30 * time.Second,
	MaxRetries:  0,
	BackoffBase: time.Second,
}

// mockVoteClient 模拟投票客户端
type mockVoteClient struct {
	syncResult     *types.SyncChatResult
	shouldFail     bool
	delay          time.Duration
	lastTools      []openai.Tool
	lastToolChoice any
	lastMessages   []types.ContextMessage
}

func (m *mockVoteClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	return nil, nil
}

func (m *mockVoteClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	result, err := m.SendChatRequestSyncDetailed(ctx, messages, tools, toolChoice)
	if err != nil {
		return "", err
	}
	if result == nil {
		return "", nil
	}
	return result.Content, nil
}

func (m *mockVoteClient) SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error) {
	m.lastTools = append([]openai.Tool(nil), tools...)
	m.lastToolChoice = toolChoice
	m.lastMessages = append([]types.ContextMessage(nil), messages...)

	if m.delay > 0 {
		select {
		case <-time.After(m.delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	if m.shouldFail {
		return nil, context.DeadlineExceeded
	}

	if m.syncResult == nil {
		return &types.SyncChatResult{}, nil
	}
	return m.syncResult, nil
}

func (m *mockVoteClient) GetModel() string {
	return "gpt-4"
}

func createVoteMockSage(name string, client *mockVoteClient) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: name,
		},
	}
	return sages.NewSage(name, cfg, client, nil)
}

func buildVoteSyncResult(decision, reason string) *types.SyncChatResult {
	args, _ := json.Marshal(map[string]string{
		"decision": decision,
		"reason":   reason,
	})
	return &types.SyncChatResult{
		ToolCalls: []types.ToolCall{
			{
				ID:    "vote-call-1",
				Type:  "function",
				Index: 0,
				Function: types.ToolCallFunction{
					Name:      config.VoteToolName,
					Arguments: string(args),
				},
			},
		},
		FinishReason: "tool_calls",
	}
}

// TestProcessVoting_BothApprove 测试两个贤者都批准
func TestProcessVoting_BothApprove(t *testing.T) {
	balthazarClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "逻辑合理")}
	casperClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "直觉认同")}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断", ProposerDisplayName: "Melchior"},
		"", "",
		defaultTestVotingCfg,
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Melchior != voteApprove {
		t.Errorf("Melchior应该批准，实际: %s", result.Melchior)
	}
	if result.Balthazar != voteApprove {
		t.Errorf("Balthazar应该批准，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（3/3批准）")
	}

	hasVote := false
	for _, t := range balthazarClient.lastTools {
		if t.Function != nil && strings.TrimSpace(t.Function.Name) == config.VoteToolName {
			hasVote = true
			break
		}
	}
	if !hasVote {
		t.Fatalf("Balthazar 投票未收到 vote 工具: %d 个工具", len(balthazarClient.lastTools))
	}
	if balthazarClient.lastToolChoice != nil {
		t.Fatalf("Balthazar 调查阶段 toolChoice 应为 nil，实际=%#v", balthazarClient.lastToolChoice)
	}
}

// TestProcessVoting_PartialApprove 测试部分批准（2/3通过）
func TestProcessVoting_PartialApprove(t *testing.T) {
	balthazarClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "可以接受")}
	casperClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteReject, "有风险")}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断", ProposerDisplayName: "Melchior"},
		"", "",
		defaultTestVotingCfg,
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Balthazar != voteApprove {
		t.Errorf("Balthazar应该批准，实际: %s", result.Balthazar)
	}
	if result.Casper != voteReject {
		t.Errorf("Casper应该否决，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（2/3批准）")
	}
}

// TestProcessVoting_BothReject 测试两个贤者都否决
func TestProcessVoting_BothReject(t *testing.T) {
	balthazarClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteReject, "逻辑不通")}
	casperClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteReject, "直觉反对")}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断", ProposerDisplayName: "Melchior"},
		"", "",
		defaultTestVotingCfg,
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Balthazar != voteReject {
		t.Errorf("Balthazar应该否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteReject {
		t.Errorf("Casper应该否决，实际: %s", result.Casper)
	}
	if result.Passed {
		t.Error("投票不应该通过（1/3批准）")
	}
}

// TestProcessVoting_Timeout 测试超时处理（D-005）
func TestProcessVoting_Timeout(t *testing.T) {
	balthazarClient := &mockVoteClient{delay: 35 * time.Second}
	casperClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "正常")}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断", ProposerDisplayName: "Melchior"},
		"", "",
		defaultTestVotingCfg,
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	// D-005: 超时视为否决票
	if result.Balthazar != voteReject {
		t.Errorf("Balthazar超时应该视为否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（2/3批准）")
	}
}

// TestParseDecision_ToolCallFormat 测试 tool call 严格解析
func TestParseDecision_ToolCallFormat(t *testing.T) {
	tests := []struct {
		name        string
		result      *types.SyncChatResult
		expected    string
		shouldError bool
	}{
		{"批准工具调用", buildVoteSyncResult(voteApprove, "测试"), voteApprove, false},
		{"否决工具调用", buildVoteSyncResult(voteReject, "测试"), voteReject, false},
		{"纯文本响应", &types.SyncChatResult{Content: "我认为应该批准这个提案"}, "", true},
		{"错误工具名", &types.SyncChatResult{ToolCalls: []types.ToolCall{{Function: types.ToolCallFunction{Name: "other", Arguments: `{"decision":"批准","reason":"测试"}`}}}}, "", true},
		{"参数非法", &types.SyncChatResult{ToolCalls: []types.ToolCall{{Function: types.ToolCallFunction{Name: config.VoteToolName, Arguments: `not-json`}}}}, "", true},
		{"缺少reason", &types.SyncChatResult{ToolCalls: []types.ToolCall{{Function: types.ToolCallFunction{Name: config.VoteToolName, Arguments: `{"decision":"批准"}`}}}}, "", true},
		{"空响应", nil, "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseDecision(tt.result)
			if tt.shouldError {
				if err == nil {
					t.Fatalf("parseDecision(%#v) 应该返回错误但没有", tt.result)
				}
			} else {
				if err != nil {
					t.Fatalf("parseDecision(%#v) 返回错误: %v", tt.result, err)
				}
				if result != tt.expected {
					t.Errorf("parseDecision() = %q, 期望 %q", result, tt.expected)
				}
			}
		})
	}
}

// TestComputePassed 测试投票通过计算
func TestComputePassed(t *testing.T) {
	tests := []struct {
		name       string
		result     *VoteResult
		shouldPass bool
	}{
		{"全部批准", &VoteResult{Melchior: voteApprove, Balthazar: voteApprove, Casper: voteApprove}, true},
		{"两票批准", &VoteResult{Melchior: voteApprove, Balthazar: voteApprove, Casper: voteReject}, true},
		{"一票批准", &VoteResult{Melchior: voteApprove, Balthazar: voteReject, Casper: voteReject}, false},
		{"全部否决", &VoteResult{Melchior: voteReject, Balthazar: voteReject, Casper: voteReject}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			passed := computePassed(tt.result)
			if passed != tt.shouldPass {
				t.Errorf("computePassed() = %v, 期望 %v", passed, tt.shouldPass)
			}
		})
	}
}

// TestBuildVoteSystemPrompt 测试系统提示词构建
func TestBuildVoteSystemPrompt(t *testing.T) {
	prompt := buildVoteSystemPrompt("Balthazar")

	if !contains(prompt, "Balthazar") {
		t.Error("系统提示词应该包含贤者名称")
	}
	if !contains(prompt, "批准") || !contains(prompt, "否决") {
		t.Error("系统提示词应该包含投票选项")
	}
	if !contains(prompt, config.VoteToolName) || !contains(prompt, "禁止输出普通文本") {
		t.Error("系统提示词应该要求调用 vote 工具且禁止正文输出")
	}
}

// TestBuildVoteUserInput 测试用户输入构建
func TestBuildVoteUserInput(t *testing.T) {
	voteCtx := VoteContext{
		UserMessage:         "用户测试输入",
		MelchiorConclusion:  "Melchior测试判断",
		ProposerDisplayName: "Melchior",
	}

	input, err := buildVoteUserInput("测试提案", voteCtx)
	if err != nil {
		t.Fatalf("buildVoteUserInput() 返回错误: %v", err)
	}

	if !contains(input, "用户测试输入") {
		t.Error("用户输入应该包含用户消息")
	}
	if !contains(input, "Melchior测试判断") {
		t.Error("用户输入应该包含Melchior判断")
	}
	if !contains(input, "测试提案") {
		t.Error("用户输入应该包含提案内容")
	}
}

func TestBuildVoteUserInput_MissingFieldsReturnsError(t *testing.T) {
	_, err := buildVoteUserInput("", VoteContext{})
	if err == nil {
		t.Fatal("期望缺字段时直接报错")
	}
}

func TestGetRealVote_UsesFullSessionHistoryAndRawToolCallForGovernedAction(t *testing.T) {
	balthazarClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "可以执行")}
	balthazar := createVoteMockSage("Balthazar", balthazarClient)

	sessionID := "governed-action-session"
	_ = balthazar.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:    types.RoleSystem,
		Content: "你是 Balthazar。",
	})
	_ = balthazar.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:    types.RoleUser,
		Content: "把这次进展记下来。",
	})
	_ = balthazar.AddToContextWithSession(sessionID, types.ContextMessage{
		Role:    types.RoleAssistant,
		Content: "我准备先整理一下。",
	})

	pendingToolCall := types.ToolCall{
		ID:   "governed-tool-call-1",
		Type: "function",
		Function: types.ToolCallFunction{
			Name:      config.WriteDiaryToolName,
			Arguments: `{"motivation":"记录当前推进","markdown":"# 进展\n\n- 已完成接线","calloutType":"NOTE","title":"行动日志"}`,
		},
	}

	decision, err := getRealVote(
		context.Background(),
		sessionID,
		balthazar,
		config.WriteDiaryToolName,
		VoteContext{
			ProposerConclusion:     "准备写入日记。",
			GovernedActionToolCall: &pendingToolCall,
		},
		defaultTestVotingCfg,
	)
	if err != nil {
		t.Fatalf("getRealVote() 返回错误: %v", err)
	}
	if decision.Decision != voteApprove {
		t.Fatalf("期望批准，实际=%s", decision.Decision)
	}

	if len(balthazarClient.lastMessages) < 5 {
		t.Fatalf("期望投票请求携带完整历史和待审核 tool call，实际消息=%+v", balthazarClient.lastMessages)
	}

	foundOriginalSystem := false
	foundOriginalUser := false
	foundReviewPayload := false
	for _, message := range balthazarClient.lastMessages {
		if message.Role == types.RoleAssistant && len(message.ToolCalls) > 0 {
			t.Fatalf("行动审核请求不应再发送未完成的 assistant tool_calls，实际=%+v", balthazarClient.lastMessages)
		}
		if message.Role == types.RoleSystem && message.Content == "你是 Balthazar。" {
			foundOriginalSystem = true
		}
		// 注意：status 信封（<status>）会追加到历史 user 消息尾部（前缀缓存优化），
		// 因此这里用包含匹配验证用户历史仍被保留。
		if message.Role == types.RoleUser && strings.Contains(message.Content, "把这次进展记下来。") {
			foundOriginalUser = true
		}
		if message.Role == types.RoleUser {
			var payload struct {
				Type        string `json:"type"`
				Instruction string `json:"instruction"`
				ToolCall    struct {
					ID       string `json:"id"`
					Type     string `json:"type"`
					Function struct {
						Name      string                 `json:"name"`
						Arguments map[string]interface{} `json:"arguments"`
					} `json:"function"`
				} `json:"toolCall"`
			}
			if json.Unmarshal([]byte(message.Content), &payload) == nil && payload.Type == "pending_action_review" {
				foundReviewPayload = payload.Instruction != "" &&
					payload.ToolCall.ID == pendingToolCall.ID &&
					payload.ToolCall.Type == pendingToolCall.Type &&
					payload.ToolCall.Function.Name == pendingToolCall.Function.Name &&
					payload.ToolCall.Function.Arguments["motivation"] == "记录当前推进" &&
					payload.ToolCall.Function.Arguments["markdown"] == "# 进展\n\n- 已完成接线" &&
					payload.ToolCall.Function.Arguments["calloutType"] == "NOTE" &&
					payload.ToolCall.Function.Arguments["title"] == "行动日志"
			}
		}
	}
	if !foundOriginalSystem {
		t.Fatalf("期望保留原始系统历史，实际=%+v", balthazarClient.lastMessages)
	}
	if !foundOriginalUser {
		t.Fatalf("期望保留原始用户历史，实际=%+v", balthazarClient.lastMessages)
	}
	if !foundReviewPayload {
		t.Fatalf("期望投票请求包含原始待审核行动请求 JSON，实际=%+v", balthazarClient.lastMessages)
	}
}

func contains(s, substr string) bool {
	return len(s) > 0 && len(substr) > 0 && (s == substr || len(s) > len(substr) && findSubstring(s, substr))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// TestProcessVoting_Failure 测试失败处理（D-005）
func TestProcessVoting_Failure(t *testing.T) {
	balthazarClient := &mockVoteClient{shouldFail: true}
	casperClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "正常")}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断", ProposerDisplayName: "Melchior"},
		"", "",
		defaultTestVotingCfg,
	)

	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	// D-005: 失败视为否决票
	if result.Balthazar != voteReject {
		t.Errorf("Balthazar失败应该视为否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
	if !result.Passed {
		t.Error("投票应该通过（2/3批准）")
	}
}

func TestProcessVoting_ParseFailureRejects(t *testing.T) {
	balthazarClient := &mockVoteClient{syncResult: &types.SyncChatResult{Content: "我认为应该批准这个提案"}}
	casperClient := &mockVoteClient{syncResult: buildVoteSyncResult(voteApprove, "正常")}

	balthazar := createVoteMockSage("Balthazar", balthazarClient)
	casper := createVoteMockSage("Casper", casperClient)

	result, err := ProcessVoting(
		context.Background(),
		"test-session",
		"test-round",
		balthazar,
		casper,
		"测试提案",
		VoteContext{UserMessage: "用户输入", MelchiorConclusion: "Melchior判断", ProposerDisplayName: "Melchior"},
		"", "",
		defaultTestVotingCfg,
	)
	if err != nil {
		t.Fatalf("ProcessVoting失败: %v", err)
	}

	if result.Balthazar != voteReject {
		t.Errorf("解析失败应该视为否决，实际: %s", result.Balthazar)
	}
	if result.Casper != voteApprove {
		t.Errorf("Casper应该批准，实际: %s", result.Casper)
	}
}
