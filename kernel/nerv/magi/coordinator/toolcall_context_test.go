package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestAppendTurnToolCallsToContextWithExecutor_UseExecutorResult(t *testing.T) {
	originalPersistFn := persistQueryToolResultToNotebook
	defer func() {
		persistQueryToolResultToNotebook = originalPersistFn
	}()
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, detailedResult string) (*queryToolArchiveLocation, error) {
		return nil, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-1",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.NoteKeywordSearchToolName,
				Arguments: `{"purpose":"验证查询结果回写","query":"测试"}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"session-1",
		"round-1",
		sage,
		"",
		toolCalls,
		func(toolCall types.ToolCall) (string, bool, error) {
			return `{"blocks":[],"matchedBlockCount":0,"matchedRootCount":0,"pageCount":0,"docMode":false}`, true, nil
		},
		func(toolName string) string {
			return `{"ok":true,"from":"ack"}`
		},
	)

	ctx := sage.GetContextForSession("session-1")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}
	if ctx[1].Role != types.RoleTool {
		t.Fatalf("期望第二条消息角色为tool，实际=%s", ctx[1].Role)
	}
	if !strings.Contains(ctx[1].Content, `"matchedBlockCount":0`) {
		t.Fatalf("期望工具结果来自执行器，实际=%s", ctx[1].Content)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_FallbackAck(t *testing.T) {
	originalPersistFn := persistQueryToolResultToNotebook
	defer func() {
		persistQueryToolResultToNotebook = originalPersistFn
	}()
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, detailedResult string) (*queryToolArchiveLocation, error) {
		return nil, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-2",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      "unknown_tool",
				Arguments: `{}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"session-2",
		"round-2",
		sage,
		"",
		toolCalls,
		func(toolCall types.ToolCall) (string, bool, error) {
			return "", false, nil
		},
		func(toolName string) string {
			return `{"ok":true,"from":"ack"}`
		},
	)

	ctx := sage.GetContextForSession("session-2")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}
	if ctx[1].Content != `{"ok":true,"from":"ack"}` {
		t.Fatalf("期望使用ack回填，实际=%s", ctx[1].Content)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_ExecutorError(t *testing.T) {
	originalPersistFn := persistQueryToolResultToNotebook
	defer func() {
		persistQueryToolResultToNotebook = originalPersistFn
	}()
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, detailedResult string) (*queryToolArchiveLocation, error) {
		return nil, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-3",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.NoteKeywordSearchToolName,
				Arguments: `{"purpose":"验证查询错误回写","query":"测试"}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"session-3",
		"round-3",
		sage,
		"",
		toolCalls,
		func(toolCall types.ToolCall) (string, bool, error) {
			return "", true, fmt.Errorf("boom")
		},
		func(toolName string) string {
			return `{"ok":true}`
		},
	)

	ctx := sage.GetContextForSession("session-3")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}
	if !strings.Contains(ctx[1].Content, `"ok":false`) || !strings.Contains(ctx[1].Content, "boom") {
		t.Fatalf("期望工具错误被写入结果，实际=%s", ctx[1].Content)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_SummarizesQueryResultForNonMelchior(t *testing.T) {
	originalPersistFn := persistQueryToolResultToNotebook
	defer func() {
		persistQueryToolResultToNotebook = originalPersistFn
	}()
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, detailedResult string) (*queryToolArchiveLocation, error) {
		return &queryToolArchiveLocation{
			BlockID:  "archive-block-1",
			DocHPath: "/MAGI查询结果/2026-03-22",
		}, nil
	}

	sage := createMockSage("balthazar", "Balthazar", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-4",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.NoteKeywordSearchToolName,
				Arguments: `{"purpose":"确认人格档案关联笔记","query":"Marduk","limit":5}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"session-4",
		"round-4",
		sage,
		"为了确认人格档案关联笔记",
		toolCalls,
		func(toolCall types.ToolCall) (string, bool, error) {
			return `{"blocks":[{"id":"blk-1","rootID":"doc-1"},{"id":"blk-2","rootID":"doc-2"}],"restrictedDocumentIDs":["doc-3"]}`, true, nil
		},
		func(toolName string) string {
			return `{"ok":true}`
		},
	)

	ctx := sage.GetContextForSession("session-4")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}

	var summary struct {
		Purpose string `json:"purpose"`
		Query   struct {
			Query string `json:"query"`
			Limit int    `json:"limit"`
		} `json:"query"`
		NoteIDs []string `json:"noteIDs"`
	}
	if err := json.Unmarshal([]byte(ctx[1].Content), &summary); err != nil {
		t.Fatalf("期望历史中写入摘要JSON，实际=%s, err=%v", ctx[1].Content, err)
	}
	if summary.Purpose != "确认人格档案关联笔记" {
		t.Fatalf("期望保留显式 purpose，实际=%s", summary.Purpose)
	}
	if summary.Query.Query != "Marduk" || summary.Query.Limit != 5 {
		t.Fatalf("期望保留查询参数，实际=%+v", summary.Query)
	}
	if len(summary.NoteIDs) != 3 || summary.NoteIDs[0] != "doc-1" || summary.NoteIDs[2] != "doc-3" {
		t.Fatalf("期望仅保留笔记ID摘要，实际=%v", summary.NoteIDs)
	}
	if strings.Contains(ctx[1].Content, `"blocks"`) {
		t.Fatalf("非Melchior历史不应保留详细blocks结果，实际=%s", ctx[1].Content)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_KeepsDetailedQueryResultForMelchior(t *testing.T) {
	originalPersistFn := persistQueryToolResultToNotebook
	defer func() {
		persistQueryToolResultToNotebook = originalPersistFn
	}()
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, detailedResult string) (*queryToolArchiveLocation, error) {
		return &queryToolArchiveLocation{BlockID: "archive-block-2"}, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-5",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.ForgeDevRepoReadToolName,
				Arguments: `{"purpose":"确认工具结果回写逻辑","input":"path=kernel/nerv/magi/coordinator/collector.go\nstart=1\nlimit=20"}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"session-5",
		"round-5",
		sage,
		"读取 collector 以确认工具结果回写逻辑",
		toolCalls,
		func(toolCall types.ToolCall) (string, bool, error) {
			return `{"path":"kernel/nerv/magi/coordinator/collector.go","startLine":1,"endLine":20,"content":"1 | package coordinator"}`, true, nil
		},
		func(toolName string) string {
			return `{"ok":true}`
		},
	)

	ctx := sage.GetContextForSession("session-5")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}
	if !strings.Contains(ctx[1].Content, `"content":"1 | package coordinator"`) {
		t.Fatalf("Melchior历史应保留详细结果，实际=%s", ctx[1].Content)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_PersistsWannaSleepMemoryAndAnnotatesToolResult(t *testing.T) {
	originalPersistFn := persistWannaDowntimeMemoryToNotebook
	originalNowFn := toolResultMemoryNow
	defer func() {
		persistWannaDowntimeMemoryToNotebook = originalPersistFn
		toolResultMemoryNow = originalNowFn
	}()

	fixedTime := time.Date(2026, 3, 22, 9, 30, 0, 0, time.FixedZone("CST", 8*60*60))
	toolResultMemoryNow = func() time.Time {
		return fixedTime
	}

	var persisted struct {
		sessionID string
		roundID   string
		sageName  string
		toolCall  string
		summary   string
		sleepAt   time.Time
	}
	persistWannaDowntimeMemoryToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, summary string, sleepAt time.Time) (*downtimeMemoryLocation, error) {
		persisted.sessionID = sessionID
		persisted.roundID = roundID
		persisted.summary = summary
		persisted.sleepAt = sleepAt
		persisted.toolCall = toolCall.ID
		if sage != nil {
			persisted.sageName = sage.GetName()
		}
		return &downtimeMemoryLocation{BlockID: "memory-block-1"}, nil
	}

	sage := createMockSage("casper", "Casper", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "sleep-call-1",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.WannaSleepRecordToolName,
				Arguments: `{"summary":"检查了定时心跳、没有新任务，决定休眠"}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"sleep-session",
		"sleep-round",
		sage,
		"这次醒来主要检查后台状态",
		toolCalls,
		nil,
		buildCoreSageToolAck,
	)

	if persisted.sessionID != "sleep-session" || persisted.roundID != "sleep-round" {
		t.Fatalf("期望持久化收到会话和轮次信息，实际=%+v", persisted)
	}
	if persisted.sageName != "casper" {
		t.Fatalf("期望持久化收到贤者名，实际=%s", persisted.sageName)
	}
	if persisted.toolCall != "sleep-call-1" {
		t.Fatalf("期望持久化收到 tool call id，实际=%s", persisted.toolCall)
	}
	if persisted.summary != "检查了定时心跳、没有新任务，决定休眠" {
		t.Fatalf("期望持久化收到 summary，实际=%s", persisted.summary)
	}
	if !persisted.sleepAt.Equal(fixedTime) {
		t.Fatalf("期望持久化收到固定时间，实际=%s", persisted.sleepAt.Format(time.RFC3339))
	}

	ctx := sage.GetContextForSession("sleep-session")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}

	var payload struct {
		OK      bool   `json:"ok"`
		State   string `json:"state"`
		Summary string `json:"summary"`
		SleepAt string `json:"sleepAt"`
	}
	if err := json.Unmarshal([]byte(ctx[1].Content), &payload); err != nil {
		t.Fatalf("期望 wanna_sleep 结果被写成 JSON，实际=%s, err=%v", ctx[1].Content, err)
	}
	if !payload.OK || payload.State != "sleeping" {
		t.Fatalf("期望 wanna_sleep 结果包含 sleeping ack，实际=%+v", payload)
	}
	if payload.Summary != persisted.summary {
		t.Fatalf("期望工具结果保留 summary，实际=%s", payload.Summary)
	}
	if payload.SleepAt != fixedTime.Format(time.RFC3339) {
		t.Fatalf("期望工具结果保留 sleepAt，实际=%s", payload.SleepAt)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_WannaSleepPersistenceFailureStillWritesToolResult(t *testing.T) {
	originalPersistFn := persistWannaDowntimeMemoryToNotebook
	originalNowFn := toolResultMemoryNow
	defer func() {
		persistWannaDowntimeMemoryToNotebook = originalPersistFn
		toolResultMemoryNow = originalNowFn
	}()

	fixedTime := time.Date(2026, 3, 22, 10, 45, 0, 0, time.UTC)
	toolResultMemoryNow = func() time.Time {
		return fixedTime
	}
	persistWannaDowntimeMemoryToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, summary string, sleepAt time.Time) (*downtimeMemoryLocation, error) {
		return nil, fmt.Errorf("write failed")
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "sleep-call-2",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.WannaSleepRecordToolName,
				Arguments: `{"summary":"检查完待办，没有进一步动作"}`,
			},
		},
	}

	appendTurnToolCallsToContextWithExecutor(
		"sleep-session-2",
		"sleep-round-2",
		sage,
		"这次醒来重点检查是否需要继续行动",
		toolCalls,
		nil,
		buildCoreSageToolAck,
	)

	ctx := sage.GetContextForSession("sleep-session-2")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}

	var payload struct {
		State   string `json:"state"`
		Summary string `json:"summary"`
		SleepAt string `json:"sleepAt"`
	}
	if err := json.Unmarshal([]byte(ctx[1].Content), &payload); err != nil {
		t.Fatalf("期望 want_sleep 失败兜底仍写入 JSON，实际=%s, err=%v", ctx[1].Content, err)
	}
	if payload.State != "sleeping" {
		t.Fatalf("期望工具结果保留 sleeping 状态，实际=%s", payload.State)
	}
	if payload.Summary != "检查完待办，没有进一步动作" {
		t.Fatalf("期望工具结果保留 summary，实际=%s", payload.Summary)
	}
	if payload.SleepAt != fixedTime.Format(time.RFC3339) {
		t.Fatalf("期望工具结果保留 sleepAt，实际=%s", payload.SleepAt)
	}
}

func TestAppendTurnToolCallsToContextWithExecutor_PersistsDiaryEntryAndAnnotatesToolResult(t *testing.T) {
	originalPersistFn := persistDiaryToolEntryToDailyNote
	defer func() {
		persistDiaryToolEntryToDailyNote = originalPersistFn
	}()

	var persisted struct {
		sessionID string
		roundID   string
		sageName  string
		toolCall  string
		args      *types.WriteDiaryTool
	}
	persistDiaryToolEntryToDailyNote = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, args *types.WriteDiaryTool) (*diaryToolEntryLocation, error) {
		persisted.sessionID = sessionID
		persisted.roundID = roundID
		persisted.toolCall = toolCall.ID
		persisted.args = args
		if sage != nil {
			persisted.sageName = sage.GetName()
		}
		return &diaryToolEntryLocation{
			BlockID: "diary-block-1",
			DocID:   "daily-doc-1",
			DocPath: "/daily note/2026/03/2026-03-22.sy",
		}, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "diary-call-1",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.WriteDiaryToolName,
				Arguments: `{"motivation":"沉淀当前进展","markdown":"# 今日记录\n\n- 完成日记工具接线\n- 参考 ((id1 \"文档A\"))、((id2 \"文档B\")) 和 ((id3 \"文档C\"))","calloutType":"NOTE","title":"行动日志"}`,
			},
		},
	}

	diaryExecutor := newDiaryToolResultExecutor()
	appendTurnToolCallsToContextWithExecutor(
		"diary-session",
		"diary-round",
		sage,
		"准备把这次推进记入日记",
		toolCalls,
		diaryExecutor.ExecuteToolCall,
		buildCoreSageToolAck,
	)

	if persisted.sessionID != "diary-session" || persisted.roundID != "diary-round" {
		t.Fatalf("期望持久化收到会话和轮次信息，实际=%+v", persisted)
	}
	if persisted.sageName != "melchior" || persisted.toolCall != "diary-call-1" {
		t.Fatalf("期望持久化收到贤者和 tool call 信息，实际=%+v", persisted)
	}
	if persisted.args == nil || !strings.Contains(persisted.args.Markdown, "完成日记工具接线") {
		t.Fatalf("期望持久化收到 markdown 正文，实际=%+v", persisted.args)
	}

	ctx := sage.GetContextForSession("diary-session")
	if len(ctx) != 2 {
		t.Fatalf("期望上下文有2条消息，实际=%d", len(ctx))
	}

	var payload struct {
		OK          bool   `json:"ok"`
		State       string `json:"state"`
		Motivation  string `json:"motivation"`
		CalloutType string `json:"calloutType"`
		Title       string `json:"title"`
		BlockID     string `json:"blockId"`
		DocID       string `json:"docId"`
		DocPath     string `json:"docPath"`
	}
	if err := json.Unmarshal([]byte(ctx[1].Content), &payload); err != nil {
		t.Fatalf("期望 diary 工具结果被写成 JSON，实际=%s, err=%v", ctx[1].Content, err)
	}
	if !payload.OK || payload.State != "written" {
		t.Fatalf("期望 diary 工具结果为 written，实际=%+v", payload)
	}
	if payload.Motivation != "沉淀当前进展" {
		t.Fatalf("期望工具结果保留 motivation，实际=%+v", payload)
	}
	if payload.CalloutType != "NOTE" || payload.Title != "行动日志" {
		t.Fatalf("期望工具结果保留 callout 信息，实际=%+v", payload)
	}
	if payload.BlockID != "diary-block-1" || payload.DocID != "daily-doc-1" {
		t.Fatalf("期望工具结果保留落盘定位信息，实际=%+v", payload)
	}
	if strings.Contains(ctx[1].Content, `"vote"`) || strings.Contains(ctx[1].Content, `"approvalRound"`) {
		t.Fatalf("成功写入的历史中不应暴露投票细节，实际=%s", ctx[1].Content)
	}
}
