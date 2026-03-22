package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestAppendTurnToolCallsToContextWithExecutor_UseExecutorResult(t *testing.T) {
	originalPersistFn := persistQueryToolResultToNotebook
	defer func() {
		persistQueryToolResultToNotebook = originalPersistFn
	}()
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, assistantContent string, detailedResult string) (*queryToolArchiveLocation, error) {
		return nil, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-1",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.NoteKeywordSearchToolName,
				Arguments: `{"query":"测试"}`,
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
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, assistantContent string, detailedResult string) (*queryToolArchiveLocation, error) {
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
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, assistantContent string, detailedResult string) (*queryToolArchiveLocation, error) {
		return nil, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-3",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.NoteKeywordSearchToolName,
				Arguments: `{"query":"测试"}`,
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
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, assistantContent string, detailedResult string) (*queryToolArchiveLocation, error) {
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
				Arguments: `{"query":"Marduk","limit":5}`,
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
	if !strings.Contains(summary.Purpose, "为了确认人格档案关联笔记") {
		t.Fatalf("期望保留简要目的，实际=%s", summary.Purpose)
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
	persistQueryToolResultToNotebook = func(sessionID, roundID string, sage *sages.Sage, toolCall types.ToolCall, assistantContent string, detailedResult string) (*queryToolArchiveLocation, error) {
		return &queryToolArchiveLocation{BlockID: "archive-block-2"}, nil
	}

	sage := createMockSage("melchior", "Melchior", "测试", false, 0)
	toolCalls := []types.ToolCall{
		{
			ID:   "call-5",
			Type: "function",
			Function: types.ToolCallFunction{
				Name:      config.ForgeDevRepoReadToolName,
				Arguments: `{"input":"path=kernel/nerv/magi/coordinator/collector.go\nstart=1\nlimit=20"}`,
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
