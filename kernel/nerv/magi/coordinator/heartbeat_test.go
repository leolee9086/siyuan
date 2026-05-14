package coordinator

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestCoordinateHeartbeat_MergesSleepNotesIntoSharedHistory(t *testing.T) {
	originalPersistFn := persistMergedWannaSleepMemoryToNotebook
	originalNowFn := toolResultMemoryNow
	defer func() {
		persistMergedWannaSleepMemoryToNotebook = originalPersistFn
		toolResultMemoryNow = originalNowFn
	}()

	fixedTime := time.Date(2026, 3, 23, 9, 15, 0, 0, time.FixedZone("CST", 8*60*60))
	toolResultMemoryNow = func() time.Time {
		return fixedTime
	}

	var persisted struct {
		sessionID      string
		roundID        string
		finalNote      string
		trinitySummary string
		sleepAt        time.Time
	}
	persistMergedWannaSleepMemoryToNotebook = func(
		sessionID, roundID string,
		melchiorNote, balthazarNote, casperNote *types.HeartbeatDowntimeTool,
		trinitySummary string,
		finalNote string,
		sleepAt time.Time,
	) (*downtimeMemoryLocation, error) {
		persisted.sessionID = sessionID
		persisted.roundID = roundID
		persisted.finalNote = finalNote
		persisted.trinitySummary = trinitySummary
		persisted.sleepAt = sleepAt
		return &downtimeMemoryLocation{BlockID: "merged-sleep-memory"}, nil
	}

	coordinator := NewCoordinator(5 * time.Second)
	profile := buildDominantReplyTestProfile()
	melchiorClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepPlanToolName, `{"summary":"我把这一轮检查结果梳理清楚了","nextStepPlan":"下一轮先确认新事件，再决定是否继续追踪仓库变化"}`),
				},
			},
		},
	}
	balthazarClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepDreamToolName, `{"summary":"情绪上已经从紧绷回落到安静","dreamScene":"深夜的桌面被台灯照亮，玻璃窗外残留雨痕，屏幕上的待办清单泛着冷白色微光，屋里只剩轻微风声"}`),
				},
			},
		},
	}
	casperClient := &scriptedDominantClient{
		streamTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepRecordToolName, `{"summary":"当前没有新的紧急事项，我先把已经看见的线索和状态记下"}`),
				},
			},
		},
	}
	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, nil)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)
	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}
	melchiorClient.syncResponses = []string{
		buildDominantVoteResponse(t, candidates, 95, 20, 10),
		buildDominantVoteResponse(t, candidates, 95, 20, 10),
		"把这轮观察过的状态、计划与画面串成一条能直接续上的休眠线索。",
	}
	balthazarClient.syncResponses = []string{
		buildDominantVoteResponse(t, candidates, 80, 35, 25),
		buildDominantVoteResponse(t, candidates, 80, 35, 25),
	}
	casperClient.syncResponses = []string{
		buildDominantVoteResponse(t, candidates, 75, 30, 40),
		buildDominantVoteResponse(t, candidates, 75, 30, 40),
	}
	result, err := coordinator.CoordinateHeartbeat(
		context.Background(),
		"heartbeat-merge-session",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		nil,
		nil,
		true)

	if err != nil {
		t.Fatalf("心跳协调不应报错: %v", err)
	}
	if result == nil || !result.Downtime {
		t.Fatal("期望三贤人全部休眠后得到 sleeping 结果")
	}
	if persisted.sessionID != "heartbeat-merge-session" {
		t.Fatalf("期望合并记忆收到 sessionID，实际=%s", persisted.sessionID)
	}
	if strings.TrimSpace(persisted.finalNote) != strings.TrimSpace(result.DowntimeSummary) {
		t.Fatalf("期望持久化笔记与返回摘要一致\npersisted=%s\nresult=%s", persisted.finalNote, result.DowntimeSummary)
	}
	if !persisted.sleepAt.Equal(fixedTime) {
		t.Fatalf("期望 sleepAt 使用固定时间，实际=%s", persisted.sleepAt.Format(time.RFC3339))
	}
	if !strings.Contains(result.DowntimeSummary, "当前的记录") ||
		!strings.Contains(result.DowntimeSummary, "下一步的计划") ||
		!strings.Contains(result.DowntimeSummary, "画面式的描述") ||
		!strings.Contains(result.DowntimeSummary, "补充整理描述") {
		t.Fatalf("期望最终睡前笔记包含四个部分，实际=%s", result.DowntimeSummary)
	}

	for _, sage := range []*struct {
		name string
		ctx  []types.ContextMessage
	}{
		{name: "melchior", ctx: melchior.GetContextForSession("heartbeat-merge-session")},
		{name: "balthazar", ctx: balthazar.GetContextForSession("heartbeat-merge-session")},
		{name: "casper", ctx: casper.GetContextForSession("heartbeat-merge-session")},
	} {
		found := false
		for _, msg := range sage.ctx {
			if msg.Role != types.RoleTool {
				continue
			}
			var payload struct {
				State    string            `json:"state"`
				Summary  string            `json:"summary"`
				Sections map[string]string `json:"sections"`
			}
			if err := json.Unmarshal([]byte(msg.Content), &payload); err != nil {
				continue
			}
			if payload.State == "sleeping" && strings.TrimSpace(payload.Summary) == strings.TrimSpace(result.DowntimeSummary) {
				found = true
				if payload.Sections["nextStepPlan"] == "" || payload.Sections["dreamScene"] == "" || payload.Sections["supplementalSummary"] == "" {
					t.Fatalf("%s 的合并睡前笔记缺少结构化分段: %+v", sage.name, payload.Sections)
				}
				break
			}
		}
		if !found {
			t.Fatalf("期望 %s 的历史中写入同一条合并后的睡前笔记", sage.name)
		}
	}
}

func TestCoordinateHeartbeat_RemainsAwakeWhenAnySleepNoteMissing(t *testing.T) {
	coordinator := NewCoordinator(5 * time.Second)

	melchiorClient := &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepPlanToolName, `{"summary":"先记录检查结论","nextStepPlan":"继续看一下剩余事件"}`),
				},
			},
		},
	}
	balthazarClient := &mockLLMClient{
		scriptedTurns: []mockTurn{completedSpeakTurn("我还没有准备好睡下")},
	}
	casperClient := &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.NoteKeywordSearchToolName, `{"input":"#todo#"}`),
					toolCallDelta(1, config.WannaSleepRecordToolName, `{"summary":"当前没有更多异常，我先记下来"}`),
				},
			},
		},
	}

	melchior := createMockSageWithClient("melchior", "Melchior", melchiorClient)
	balthazar := createMockSageWithClient("balthazar", "Balthazar", balthazarClient)
	casper := createMockSageWithClient("casper", "Casper", casperClient)

	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates() error = %v", err)
	}
	melchiorClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 95, 20, 10)}
	balthazarClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 80, 35, 25)}
	casperClient.syncResponses = []string{buildDominantVoteResponse(t, candidates, 75, 30, 40)}

	result, err := coordinator.CoordinateHeartbeat(
		context.Background(),
		"heartbeat-awake-session",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		nil,
		nil,
	)
	if err != nil {
		t.Fatalf("只要有足够响应，心跳协调不应报错: %v", err)
	}
	if result == nil {
		t.Fatal("期望返回心跳结果")
	}
	if result.Downtime {
		t.Fatal("只要有任一贤者未通过 wanna_sleep 结束，就不应进入 sleeping")
	}
}

func TestBuildHeartbeatRuntimeToolsBySage_ExposesDedicatedSleepTools(t *testing.T) {
	originalMode := util.Mode
	defer func() {
		util.Mode = originalMode
	}()
	util.Mode = util.ModeProd

	toolsBySage := buildHeartbeatRuntimeToolsBySage(false, nil)

	if len(toolsBySage) != 3 {
		t.Fatalf("期望有3组运行时工具，实际=%d", len(toolsBySage))
	}
	for sageName := range toolsBySage {
		tools := toolsBySage[sageName]
		if len(tools) != 5 {
			t.Fatalf("%s 期望1个睡眠+4个阅读=5个工具（无主导时无行动工具），实际=%d", sageName, len(tools))
		}
	}

	// 验证有主导时，主导 sage 包含行动工具
	profile := buildDominantReplyTestProfile()
	melchiorClient := &scriptedDominantClient{}
	balthazarClient := &scriptedDominantClient{}
	casperClient := &scriptedDominantClient{}
	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, melchiorClient, nil)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, balthazarClient, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, casperClient, nil)

	melchiorClient.syncResponses = []string{buildDominantVoteResponse(t, mustBuildDominantCandidates(t, melchior, balthazar, casper), 95, 20, 10)}
	balthazarClient.syncResponses = []string{buildDominantVoteResponse(t, mustBuildDominantCandidates(t, melchior, balthazar, casper), 80, 35, 25)}
	casperClient.syncResponses = []string{buildDominantVoteResponse(t, mustBuildDominantCandidates(t, melchior, balthazar, casper), 75, 30, 40)}

	dominantResult, err := electDominantSage(context.Background(), "test", melchior, balthazar, casper, "测试")
	if err != nil {
		t.Fatalf("选举失败: %v", err)
	}
	dominantSage, err := resolveDominantSage(dominantResult, melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("解析主导失败: %v", err)
	}

	toolsBySageWithDominant := buildHeartbeatRuntimeToolsBySage(false, dominantSage)
	for sageName, tools := range toolsBySageWithDominant {
		if sageName == dominantSage.GetName() {
			if len(tools) != 11 {
				t.Fatalf("主导 %s 期望1睡眠+4阅读+6行动=11，实际=%d", sageName, len(tools))
			}
		} else {
			if len(tools) != 5 {
				t.Fatalf("非主导 %s 期望1睡眠+4阅读=5，实际=%d", sageName, len(tools))
			}
		}
	}
}

func mustBuildDominantCandidates(t *testing.T, melchior, balthazar, casper *sages.Sage) []dominantCandidate {
	t.Helper()
	candidates, err := buildDominantCandidates(melchior, balthazar, casper)
	if err != nil {
		t.Fatalf("buildDominantCandidates failed: %v", err)
	}
	return candidates
}

func TestBuildHeartbeatRuntimeToolsBySage_ForgeModeAddsRepoReadingTools(t *testing.T) {
	originalMode := util.Mode
	defer func() {
		util.Mode = originalMode
	}()
	util.Mode = util.ModeForge

	toolsBySage := buildHeartbeatRuntimeToolsBySage(false, nil)

	// 无主导时：1睡眠 + 7阅读（4基础+3 forge）= 8
	for sageName, tools := range toolsBySage {
		if len(tools) != 8 {
			t.Fatalf("%s 无主导时期望1睡眠+7阅读=8，实际=%d", sageName, len(tools))
		}
	}

	// 验证有主导时主导 sage 包含 forge 行动工具：1+7+9=17
	profile := buildDominantReplyTestProfile()
	melchior := createDominantReplyTestSage("melchior", "Melchior", profile, &scriptedDominantClient{}, nil)
	balthazar := createDominantReplyTestSage("balthazar", "Balthazar", profile, &scriptedDominantClient{}, nil)
	casper := createDominantReplyTestSage("casper", "Casper", profile, &scriptedDominantClient{}, nil)
	_ = balthazar
	_ = casper

	toolsBySageWithDominant := buildHeartbeatRuntimeToolsBySage(false, melchior)
	for sageName, tools := range toolsBySageWithDominant {
		if sageName == "melchior" {
			if len(tools) != 17 {
				t.Fatalf("主导 melchior 期望1睡眠+7阅读+9行动=17，实际=%d", len(tools))
			}
		} else {
			if len(tools) != 8 {
				t.Fatalf("非主导 %s 期望1睡眠+7阅读=8，实际=%d", sageName, len(tools))
			}
		}
	}
}
