package coordinator

import (
	"fmt"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestAppendTurnToolCallsToContextWithExecutor_UseExecutorResult(t *testing.T) {
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
