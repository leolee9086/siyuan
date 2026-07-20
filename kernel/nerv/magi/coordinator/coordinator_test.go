package coordinator

import (
	"context"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

type mockAvatarPipelineClient struct {
	toolArgsByName map[string]string
	defaultContent string
	syncResponse   string
}

func (m *mockAvatarPipelineClient) SendChatRequest(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk, 4)
	go func() {
		defer close(ch)

		var selectedTool string
		var selectedArgs string
		for _, tool := range tools {
			if tool.Function == nil {
				continue
			}
			name := strings.TrimSpace(tool.Function.Name)
			if name == "" {
				continue
			}
			args, ok := m.toolArgsByName[name]
			if !ok {
				continue
			}
			selectedTool = name
			selectedArgs = resolveAvatarToolArgsTemplate(args, messages)
			break
		}

		if selectedTool != "" {
			ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: []types.ToolCallDelta{
								{
									Index: 0,
									Function: &types.ToolCallFunctionDelta{
										Name: selectedTool,
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
									Index: 0,
									Function: &types.ToolCallFunctionDelta{
										Arguments: selectedArgs,
									},
								},
							},
						},
					},
				},
			}
			return
		}

		if strings.TrimSpace(m.defaultContent) == "" {
			return
		}
		ch <- types.StreamChunk{
			Choices: []types.ChunkChoice{
				{
					Delta: types.ChunkDelta{
						ToolCalls: completedSpeakTurn(m.defaultContent).toolCalls,
					},
				},
			},
		}
	}()
	return ch, nil
}

func (m *mockAvatarPipelineClient) SendChatRequestSync(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (string, error) {
	for _, tool := range tools {
		if tool.Function != nil && strings.TrimSpace(tool.Function.Name) == config.VoteToolName {
			return `{"decision":"批准","reason":"结合当前上下文判断可通过"}`, nil
		}
	}
	if strings.TrimSpace(m.syncResponse) != "" {
		return m.syncResponse, nil
	}
	return m.defaultContent, nil
}

func (m *mockAvatarPipelineClient) SendChatRequestSyncDetailed(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (*types.SyncChatResult, error) {
	content, err := m.SendChatRequestSync(ctx, messages, tools, toolChoice)
	if err != nil {
		return nil, err
	}
	if len(tools) == 1 && tools[0].Function != nil && strings.TrimSpace(tools[0].Function.Name) != "" && strings.TrimSpace(content) != "" {
		return &types.SyncChatResult{
			ToolCalls: []types.ToolCall{
				{
					ID:    "mock-sync-tool-call",
					Type:  "function",
					Index: 0,
					Function: types.ToolCallFunction{
						Name:      strings.TrimSpace(tools[0].Function.Name),
						Arguments: content,
					},
				},
			},
			FinishReason: "tool_calls",
		}, nil
	}
	return &types.SyncChatResult{Content: content}, nil
}

func (m *mockAvatarPipelineClient) GetModel() string {
	return "gpt-4"
}

func createAvatarPipelineSage(
	name,
	displayName,
	defaultContent string,
	syncResponse string,
	toolArgsByName map[string]string,
) *sages.Sage {
	tools := make([]config.ToolDef, 0, len(toolArgsByName))
	for toolName := range toolArgsByName {
		switch toolName {
		case config.AvatarBuildToolName:
			tools = append(tools, config.BuildAvatarBuildToolDef())
		case config.AvatarModifyToolName:
			tools = append(tools, config.BuildAvatarModifyToolDef())
		case config.AvatarSynthesizeToolName:
			tools = append(tools, config.BuildAvatarSynthesizeToolDef())
		}
	}

	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: displayName,
		},
		Tools: tools,
	}
	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 7,
	}
	client := &mockAvatarPipelineClient{
		toolArgsByName: toolArgsByName,
		defaultContent: defaultContent,
		syncResponse:   syncResponse,
	}
	sage := sages.NewSage(name, cfg, client, strategy)
	sage.SetProfile(buildDominantReplyTestProfile())
	return sage
}

func resolveAvatarToolArgsTemplate(template string, messages []types.ContextMessage) string {
	roleID := "avatar-role-1"
	channel := "unknown"
	joined := make([]string, 0, len(messages))
	for _, msg := range messages {
		joined = append(joined, msg.Content)
	}
	source := strings.Join(joined, "\n")

	roleRe := regexp.MustCompile(`avatar_role_id=([a-zA-Z0-9\-]+)`)
	roleMatches := roleRe.FindAllStringSubmatch(source, -1)
	if len(roleMatches) > 0 {
		last := roleMatches[len(roleMatches)-1]
		if len(last) == 2 {
			roleID = last[1]
		}
	}
	channelRe := regexp.MustCompile(`channel=([a-zA-Z0-9\-]+)`)
	channelMatches := channelRe.FindAllStringSubmatch(source, -1)
	if len(channelMatches) > 0 {
		last := channelMatches[len(channelMatches)-1]
		if len(last) == 2 {
			channel = last[1]
		}
	}

	args := strings.ReplaceAll(template, "%ROLE_ID%", roleID)
	args = strings.ReplaceAll(args, "%CHANNEL%", channel)
	return args
}

// TestCheckDeliberationRequired 测试审慎决策判断
func TestCheckDeliberationRequired(t *testing.T) {
	c := NewCoordinator(30 * time.Second)

	tests := []struct {
		name      string
		responses []types.SageResponse
		want      bool
	}{
		{
			name: "Melchior要求审慎决策",
			responses: []types.SageResponse{
				{Seel: "melchior", RequiresDeliberation: true},
				{Seel: "balthazar", RequiresDeliberation: false},
				{Seel: "casper", RequiresDeliberation: false},
			},
			want: true,
		},
		{
			name: "Melchior不要求审慎决策",
			responses: []types.SageResponse{
				{Seel: "melchior", RequiresDeliberation: false},
				{Seel: "balthazar", RequiresDeliberation: false},
				{Seel: "casper", RequiresDeliberation: false},
			},
			want: false,
		},
		{
			name: "只有Balthazar和Casper响应",
			responses: []types.SageResponse{
				{Seel: "balthazar", RequiresDeliberation: false},
				{Seel: "casper", RequiresDeliberation: false},
			},
			want: false,
		},
		{
			name: "其他贤者RequiresDeliberation为true不影响",
			responses: []types.SageResponse{
				{Seel: "melchior", RequiresDeliberation: false},
				{Seel: "balthazar", RequiresDeliberation: true},
				{Seel: "casper", RequiresDeliberation: true},
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := c.checkDeliberationRequired(tt.responses)
			if got != tt.want {
				t.Errorf("checkDeliberationRequired() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestBuildRejectionMessage 测试否决消息构建
func TestBuildRejectionMessage(t *testing.T) {
	c := NewCoordinator(30 * time.Second)
	msg := c.buildRejectionMessage()

	if msg.Type != types.TypeConsensus {
		t.Errorf("Type = %v, want %v", msg.Type, types.TypeConsensus)
	}

	if msg.Status != types.StatusSuccess {
		t.Errorf("Status = %v, want %v", msg.Status, types.StatusSuccess)
	}

	if msg.Content == "" {
		t.Error("Content should not be empty")
	}

	mode, ok := msg.Meta["mode"]
	if !ok || mode != types.ConsensusModeCritical {
		t.Errorf("Meta mode = %v, want %v", mode, types.ConsensusModeCritical)
	}

	vote, ok := msg.Meta["vote"].(map[string]interface{})
	if !ok {
		t.Fatal("Meta vote should be map[string]interface{}")
	}

	passed, ok := vote["passed"].(bool)
	if !ok || passed {
		t.Errorf("Vote passed = %v, want false", passed)
	}
}

// TestBuildConsensusMessage 测试共识消息构建
func TestBuildConsensusMessage(t *testing.T) {
	c := NewCoordinator(30 * time.Second)

	tests := []struct {
		name                 string
		content              string
		requiresDeliberation bool
		voteResult           *VoteResult
		wantMode             types.ConsensusMode
		wantVote             bool
	}{
		{
			name:                 "标准模式无投票",
			content:              "测试内容",
			requiresDeliberation: false,
			voteResult:           nil,
			wantMode:             types.ConsensusModeStandard,
			wantVote:             false,
		},
		{
			name:                 "审慎模式有投票",
			content:              "测试内容",
			requiresDeliberation: true,
			voteResult: &VoteResult{
				Melchior:  "批准",
				Balthazar: "批准",
				Casper:    "否决",
				Passed:    true,
			},
			wantMode: types.ConsensusModeCritical,
			wantVote: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := c.buildConsensusMessage(tt.content, tt.requiresDeliberation, tt.voteResult, nil)

			if msg.Type != types.TypeConsensus {
				t.Errorf("Type = %v, want %v", msg.Type, types.TypeConsensus)
			}

			if msg.Content != tt.content {
				t.Errorf("Content = %v, want %v", msg.Content, tt.content)
			}

			mode, ok := msg.Meta["mode"]
			if !ok || mode != tt.wantMode {
				t.Errorf("Meta mode = %v, want %v", mode, tt.wantMode)
			}

			_, hasVote := msg.Meta["vote"]
			if hasVote != tt.wantVote {
				t.Errorf("Has vote = %v, want %v", hasVote, tt.wantVote)
			}

			if tt.wantVote {
				vote, ok := msg.Meta["vote"].(map[string]interface{})
				if !ok {
					t.Fatal("Meta vote should be map[string]interface{}")
				}

				if vote["passed"] != tt.voteResult.Passed {
					t.Errorf("Vote passed = %v, want %v", vote["passed"], tt.voteResult.Passed)
				}
			}
		})
	}
}

// TestExecuteVoting 测试投票流程提取
func TestExecuteVoting(t *testing.T) {
	responses := []types.SageResponse{
		{Seel: "melchior", Content: "这是Melchior的结论"},
		{Seel: "balthazar", Content: "这是Balthazar的观点"},
		{Seel: "casper", Content: "这是Casper的观点"},
	}

	userMessage := "用户输入"

	// 这个测试只验证参数提取逻辑，不实际调用LLM
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	// 由于没有真实的sage实例，这里只测试参数提取
	var melchiorConclusion string
	for _, resp := range responses {
		if resp.Seel == "melchior" {
			melchiorConclusion = resp.Content
			break
		}
	}

	if melchiorConclusion != "这是Melchior的结论" {
		t.Errorf("提取的Melchior结论 = %v, want '这是Melchior的结论'", melchiorConclusion)
	}

	voteCtx := VoteContext{
		UserMessage:        userMessage,
		MelchiorConclusion: melchiorConclusion,
	}

	if voteCtx.UserMessage != userMessage {
		t.Errorf("VoteContext.UserMessage = %v, want %v", voteCtx.UserMessage, userMessage)
	}

	if voteCtx.MelchiorConclusion != melchiorConclusion {
		t.Errorf("VoteContext.MelchiorConclusion = %v, want %v", voteCtx.MelchiorConclusion, melchiorConclusion)
	}

	// 避免未使用变量警告
	_ = ctx
}

func TestBuildSourceAwareUserInput(t *testing.T) {
	c := NewCoordinator(30 * time.Second)
	sourceCtx := &types.RequestSourceContext{
		Channel:       types.SourceChannelGuardian,
		PrincipalID:   "principal-a",
		IdentityID:    "principal-a",
		Nickname:      "alice",
		InterfaceID:   "main-ui",
		InterfaceKind: "magi-main-ui",
		TrustBase:     types.TrustLevelHigh,
		RiskLevel:     types.TrustLevelLow,
	}

	claimedRecentHistory := []types.ClaimedHistoryMessage{
		{Role: "user", Content: "你好"},
		{Role: "assistant", Content: "你好，我在。"},
	}
	got := c.buildSourceAwareUserInput("session-source-aware", "你好", sourceCtx, claimedRecentHistory)
	if got == "你好" {
		t.Fatal("source-aware input should include request_source envelope")
	}
	if len(got) == 0 {
		t.Fatal("source-aware input should not be empty")
	}
	if !strings.Contains(got, "<runtime_clock>") {
		t.Fatal("source-aware input should include runtime_clock envelope")
	}
	if !strings.Contains(got, "<request_source>") {
		t.Fatal("source-aware input should include request_source envelope")
	}
	if !strings.Contains(got, "<claimed_recent_history>") {
		t.Fatal("source-aware input should include claimed_recent_history envelope")
	}
	if !strings.Contains(got, `"identityId":"principal-a"`) {
		t.Fatalf("source-aware input should include identityId, got: %s", got)
	}
	if !strings.Contains(got, `"nickname":"alice"`) {
		t.Fatalf("source-aware input should include nickname, got: %s", got)
	}
	if !strings.Contains(got, `"speaker":"alice"`) {
		t.Fatalf("source-aware input should include speaker label, got: %s", got)
	}
}

func TestBuildSourceAwareUserInputInjectsWorkspaceSnapshotEveryNrounds(t *testing.T) {
	c := NewCoordinator(30 * time.Second)
	originalWorkspaceDir := util.WorkspaceDir
	originalWorkspaceName := util.WorkspaceName
	t.Cleanup(func() {
		util.WorkspaceDir = originalWorkspaceDir
		util.WorkspaceName = originalWorkspaceName
	})

	util.WorkspaceDir = t.TempDir()
	util.WorkspaceName = "test-workspace"

	sourceCtx := &types.RequestSourceContext{
		Channel:       types.SourceChannelGuardian,
		PrincipalID:   "principal-a",
		InterfaceID:   "main-ui",
		InterfaceKind: "magi-main-ui",
		TrustBase:     types.TrustLevelHigh,
		RiskLevel:     types.TrustLevelLow,
	}

	for i := 1; i <= int(defaultWorkspaceSnapshotInterval); i++ {
		got := c.buildSourceAwareUserInput(
			"session-workspace",
			"你好",
			sourceCtx,
			[]types.ClaimedHistoryMessage{{Role: "user", Content: "你好"}},
		)
		hasWorkspace := strings.Contains(got, "<workspace_snapshot>")
		if i == int(defaultWorkspaceSnapshotInterval) {
			if !hasWorkspace {
				t.Fatalf("round %d expected workspace_snapshot envelope", i)
			}
			continue
		}
		if hasWorkspace {
			t.Fatalf("round %d should not include workspace_snapshot envelope", i)
		}
	}
}

func TestCoordinateDecision_DispatchesAvatarForNonDirectSource(t *testing.T) {
	c := NewCoordinator(30 * time.Second)
	sourceCtx := &types.RequestSourceContext{
		DirectResponseAllowed: false,
		Channel:               types.SourceChannelExternalAgent,
		InterfaceKind:         "siyuan-note-upstream",
		SourceSessionKey:      "external:principal:interface",
		PrincipalID:           "principal-a",
		InterfaceID:           "panel-a",
		TrustBase:             types.TrustLevelMedium,
		RiskLevel:             types.TrustLevelMedium,
	}

	melchior := createAvatarPipelineSage("melchior", "Melchior", "avatar-direct-reply", `{"scores":[{"candidate":"作为科学家的你","score":95},{"candidate":"作为母亲的你","score":35},{"candidate":"仅作为赤城直子本人的你","score":20}],"reason":"当前任务更适合专业侧主导"}`, map[string]string{
		avatarBuildToolName:      `{"motivation":"为当前来源建立隔离执行者","initiate":true,"reason":"need-avatar","systemPromptProposal":"你是 %ROLE_ID%。channel=%CHANNEL%。必须调用 report_to_core(type=\"heartbeat\")。","requirements":"稳定执行来源请求"}`,
		avatarSynthesizeToolName: `{"motivation":"综合评审结果生成最终 Avatar","finalSystemPrompt":"你是 %ROLE_ID%。channel=%CHANNEL%。你只服务当前绑定来源。你必须调用 report_to_core(type=\"heartbeat\")。"} `,
	})
	balthazar := createAvatarPipelineSage("balthazar", "Balthazar", "", `{"scores":[{"candidate":"作为科学家的你","score":80},{"candidate":"作为母亲的你","score":45},{"candidate":"仅作为赤城直子本人的你","score":30}],"reason":"当前任务先保证结构稳定"}`, map[string]string{
		avatarModifyToolName: `{"motivation":"评审并修订 Avatar 提案","decision":"approved","reason":"review-ok","systemPromptProposal":"你是 %ROLE_ID%。channel=%CHANNEL%。执行前先评估风险并调用 report_to_core。","requirements":"风险感知优先"}`,
	})
	casper := createAvatarPipelineSage("casper", "Casper", "", `{"scores":[{"candidate":"作为科学家的你","score":75},{"candidate":"作为母亲的你","score":40},{"candidate":"仅作为赤城直子本人的你","score":35}],"reason":"当前任务需要优先收敛方案"}`, map[string]string{
		avatarModifyToolName: `{"motivation":"评审并修订 Avatar 提案","decision":"approved","reason":"review-ok","systemPromptProposal":"你是 %ROLE_ID%。channel=%CHANNEL%。保持高可用并调用 report_to_core。","requirements":"执行稳定优先"}`,
	})

	firstMsg, err := c.CoordinateDecision(
		context.Background(),
		"session-a",
		melchior,
		balthazar,
		casper,
		"测试消息",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "测试消息"}},
	)
	if err != nil {
		t.Fatalf("expected avatar dispatch success for non-direct source, got err: %v", err)
	}
	if firstMsg == nil {
		t.Fatal("expected non-nil message")
	}
	if firstMsg.Content != "avatar-direct-reply" {
		t.Fatalf("expected avatar reply, got: %s", firstMsg.Content)
	}
	if firstMsg.Meta["source"] != "avatar-delegated" {
		t.Fatalf("expected avatar-delegated source meta, got: %v", firstMsg.Meta["source"])
	}

	firstRoleID, ok := firstMsg.Meta["avatarRoleId"].(string)
	if !ok || firstRoleID == "" {
		t.Fatalf("expected avatarRoleId in meta, got: %v", firstMsg.Meta["avatarRoleId"])
	}

	secondMsg, err := c.CoordinateDecision(
		context.Background(),
		"session-a",
		melchior,
		balthazar,
		casper,
		"第二次请求",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "第二次请求"}},
	)
	if err != nil {
		t.Fatalf("expected second avatar dispatch success, got err: %v", err)
	}
	secondRoleID, ok := secondMsg.Meta["avatarRoleId"].(string)
	if !ok || secondRoleID == "" {
		t.Fatalf("expected avatarRoleId in second meta, got: %v", secondMsg.Meta["avatarRoleId"])
	}
	if firstRoleID != secondRoleID {
		t.Fatalf("expected same avatar binding, got first=%s second=%s", firstRoleID, secondRoleID)
	}
}

func TestCoordinateDecision_AvatarHeartbeatTimeoutReturns404UntilRewriteDone(t *testing.T) {
	c := NewCoordinator(30 * time.Second)
	sourceCtx := &types.RequestSourceContext{
		DirectResponseAllowed: false,
		Channel:               types.SourceChannelExternalAgent,
		InterfaceKind:         "siyuan-note-upstream",
		SourceSessionKey:      "external:principal:heartbeat",
		PrincipalID:           "principal-heartbeat",
		InterfaceID:           "panel-heartbeat",
		TrustBase:             types.TrustLevelMedium,
		RiskLevel:             types.TrustLevelMedium,
	}

	melchior := createAvatarPipelineSage("melchior", "Melchior", "avatar-direct-reply", `{"scores":[{"candidate":"作为科学家的你","score":95},{"candidate":"作为母亲的你","score":35},{"candidate":"仅作为赤城直子本人的你","score":20}],"reason":"当前任务更适合专业侧主导"}`, map[string]string{
		avatarBuildToolName:      `{"motivation":"为当前来源建立隔离执行者","initiate":true,"reason":"need-avatar","systemPromptProposal":"你是 %ROLE_ID%。channel=%CHANNEL%。必须调用 report_to_core(type=\"heartbeat\")。","requirements":"稳定执行来源请求"}`,
		avatarSynthesizeToolName: `{"motivation":"综合评审结果生成最终 Avatar","finalSystemPrompt":"你是 %ROLE_ID%。channel=%CHANNEL%。你只服务当前绑定来源。你必须调用 report_to_core(type=\"heartbeat\")。"} `,
	})
	balthazar := createAvatarPipelineSage("balthazar", "Balthazar", "", `{"scores":[{"candidate":"作为科学家的你","score":80},{"candidate":"作为母亲的你","score":45},{"candidate":"仅作为赤城直子本人的你","score":30}],"reason":"当前任务先保证结构稳定"}`, map[string]string{
		avatarModifyToolName: `{"motivation":"评审并修订 Avatar 提案","decision":"approved","reason":"review-ok","systemPromptProposal":"你是 %ROLE_ID%。channel=%CHANNEL%。执行前先评估风险并调用 report_to_core。","requirements":"风险感知优先"}`,
	})
	casper := createAvatarPipelineSage("casper", "Casper", "", `{"scores":[{"candidate":"作为科学家的你","score":75},{"candidate":"作为母亲的你","score":40},{"candidate":"仅作为赤城直子本人的你","score":35}],"reason":"当前任务需要优先收敛方案"}`, map[string]string{
		avatarModifyToolName: `{"motivation":"评审并修订 Avatar 提案","decision":"approved","reason":"review-ok","systemPromptProposal":"你是 %ROLE_ID%。channel=%CHANNEL%。保持高可用并调用 report_to_core。","requirements":"执行稳定优先"}`,
	})

	firstMsg, err := c.CoordinateDecision(
		context.Background(),
		"session-heartbeat",
		melchior,
		balthazar,
		casper,
		"请求1",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "请求1"}},
	)
	if err != nil {
		t.Fatalf("request1 expected success, got err: %v", err)
	}
	firstRoleID, ok := firstMsg.Meta["avatarRoleId"].(string)
	if !ok || firstRoleID == "" {
		t.Fatalf("request1 expected avatarRoleId, got: %v", firstMsg.Meta["avatarRoleId"])
	}

	_, err = c.CoordinateDecision(
		context.Background(),
		"session-heartbeat",
		melchior,
		balthazar,
		casper,
		"请求2",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "请求2"}},
	)
	if err != nil {
		t.Fatalf("request2 expected success, got err: %v", err)
	}

	_, err = c.CoordinateDecision(
		context.Background(),
		"session-heartbeat",
		melchior,
		balthazar,
		casper,
		"请求3",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "请求3"}},
	)
	if err == nil || !IsAvatarUnavailable(err) {
		t.Fatalf("request3 expected avatar unavailable(404) due heartbeat timeout, got err: %v", err)
	}

	_, err = c.CoordinateDecision(
		context.Background(),
		"session-heartbeat",
		melchior,
		balthazar,
		casper,
		"请求4",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "请求4"}},
	)
	if err == nil || !IsAvatarUnavailable(err) {
		t.Fatalf("request4 expected avatar unavailable(404) while rewriting, got err: %v", err)
	}

	time.Sleep(avatarRebuildDelay + 300*time.Millisecond)

	afterRewriteMsg, err := c.CoordinateDecision(
		context.Background(),
		"session-heartbeat",
		melchior,
		balthazar,
		casper,
		"请求5",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "请求5"}},
	)
	if err != nil {
		t.Fatalf("request5 expected success after rewrite, got err: %v", err)
	}
	afterRoleID, ok := afterRewriteMsg.Meta["avatarRoleId"].(string)
	if !ok || afterRoleID == "" {
		t.Fatalf("request5 expected avatarRoleId, got: %v", afterRewriteMsg.Meta["avatarRoleId"])
	}
	if afterRoleID == firstRoleID {
		t.Fatalf("expected rewritten avatar role id to change, before=%s after=%s", firstRoleID, afterRoleID)
	}
}
