package coordinator

import (
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestRequireExplicitToolPurpose(t *testing.T) {
	purpose, err := requireExplicitToolPurpose(
		`{"purpose":"  确认人格档案关联笔记  ","query":"Marduk"}`,
		config.NoteKeywordSearchToolName,
	)
	if err != nil {
		t.Fatalf("显式 purpose 不应被拒绝: %v", err)
	}
	if purpose != "确认人格档案关联笔记" {
		t.Fatalf("purpose 应规范化空白，实际=%q", purpose)
	}

	for _, rawArgs := range []string{
		`{"query":"Marduk"}`,
		`{"purpose":"   ","query":"Marduk"}`,
	} {
		if _, err := requireExplicitToolPurpose(rawArgs, config.NoteKeywordSearchToolName); err == nil {
			t.Fatalf("缺失显式 purpose 时必须拒绝: %s", rawArgs)
		}
	}
}

func TestBuildQueryArchiveUsesOnlyExplicitPurpose(t *testing.T) {
	toolCall := types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.NoteKeywordSearchToolName,
			Arguments: `{"purpose":"核对待办状态","query":"#todo#"}`,
		},
	}
	markdown := buildQueryArchiveCalloutMarkdown(
		toolCall,
		"核对待办状态",
		`{"blocks":[],"matchedBlockCount":0}`,
		time.Date(2026, 7, 19, 20, 0, 0, 0, time.FixedZone("CST", 8*60*60)),
	)
	if !strings.Contains(markdown, "**搜索目的**: 核对待办状态") {
		t.Fatalf("归档必须使用 arguments.purpose，实际=%s", markdown)
	}
}

func TestReadToolExecutorsRejectMissingPurpose(t *testing.T) {
	tests := []struct {
		name string
		run  func() (bool, error)
	}{
		{
			name: "note search",
			run: func() (bool, error) {
				_, handled, err := newNoteKeywordToolResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.NoteKeywordSearchToolName, Arguments: `{"query":"Marduk"}`},
				})
				return handled, err
			},
		},
		{
			name: "note read",
			run: func() (bool, error) {
				_, handled, err := newNoteByIDReadToolResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.NoteByIDReadToolName, Arguments: `{"id":"block-1"}`},
				})
				return handled, err
			},
		},
		{
			name: "web search",
			run: func() (bool, error) {
				_, handled, err := newWebSearchToolResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.SearchWebToolName, Arguments: `{"query":"Go"}`},
				})
				return handled, err
			},
		},
		{
			name: "web fetch",
			run: func() (bool, error) {
				_, handled, err := newWebFetchToolResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.FetchWebPageToolName, Arguments: `{"url":"https://example.com"}`},
				})
				return handled, err
			},
		},
		{
			name: "web search status",
			run: func() (bool, error) {
				_, handled, err := newWebSearchToolResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.InspectWebSearchEnginesToolName, Arguments: `{}`},
				})
				return handled, err
			},
		},
		{
			name: "forge list",
			run: func() (bool, error) {
				_, handled, err := newForgeDevRepoToolResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.ForgeDevRepoListToolName, Arguments: `{"input":"path=."}`},
				})
				return handled, err
			},
		},
		{
			name: "channel list",
			run: func() (bool, error) {
				_, handled, err := newListMagiChannelsResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.ListMagiChannelsToolName, Arguments: `{}`},
				})
				return handled, err
			},
		},
		{
			name: "channel messages",
			run: func() (bool, error) {
				_, handled, err := newFetchChannelMessagesResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.FetchChannelMessagesToolName, Arguments: `{"channelId":"wechat","accountId":"main"}`},
				})
				return handled, err
			},
		},
		{
			name: "channel contacts",
			run: func() (bool, error) {
				_, handled, err := newListMagiContactsResultExecutor().ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.ListMagiContactsToolName, Arguments: `{}`},
				})
				return handled, err
			},
		},
		{
			name: "cross-session recall",
			run: func() (bool, error) {
				_, handled, err := newCrossSessionMemoryToolExecutor("melchior").ExecuteToolCall(types.ToolCall{
					Function: types.ToolCallFunction{Name: config.RecallCrossSessionMemoriesToolName, Arguments: `{"query":"Marduk"}`},
				})
				return handled, err
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			handled, err := test.run()
			if !handled || err == nil || !strings.Contains(err.Error(), "purpose") {
				t.Fatalf("缺失 purpose 必须在执行前拒绝: handled=%v err=%v", handled, err)
			}
		})
	}
}

func TestMemoryPersistRejectsMissingMotivation(t *testing.T) {
	_, handled, err := newCrossSessionMemoryToolExecutor("melchior").ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.PersistSessionMemoryToolName,
			Arguments: `{"summary":"记住当前结论","tags":[]}`,
		},
	})
	if !handled || err == nil || !strings.Contains(err.Error(), "motivation") {
		t.Fatalf("记忆写入缺少 motivation 必须拒绝: handled=%v err=%v", handled, err)
	}
}

func TestAvatarPrototypeParsersRequireMotivation(t *testing.T) {
	if _, err := parseMelchiorBuildAvatar(`{"initiate":true,"reason":"需要执行者","systemPromptProposal":"prompt","requirements":"稳定"}`); err == nil || !strings.Contains(err.Error(), "motivation") {
		t.Fatalf("Avatar 创建提案缺少 motivation 必须拒绝: %v", err)
	}
	if _, err := parseDominantSynthesizeAvatar(`{"finalSystemPrompt":"prompt"}`); err == nil || !strings.Contains(err.Error(), "motivation") {
		t.Fatalf("Avatar 综合提案缺少 motivation 必须拒绝: %v", err)
	}
}

func TestGovernedActionDoesNotInferMotivationFromDescription(t *testing.T) {
	_, _, err := buildGovernedActionToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.ForgeDevRepoBashToolName,
			Arguments: `{"description":"检查仓库状态","command":"git status"}`,
		},
	})
	if err == nil || !strings.Contains(err.Error(), "motivation") {
		t.Fatalf("description 不得替代显式 motivation: %v", err)
	}
}
