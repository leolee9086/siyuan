package coordinator

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
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
		melchiorNote, balthazarNote, casperNote *types.WannaSleepTool,
		trinitySummary string,
		finalNote string,
		sleepAt time.Time,
	) (*wannaSleepMemoryLocation, error) {
		persisted.sessionID = sessionID
		persisted.roundID = roundID
		persisted.finalNote = finalNote
		persisted.trinitySummary = trinitySummary
		persisted.sleepAt = sleepAt
		return &wannaSleepMemoryLocation{BlockID: "merged-sleep-memory"}, nil
	}

	coordinator := NewCoordinator(5 * time.Second)
	melchior := createMockSageWithClient("melchior", "Melchior", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.WannaSleepPlanToolName, `{"summary":"我把这一轮检查结果梳理清楚了","nextStepPlan":"下一轮先确认新事件，再决定是否继续追踪仓库变化"}`),
				},
			},
		},
	})
	balthazar := createMockSageWithClient("balthazar", "Balthazar", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.WannaSleepDreamToolName, `{"summary":"情绪上已经从紧绷回落到安静","dreamScene":"深夜的桌面被台灯照亮，玻璃窗外残留雨痕，屏幕上的待办清单泛着冷白色微光，屋里只剩轻微风声"}`),
				},
			},
		},
	})
	casper := createMockSageWithClient("casper", "Casper", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.WannaSleepRecordToolName, `{"summary":"当前没有新的紧急事项，我先把已经看见的线索和状态记下"} `),
				},
			},
		},
	})
	result, err := coordinator.CoordinateHeartbeat(
		context.Background(),
		"heartbeat-merge-session",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		nil,
	)
	if err != nil {
		t.Fatalf("心跳协调不应报错: %v", err)
	}
	if result == nil || !result.Sleeping {
		t.Fatal("期望三贤人全部休眠后得到 sleeping 结果")
	}
	if persisted.sessionID != "heartbeat-merge-session" {
		t.Fatalf("期望合并记忆收到 sessionID，实际=%s", persisted.sessionID)
	}
	if strings.TrimSpace(persisted.finalNote) != strings.TrimSpace(result.SleepSummary) {
		t.Fatalf("期望持久化笔记与返回摘要一致\npersisted=%s\nresult=%s", persisted.finalNote, result.SleepSummary)
	}
	if !persisted.sleepAt.Equal(fixedTime) {
		t.Fatalf("期望 sleepAt 使用固定时间，实际=%s", persisted.sleepAt.Format(time.RFC3339))
	}
	if !strings.Contains(result.SleepSummary, "当前的记录") ||
		!strings.Contains(result.SleepSummary, "下一步的计划") ||
		!strings.Contains(result.SleepSummary, "画面式的描述") ||
		!strings.Contains(result.SleepSummary, "补充整理描述") {
		t.Fatalf("期望最终睡前笔记包含四个部分，实际=%s", result.SleepSummary)
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
			if payload.State == "sleeping" && strings.TrimSpace(payload.Summary) == strings.TrimSpace(result.SleepSummary) {
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
	melchior := createMockSageWithClient("melchior", "Melchior", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.WannaSleepPlanToolName, `{"summary":"先记录检查结论","nextStepPlan":"继续看一下剩余事件"}`),
				},
			},
		},
	})
	balthazar := createMockSageWithClient("balthazar", "Balthazar", &mockLLMClient{
		scriptedTurns: []mockTurn{completedSpeakTurn("我还没有准备好睡下")},
	})
	casper := createMockSageWithClient("casper", "Casper", &mockLLMClient{
		scriptedTurns: []mockTurn{
			{
				toolCalls: []types.ToolCallDelta{
					toolCallDelta(0, config.WannaSleepRecordToolName, `{"summary":"当前没有更多异常，我先记下来"}`),
				},
			},
		},
	})
	result, err := coordinator.CoordinateHeartbeat(
		context.Background(),
		"heartbeat-awake-session",
		melchior,
		balthazar,
		casper,
		"heartbeat",
		nil,
	)
	if err != nil {
		t.Fatalf("只要有足够响应，心跳协调不应报错: %v", err)
	}
	if result == nil {
		t.Fatal("期望返回心跳结果")
	}
	if result.Sleeping {
		t.Fatal("只要有任一贤者未通过 wanna_sleep 结束，就不应进入 sleeping")
	}
}

func TestBuildHeartbeatRuntimeToolsBySage_ExposesDedicatedSleepTools(t *testing.T) {
	toolsBySage := buildHeartbeatRuntimeToolsBySage()
	expectations := map[string]string{
		"melchior":  config.WannaSleepPlanToolName,
		"balthazar": config.WannaSleepDreamToolName,
		"casper":    config.WannaSleepRecordToolName,
	}

	if len(toolsBySage) != len(expectations) {
		t.Fatalf("期望有3组运行时工具，实际=%d", len(toolsBySage))
	}
	for sageName, toolName := range expectations {
		tools := toolsBySage[sageName]
		if len(tools) != 1 {
			t.Fatalf("%s 期望只有一个运行时工具，实际=%d", sageName, len(tools))
		}
		if tools[0].Type != openai.ToolTypeFunction || tools[0].Function == nil || tools[0].Function.Name != toolName {
			t.Fatalf("%s 期望暴露 %s，实际=%+v", sageName, toolName, tools[0])
		}
	}
}
