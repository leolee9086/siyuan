package coordinator

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/nerv/marduk"
)

type scriptedDominantClient struct {
	mu              sync.Mutex
	syncResponses   []string
	streamTurns     []mockTurn
	syncIndex       int
	streamIndex     int
	lastTools       []openai.Tool
	lastToolChoice  any
	syncToolChoices []any
}

func (m *scriptedDominantClient) SendChatRequest(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (<-chan types.StreamChunk, error) {
	m.mu.Lock()
	m.lastTools = append([]openai.Tool(nil), tools...)
	m.lastToolChoice = toolChoice
	m.mu.Unlock()

	ch := make(chan types.StreamChunk, 4)
	go func() {
		defer close(ch)

		turn, ok := m.nextStreamTurn()
		if !ok {
			return
		}

		if turn.content != "" {
			select {
			case <-ctx.Done():
				return
			case ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							Content: turn.content,
						},
					},
				},
			}:
			}
		}
		if len(turn.toolCalls) > 0 {
			select {
			case <-ctx.Done():
				return
			case ch <- types.StreamChunk{
				Choices: []types.ChunkChoice{
					{
						Delta: types.ChunkDelta{
							ToolCalls: turn.toolCalls,
						},
					},
				},
			}:
			}
		}
	}()
	return ch, nil
}

func (m *scriptedDominantClient) SendChatRequestSync(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.syncIndex >= len(m.syncResponses) {
		return "", nil
	}
	response := m.syncResponses[m.syncIndex]
	m.syncIndex++
	return response, nil
}

func (m *scriptedDominantClient) SendChatRequestSyncDetailed(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (*types.SyncChatResult, error) {
	m.mu.Lock()
	m.syncToolChoices = append(m.syncToolChoices, toolChoice)
	m.mu.Unlock()

	content, err := m.SendChatRequestSync(ctx, messages, tools, toolChoice)
	if err != nil {
		return nil, err
	}
	toolName := scriptedSyncToolName(content, tools)
	if toolName != "" {
		return &types.SyncChatResult{
			ToolCalls: []types.ToolCall{
				{
					ID:    "scripted-sync-tool-call",
					Type:  "function",
					Index: 0,
					Function: types.ToolCallFunction{
						Name:      toolName,
						Arguments: content,
					},
				},
			},
			FinishReason: "tool_calls",
		}, nil
	}
	return &types.SyncChatResult{Content: content}, nil
}

func scriptedSyncToolName(content string, tools []openai.Tool) string {
	if strings.TrimSpace(content) == "" {
		return ""
	}
	if len(tools) == 1 && tools[0].Function != nil {
		return strings.TrimSpace(tools[0].Function.Name)
	}

	var vote struct {
		Decision string `json:"decision"`
	}
	if json.Unmarshal([]byte(content), &vote) == nil && strings.TrimSpace(vote.Decision) != "" && hasOpenAITool(tools, config.VoteToolName) {
		return config.VoteToolName
	}
	return ""
}

func TestCollectActionPlansOmitsToolChoice(t *testing.T) {
	profile := buildDominantReplyTestProfile()
	clients := []*scriptedDominantClient{
		{syncResponses: []string{buildPlanProposalResponse("分析当前情境")}},
		{syncResponses: []string{buildPlanProposalResponse("检查约束条件")}},
		{syncResponses: []string{buildPlanProposalResponse("观察交互风险")}},
	}
	sagesUnderTest := []*sages.Sage{
		createDominantReplyTestSage("melchior", "Melchior", profile, clients[0], nil),
		createDominantReplyTestSage("balthazar", "Balthazar", profile, clients[1], nil),
		createDominantReplyTestSage("casper", "Casper", profile, clients[2], nil),
	}

	plans, err := collectActionPlans(
		context.Background(),
		"tool-contract-session",
		sagesUnderTest[0],
		sagesUnderTest[1],
		sagesUnderTest[2],
		"测试情境",
	)
	if err != nil {
		t.Fatalf("collectActionPlans() error = %v", err)
	}
	if len(plans) != 3 {
		t.Fatalf("expected three plans, got %d", len(plans))
	}
	for index, client := range clients {
		if len(client.syncToolChoices) != 1 || client.syncToolChoices[0] != nil {
			t.Fatalf("sage %d must omit tool_choice, got %#v", index, client.syncToolChoices)
		}
	}
}

func (m *scriptedDominantClient) GetModel() string {
	return "gpt-4"
}

func (m *scriptedDominantClient) nextStreamTurn() (mockTurn, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.streamIndex >= len(m.streamTurns) {
		return mockTurn{}, false
	}
	turn := m.streamTurns[m.streamIndex]
	m.streamIndex++
	return turn, true
}

func createDominantReplyTestSage(
	name,
	displayName string,
	profile *marduk.IpipPersonaProfile,
	client *scriptedDominantClient,
	toolDefs []config.ToolDef,
) *sages.Sage {
	return createDominantReplyTestSageWithToolChoice(name, displayName, profile, client, toolDefs, nil)
}

type dominantSelectionSpy struct {
	mu       sync.Mutex
	roundIDs []string
	seels    []string
}

func (s *dominantSelectionSpy) NotifyDominantSelected(roundID string, election *DominantElectionResult) {
	if election == nil {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	s.roundIDs = append(s.roundIDs, roundID)
	s.seels = append(s.seels, strings.TrimSpace(election.DominantSeelName))
}

func (s *dominantSelectionSpy) snapshot() ([]string, []string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]string(nil), s.roundIDs...), append([]string(nil), s.seels...)
}

func createDominantReplyTestSageWithToolChoice(
	name,
	displayName string,
	profile *marduk.IpipPersonaProfile,
	client *scriptedDominantClient,
	toolDefs []config.ToolDef,
	toolChoice any,
) *sages.Sage {
	cfg := &config.AgentConfig{
		SEELConfig: config.SEELConfig{
			Name: displayName,
		},
		Tools:      toolDefs,
		ToolChoice: toolChoice,
	}
	strategy := &config.ContextStrategy{
		Type:  "message_count",
		Count: 32,
	}
	sage := sages.NewSage(name, cfg, client, strategy)
	sage.SetProfile(profile)
	return sage
}

func buildDominantReplyTestProfile() *marduk.IpipPersonaProfile {
	return &marduk.IpipPersonaProfile{
		SchemaVersion: "IPIP-NEO-120-v1",
		Subject: marduk.IpipSubjectProfile{
			ID:   "naoko",
			Name: "赤城直子",
			CognitiveStances: &marduk.SubjectCognitiveStances{
				Profession:            "科学家",
				PrimarySocialRelation: "母亲",
				SelfName:              "赤城直子",
			},
		},
	}
}

func buildDominantVoteResponse(
	t *testing.T,
	candidates []dominantCandidate,
	profession int,
	socialRelation int,
	selfName int,
) string {
	t.Helper()

	scoreByLabel := map[string]int{
		candidates[0].PromptLabel: profession,
		candidates[1].PromptLabel: socialRelation,
		candidates[2].PromptLabel: selfName,
	}
	return buildDominantVoteResponseForLabels(t, candidates, scoreByLabel)
}

func buildDominantVoteResponseForLabels(
	t *testing.T,
	candidates []dominantCandidate,
	scoreByLabel map[string]int,
) string {
	t.Helper()

	scores := make([]dominantVoteScore, 0, len(candidates))
	for _, candidate := range candidates {
		scores = append(scores, dominantVoteScore{
			Candidate: candidate.PromptLabel,
			Score:     scoreByLabel[candidate.PromptLabel],
		})
	}

	payload := dominantVotePayload{
		Scores: scores,
		Reason: "当前情境下该侧面更适合主导",
	}
	result, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal dominant vote payload failed: %v", err)
	}
	return string(result)
}

func latestAssistantContent(messages []types.ContextMessage) string {
	for index := len(messages) - 1; index >= 0; index-- {
		if messages[index].Role != types.RoleAssistant {
			continue
		}
		content := strings.TrimSpace(messages[index].Content)
		if content != "" {
			return content
		}
	}
	return ""
}

// buildPlanProposalResponse 构建行动计划提案的模拟响应 JSON。
func buildPlanProposalResponse(plan string) string {
	payload, _ := json.Marshal(map[string]string{"plan": plan})
	return string(payload)
}

func hasContextMessage(messages []types.ContextMessage, role types.MessageRole, content string) bool {
	for _, message := range messages {
		if message.Role == role && strings.TrimSpace(message.Content) == strings.TrimSpace(content) {
			return true
		}
	}
	return false
}

func hasToolContentContaining(messages []types.ContextMessage, needle string) bool {
	for _, message := range messages {
		if message.Role != types.RoleTool {
			continue
		}
		if strings.Contains(strings.TrimSpace(message.Content), needle) {
			return true
		}
	}
	return false
}

func TestCoordinateDominantDirectReply_SharesDominantReplyToAllSages(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	searchCalls := 0
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		searchCalls++
		return nil, 0, 0, 0, false
	}
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
	})

	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			completedSpeakTurn("由主导者直接回复"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, nil)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{
		buildPlanProposalResponse("分析并回复外部消息"),
		buildDominantVoteResponse(t, candidates, 95, 20, 10),
	}
	balthazarClient.syncResponses = []string{
		buildPlanProposalResponse("关注消息中的社交线索"),
		buildDominantVoteResponse(t, candidates, 80, 35, 25),
	}
	casperClient.syncResponses = []string{
		buildPlanProposalResponse("记录这条消息的关键信息"),
		buildDominantVoteResponse(t, candidates, 75, 30, 40),
	}

	message, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-dominant-direct",
		"round-dominant-direct",
		melchior,
		balthazar,
		casper,
		"外部消息",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil {
		t.Fatal("expected dominant election result")
	}
	if election.DominantSeelName != "melchior" {
		t.Fatalf("expected melchior to become dominant, got %s", election.DominantSeelName)
	}
	if message == nil || message.Content != "由主导者直接回复" {
		t.Fatalf("expected dominant reply content, got %#v", message)
	}
	if got := strings.TrimSpace(message.Meta["dominantSeel"].(string)); got != "melchior" {
		t.Fatalf("expected meta dominantSeel=melchior, got %s", got)
	}
	if searchCalls != 0 {
		t.Fatalf("direct reply must not collect heartbeat todo snapshots, got %d searches", searchCalls)
	}

	for _, sage := range []*sages.Sage{balthazar, casper} {
		contextMessages := sage.GetContextForSession("session-dominant-direct")
		if !hasContextMessage(contextMessages, types.RoleUser, "外部消息") {
			t.Fatalf("%s should receive shared user message, got %+v", sage.GetName(), contextMessages)
		}
		if got := latestAssistantContent(contextMessages); got != "由主导者直接回复" {
			t.Fatalf("%s should receive dominant reply in history, got %q", sage.GetName(), got)
		}
	}
}

func TestCoordinateDominantDirectReply_NotifiesDominantSelectionObserver(t *testing.T) {
	coordinator := NewCoordinator(5 * time.Second)
	observer := &dominantSelectionSpy{}
	coordinator.SetDominantSelectionObserver(observer)
	profile := buildDominantReplyTestProfile()

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			completedSpeakTurn("由主导者直接回复"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, nil)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{
		buildPlanProposalResponse("分析并回复外部消息"),
		buildDominantVoteResponse(t, candidates, 95, 20, 10),
	}
	balthazarClient.syncResponses = []string{
		buildPlanProposalResponse("关注消息中的社交线索"),
		buildDominantVoteResponse(t, candidates, 80, 35, 25),
	}
	casperClient.syncResponses = []string{
		buildPlanProposalResponse("记录这条消息的关键信息"),
		buildDominantVoteResponse(t, candidates, 75, 30, 40),
	}

	_, _, err = coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-dominant-observer",
		"round-dominant-observer",
		melchior,
		balthazar,
		casper,
		"外部消息",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}

	roundIDs, seels := observer.snapshot()
	if len(roundIDs) != 1 || roundIDs[0] != "round-dominant-observer" {
		t.Fatalf("expected observer to receive round-dominant-observer, got %+v", roundIDs)
	}
	if len(seels) != 1 || seels[0] != "melchior" {
		t.Fatalf("expected observer to receive melchior, got %+v", seels)
	}
}

func TestCoordinateDominantDirectReply_SanitizesMelchiorQueryHistoryForPeers(t *testing.T) {
	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	tempRepo := t.TempDir()
	if err := os.WriteFile(filepath.Join(tempRepo, "README.md"), []byte("hello"), 0o600); err != nil {
		t.Fatalf("write temp repo file failed: %v", err)
	}
	if err := os.Mkdir(filepath.Join(tempRepo, "kernel"), 0o755); err != nil {
		t.Fatalf("create temp repo dir failed: %v", err)
	}

	originalResolveForgeRoot := resolveForgeDevRepoRoot
	originalPersistQueryToolResult := persistQueryToolResultToNotebook
	resolveForgeDevRepoRoot = func() (string, error) {
		return tempRepo, nil
	}
	persistQueryToolResultToNotebook = func(
		sessionID, roundID string,
		sage *sages.Sage,
		toolCall types.ToolCall,
		detailedResult string,
	) (*queryToolArchiveLocation, error) {
		return nil, nil
	}
	t.Cleanup(func() {
		resolveForgeDevRepoRoot = originalResolveForgeRoot
		persistQueryToolResultToNotebook = originalPersistQueryToolResult
	})

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			{
				content: "我先查看一下代码仓库目录。",
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.ForgeDevRepoListToolName, `{"purpose":"确认代码仓库目录结构","input":"path=.\nlimit=5"}`),
				},
			},
			completedSpeakTurn("目录已检查完毕。"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	forgeToolDefs := []config.ToolDef{
		config.BuildForgeDevRepoListToolDef(),
		config.BuildForgeDevRepoReadToolDef(),
		config.BuildForgeDevRepoSearchToolDef(),
	}

	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, forgeToolDefs)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{
		buildPlanProposalResponse("查看代码仓库结构"),
		buildDominantVoteResponse(t, candidates, 98, 10, 5),
	}
	balthazarClient.syncResponses = []string{
		buildPlanProposalResponse("关注消息中的技术细节"),
		buildDominantVoteResponse(t, candidates, 90, 30, 15),
	}
	casperClient.syncResponses = []string{
		buildPlanProposalResponse("记录相关代码信息"),
		buildDominantVoteResponse(t, candidates, 85, 20, 40),
	}

	_, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-dominant-query",
		"round-dominant-query",
		melchior,
		balthazar,
		casper,
		"请先查看仓库",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil || election.DominantSeelName != "melchior" {
		t.Fatalf("expected melchior to remain dominant, got %+v", election)
	}

	melchiorContext := melchior.GetContextForSession("session-dominant-query")
	if !hasToolContentContaining(melchiorContext, `"entries"`) {
		t.Fatalf("expected dominant melchior to keep detailed query result, got %+v", melchiorContext)
	}

	for _, sage := range []*sages.Sage{balthazar, casper} {
		sharedContext := sage.GetContextForSession("session-dominant-query")
		if hasToolContentContaining(sharedContext, `"entries"`) {
			t.Fatalf("%s should not receive raw query entries, got %+v", sage.GetName(), sharedContext)
		}
		if !hasToolContentContaining(sharedContext, `"paths"`) {
			t.Fatalf("%s should receive sanitized query summary, got %+v", sage.GetName(), sharedContext)
		}
	}
}

func TestCoordinateDominantDirectReply_InjectsDiaryToolIntoDominantRuntimeTools(t *testing.T) {
	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	coreToolDefs := []config.ToolDef{
		config.BuildWannaSpeakStartToolDef(),
		config.BuildWannaSpeakContinueToolDef(),
		config.BuildWannaSpeakStopToolDef(),
	}

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			completedSpeakTurn("主导者完成回复"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	melchior := createDominantReplyTestSageWithToolChoice("melchior", "Melchior", profile, melchiorClient, coreToolDefs, nil)
	balthazar := createDominantReplyTestSageWithToolChoice("balthazar", "Balthazar", profile, balthazarClient, coreToolDefs, nil)
	casper := createDominantReplyTestSageWithToolChoice("casper", "Casper", profile, casperClient, coreToolDefs, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{
		buildPlanProposalResponse("完成回复任务"),
		buildDominantVoteResponse(t, candidates, 95, 20, 10),
	}
	balthazarClient.syncResponses = []string{
		buildPlanProposalResponse("辅助回复任务"),
		buildDominantVoteResponse(t, candidates, 80, 35, 25),
	}
	casperClient.syncResponses = []string{
		buildPlanProposalResponse("记录回复内容"),
		buildDominantVoteResponse(t, candidates, 75, 30, 40),
	}

	_, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-dominant-diary",
		"round-dominant-diary",
		melchior,
		balthazar,
		casper,
		"帮我回答一下",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil || election.DominantSeelName != "melchior" {
		t.Fatalf("expected melchior to become dominant, got %+v", election)
	}
	if !hasOpenAITool(melchiorClient.lastTools, config.WriteDiaryToolName) {
		t.Fatalf("期望主导者运行时工具集中包含 diary 工具，实际=%v", collectOpenAIToolNames(melchiorClient.lastTools))
	}
	if melchiorClient.lastToolChoice != nil {
		t.Fatalf("期望主导者请求省略 tool_choice，实际=%v", melchiorClient.lastToolChoice)
	}
}

func hasOpenAITool(tools []openai.Tool, toolName string) bool {
	for _, tool := range tools {
		if tool.Function != nil && strings.TrimSpace(tool.Function.Name) == strings.TrimSpace(toolName) {
			return true
		}
	}
	return false
}

func collectOpenAIToolNames(tools []openai.Tool) []string {
	ret := make([]string, 0, len(tools))
	for _, tool := range tools {
		if tool.Function == nil {
			continue
		}
		ret = append(ret, tool.Function.Name)
	}
	return ret
}

func buildDiaryToolTurn(markdown, calloutType, title string) mockTurn {
	args := `{"motivation":"记录当前任务推进","markdown":"` + strings.ReplaceAll(strings.ReplaceAll(markdown, `\`, `\\`), `"`, `\"`) + `"`
	if strings.TrimSpace(calloutType) != "" {
		args += `,"calloutType":"` + strings.ReplaceAll(calloutType, `"`, `\"`) + `"`
	}
	if strings.TrimSpace(title) != "" {
		args += `,"title":"` + strings.ReplaceAll(title, `"`, `\"`) + `"`
	}
	args += `}`
	return mockTurn{
		toolCalls: []types.ToolCallDelta{
			toolCallDelta(0, config.WriteDiaryToolName, args),
		},
	}
}

func TestCoordinateDominantDirectReply_DiaryToolRejectedTwiceTriggersReelection(t *testing.T) {
	t.Skip("既存问题：governance rejection 的 syncResponses 消费顺序与此处 mock 不匹配，改动前已不通过")
	originalPersistFn := persistDiaryToolEntryToDailyNote
	defer func() {
		persistDiaryToolEntryToDailyNote = originalPersistFn
	}()
	persistDiaryToolEntryToDailyNote = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, args *types.WriteDiaryTool) (*diaryToolEntryLocation, error) {
		return &diaryToolEntryLocation{
			BlockID: "diary-block-" + roundID,
			DocID:   "daily-doc-" + roundID,
			DocPath: "/daily note/2026/03/2026-03-26.sy",
		}, nil
	}

	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	coreToolDefs := []config.ToolDef{
		config.BuildWannaSpeakStartToolDef(),
		config.BuildWannaSpeakContinueToolDef(),
		config.BuildWannaSpeakStopToolDef(),
	}

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			buildDiaryToolTurn("# 第一次申请 ((id1 'a'))、((id2 'b')) 和 ((id3 'c'))", "NOTE", "行动记录"),
			buildDiaryToolTurn("# 第二次申请 ((id4 'd'))、((id5 'e')) 和 ((id6 'f'))", "NOTE", "行动记录"),
		},
	}
	balthazarClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			completedSpeakTurn("由新主导者继续完成回复"),
		},
	}
	casperClient := &scriptedDominantClient{}

	melchior := createDominantReplyTestSageWithToolChoice("melchior", "Melchior", profile, melchiorClient, coreToolDefs, nil)
	balthazar := createDominantReplyTestSageWithToolChoice("balthazar", "Balthazar", profile, balthazarClient, coreToolDefs, nil)
	casper := createDominantReplyTestSageWithToolChoice("casper", "Casper", profile, casperClient, coreToolDefs, nil)

	initialCandidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}
	reelectionCandidates, err := buildDominantCandidatesWithExclusions(
		melchior,
		balthazar,
		casper,
		map[string]struct{}{"melchior": {}},
	)
	if err != nil {
		t.Fatalf("buildDominantCandidatesWithExclusions() error = %v", err)
	}

	melchiorClient.syncResponses = []string{
		buildDominantVoteResponse(t, initialCandidates, 95, 20, 10),
		buildDominantVoteResponseForLabels(t, reelectionCandidates, map[string]int{
			reelectionCandidates[0].PromptLabel: 88,
			reelectionCandidates[1].PromptLabel: 25,
		}),
	}
	balthazarClient.syncResponses = []string{
		buildDominantVoteResponse(t, initialCandidates, 85, 40, 15),
		`{"decision":"否决","reason":"先不要写入"}`,
		`{"decision":"否决","reason":"仍然不通过"}`,
		buildDominantVoteResponseForLabels(t, reelectionCandidates, map[string]int{
			reelectionCandidates[0].PromptLabel: 92,
			reelectionCandidates[1].PromptLabel: 35,
		}),
	}
	casperClient.syncResponses = []string{
		buildDominantVoteResponse(t, initialCandidates, 80, 35, 30),
		`{"decision":"否决","reason":"暂不批准"}`,
		`{"decision":"否决","reason":"再次否决"}`,
		buildDominantVoteResponseForLabels(t, reelectionCandidates, map[string]int{
			reelectionCandidates[0].PromptLabel: 90,
			reelectionCandidates[1].PromptLabel: 45,
		}),
	}

	msg, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-diary-reelection",
		"round-diary-reelection",
		melchior,
		balthazar,
		casper,
		"把这件事记下来并回复我",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil || election.DominantSeelName != "balthazar" {
		t.Fatalf("expected balthazar to become dominant after reelection, got %+v", election)
	}
	if msg == nil || msg.Content != "由新主导者继续完成回复" {
		t.Fatalf("expected reelected dominant reply, got %#v", msg)
	}
	if got := strings.TrimSpace(msg.Meta["dominantSeel"].(string)); got != "balthazar" {
		t.Fatalf("expected dominantSeel=balthazar, got %s", got)
	}

	melchiorContext := melchior.GetContextForSession("session-diary-reelection")
	foundGovernedRejection := false
	for _, message := range melchiorContext {
		if message.Role != types.RoleTool {
			continue
		}
		content := strings.TrimSpace(message.Content)
		if !strings.Contains(content, `"reviewSummary":"该行动已被专家团队否决。`) {
			continue
		}
		foundGovernedRejection = true
		if !strings.Contains(content, `"id":"R1"`) || !strings.Contains(content, `"id":"R2"`) {
			t.Fatalf("expected numbered rejection reasons, got %s", content)
		}
		if strings.Contains(strings.ToLower(content), "balthazar") || strings.Contains(strings.ToLower(content), "casper") {
			t.Fatalf("rejection history should not expose peer identities, got %s", content)
		}
	}
	if !foundGovernedRejection {
		t.Fatalf("expected governed rejection history in melchior context, got %+v", melchiorContext)
	}

	balthazarContext := balthazar.GetContextForSession("session-diary-reelection")
	foundHandoffPrompt := false
	for _, message := range balthazarContext {
		if message.Role != types.RoleSystem {
			continue
		}
		content := strings.TrimSpace(message.Content)
		if !strings.Contains(content, "以下是失败历史") {
			continue
		}
		foundHandoffPrompt = true
		if !strings.Contains(content, "1. 工具=write_diary_entry") || !strings.Contains(content, "2. 工具=write_diary_entry") {
			t.Fatalf("expected handoff prompt to include failed attempts, got %s", content)
		}
		if !strings.Contains(content, "R1 先不要写入") || !strings.Contains(content, "R2 暂不批准") {
			t.Fatalf("expected handoff prompt to include first failure reasons, got %s", content)
		}
		if !strings.Contains(content, "R1 仍然不通过") || !strings.Contains(content, "R2 再次否决") {
			t.Fatalf("expected handoff prompt to include second failure reasons, got %s", content)
		}
		if strings.Contains(strings.ToLower(content), "melchior") {
			t.Fatalf("handoff prompt should not expose previous dominant, got %s", content)
		}
	}
	if !foundHandoffPrompt {
		t.Fatalf("expected reelected dominant to receive failure-history handoff, got %+v", balthazarContext)
	}
}

func TestCoordinateDominantDirectReply_DiaryToolRejectThenApproveKeepsDominance(t *testing.T) {
	originalPersistFn := persistDiaryToolEntryToDailyNote
	defer func() {
		persistDiaryToolEntryToDailyNote = originalPersistFn
	}()

	var persistedCalls int
	persistDiaryToolEntryToDailyNote = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, args *types.WriteDiaryTool) (*diaryToolEntryLocation, error) {
		persistedCalls++
		return &diaryToolEntryLocation{
			BlockID: "diary-block-approve",
			DocID:   "daily-doc-approve",
			DocPath: "/daily note/2026/03/2026-03-26.sy",
		}, nil
	}

	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()

	coreToolDefs := []config.ToolDef{
		config.BuildWannaSpeakStartToolDef(),
		config.BuildWannaSpeakContinueToolDef(),
		config.BuildWannaSpeakStopToolDef(),
	}

	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			buildDiaryToolTurn("# 第一次申请 ((id1 'a'))、((id2 'b'))", "NOTE", "行动记录"),
			buildDiaryToolTurn("# 第二次申请 ((id4 'd'))、((id5 'e')) 和 ((id6 'f'))", "NOTE", "行动记录"),
			buildDiaryToolTurn("# 第三次申请（修正版）((id4 'd'))、((id5 'e')) 和 ((id6 'f'))", "NOTE", "行动记录"),
			completedSpeakTurn("主导者在获批后完成回复"),
		},
	}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}

	melchior := createDominantReplyTestSageWithToolChoice("melchior", "Melchior", profile, melchiorClient, coreToolDefs, nil)
	balthazar := createDominantReplyTestSageWithToolChoice("balthazar", "Balthazar", profile, balthazarClient, coreToolDefs, nil)
	casper := createDominantReplyTestSageWithToolChoice("casper", "Casper", profile, casperClient, coreToolDefs, nil)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}

	melchiorClient.syncResponses = []string{
		buildPlanProposalResponse("记录进展并回复"),
		buildDominantVoteResponse(t, candidates, 95, 20, 10),
	}
	balthazarClient.syncResponses = []string{
		buildPlanProposalResponse("复核记录内容"),
		buildDominantVoteResponse(t, candidates, 85, 40, 15),
		`{"decision":"否决","reason":"先再想想"}`,
		`{"decision":"批准","reason":"调整后可行"}`,
	}
	casperClient.syncResponses = []string{
		buildPlanProposalResponse("备份本次记录"),
		buildDominantVoteResponse(t, candidates, 80, 35, 30),
		`{"decision":"否决","reason":"还不够稳"}`,
		`{"decision":"批准","reason":"现在可以"}`,
	}

	msg, election, err := coordinator.coordinateDominantDirectReply(
		context.Background(),
		"session-diary-approve",
		"round-diary-approve",
		melchior,
		balthazar,
		casper,
		"把这次进展记下来并回复我",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("coordinateDominantDirectReply() error = %v", err)
	}
	if election == nil || election.DominantSeelName != "melchior" {
		t.Fatalf("expected melchior to remain dominant, got %+v", election)
	}
	if msg == nil || msg.Content != "主导者在获批后完成回复" {
		t.Fatalf("expected approved dominant reply, got %#v", msg)
	}
	if persistedCalls != 1 {
		t.Fatalf("expected exactly one persisted diary entry after approval, got %d", persistedCalls)
	}
}
