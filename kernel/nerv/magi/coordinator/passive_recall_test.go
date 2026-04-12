package coordinator

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	kernelsql "github.com/siyuan-note/siyuan/kernel/sql"
)

func TestBuildPassiveRecallPayloadForSage_MelchiorFiltersAccessibleNotes(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	originalScope := resolveWorkspaceAIMainNotebookAccessScope
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
		resolveWorkspaceAIMainNotebookAccessScope = originalScope
	})

	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "block-1", RootID: "doc-alpha", Content: "alpha beta recall"},
			{ID: "block-2", RootID: "doc-alpha", Content: "beta gamma"},
			{ID: "block-3", RootID: "doc-hidden", Content: "alpha secret"},
		}, 3, 2, 1, false
	}
	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			AccessibleRootIDs: map[string]struct{}{
				"doc-alpha": {},
			},
		}, nil
	}

	payload := buildPassiveRecallPayloadForSage("melchior", &types.PassiveRecallBasis{
		Type:        types.PassiveRecallBasisUserMessage,
		Query:       "alpha beta recall",
		UserMessage: "alpha beta recall",
	})
	if payload == nil {
		t.Fatal("期望返回被动召回载荷")
	}
	if payload.Scope != "melchior-accessible-notes" {
		t.Fatalf("期望 melchior 范围，实际=%s", payload.Scope)
	}
	if !strings.Contains(payload.RelatedTo, "当前用户消息") || !strings.Contains(payload.RelatedTo, "alpha beta recall") {
		t.Fatalf("期望明确说明这些 ID 跟什么相关，实际=%s", payload.RelatedTo)
	}
	if payload.Empty {
		t.Fatalf("期望命中可访问笔记，实际为空: %+v", payload)
	}
	if len(payload.NoteHints) != 1 {
		t.Fatalf("期望聚合后只保留 1 个可访问文档，实际=%d", len(payload.NoteHints))
	}
	hint := payload.NoteHints[0]
	if hint.ID != "doc-alpha" || hint.RootID != "doc-alpha" || hint.Kind != "note" {
		t.Fatalf("期望返回 doc-alpha 文档线索，实际=%+v", hint)
	}
	expectKeywordHitCounts(t, payload.KeywordHitCounts, map[string]int{"alpha": 1, "beta": 1, "recall": 1})
}

func TestBuildPassiveRecallPayloadForSage_CasperMatchesSleepAnchors(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	originalAttrs := passiveRecallGetBlockAttrs
	originalLoadBlock := passiveRecallLoadBlock
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
		passiveRecallGetBlockAttrs = originalAttrs
		passiveRecallLoadBlock = originalLoadBlock
	})

	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "sleep-child", ParentID: "sleep-anchor", RootID: "sleep-doc", Content: "alpha bedtime recall"},
		}, 1, 1, 1, false
	}
	passiveRecallGetBlockAttrs = func(id string) map[string]string {
		if id == "sleep-anchor" {
			return map[string]string{
				magiMemoryKindAttr: config.WannaSleepMergedRecordName,
			}
		}
		return map[string]string{}
	}
	passiveRecallLoadBlock = func(id string) *kernelsql.Block {
		if id == "sleep-child" {
			return &kernelsql.Block{ID: "sleep-child", ParentID: "sleep-anchor", RootID: "sleep-doc"}
		}
		return nil
	}

	payload := buildPassiveRecallPayloadForSage("casper", &types.PassiveRecallBasis{
		Type:  types.PassiveRecallBasisPreviousSleep,
		Query: "alpha bedtime recall",
	})
	if payload == nil || payload.Empty {
		t.Fatalf("期望命中睡前笔记锚点，实际=%+v", payload)
	}
	if payload.Scope != "casper-sleep-notes" {
		t.Fatalf("期望 casper 范围，实际=%s", payload.Scope)
	}
	if !strings.Contains(payload.RelatedTo, "上一轮睡前笔记") || !strings.Contains(payload.RelatedTo, "alpha bedtime recall") {
		t.Fatalf("期望明确说明睡前笔记关联依据，实际=%s", payload.RelatedTo)
	}
	if len(payload.NoteHints) != 1 {
		t.Fatalf("期望 1 条睡前笔记线索，实际=%d", len(payload.NoteHints))
	}
	hint := payload.NoteHints[0]
	if hint.ID != "sleep-anchor" || hint.RootID != "sleep-doc" || hint.Kind != "sleep-note" {
		t.Fatalf("期望睡前笔记锚点，实际=%+v", hint)
	}
	expectKeywordHitCounts(t, payload.KeywordHitCounts, map[string]int{"alpha": 1, "bedtime": 1, "recall": 1})
}

func TestBuildPassiveRecallPayloadForSage_BalthazarTruncatesActiveRecords(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	originalAttrs := passiveRecallGetBlockAttrs
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
		passiveRecallGetBlockAttrs = originalAttrs
	})

	blocks := make([]*model.Block, 0, 12)
	for i := 0; i < 12; i++ {
		blocks = append(blocks, &model.Block{
			ID:      "active-" + string(rune('A'+i)),
			RootID:  "doc-active",
			Content: "alpha active recall",
		})
	}
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return blocks, len(blocks), 1, 1, false
	}
	passiveRecallGetBlockAttrs = func(id string) map[string]string {
		return map[string]string{
			magiDiaryBlockAttr: "true",
		}
	}

	payload := buildPassiveRecallPayloadForSage("balthazar", &types.PassiveRecallBasis{
		Type:  types.PassiveRecallBasisUserMessage,
		Query: "alpha active recall",
	})
	if payload == nil {
		t.Fatal("期望返回主动记录召回载荷")
	}
	if !strings.Contains(payload.RelatedTo, "当前用户消息") || !strings.Contains(payload.RelatedTo, "alpha active recall") {
		t.Fatalf("期望明确说明主动记录线索关联依据，实际=%s", payload.RelatedTo)
	}
	if !payload.Truncated {
		t.Fatalf("期望超过 10 条时标记 truncated，实际=%+v", payload)
	}
	if len(payload.NoteHints) != passiveRecallHintLimit {
		t.Fatalf("期望只返回前 %d 条线索，实际=%d", passiveRecallHintLimit, len(payload.NoteHints))
	}
	for _, hint := range payload.NoteHints {
		if hint.Kind != "active-record" {
			t.Fatalf("期望全部为主动记录线索，实际=%+v", hint)
		}
	}
	expectKeywordHitCounts(t, payload.KeywordHitCounts, map[string]int{"alpha": passiveRecallHintLimit, "active": passiveRecallHintLimit, "recall": passiveRecallHintLimit})
}

func TestBuildPassiveRecallPayloadForSage_MelchiorExposesScopeErrors(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	originalScope := resolveWorkspaceAIMainNotebookAccessScope
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
		resolveWorkspaceAIMainNotebookAccessScope = originalScope
	})

	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "block-1", RootID: "doc-alpha", Content: "alpha recall"},
		}, 1, 1, 1, false
	}
	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status: model.WorkspaceAIMainNotebookStatusConflict,
			},
		}, errors.New("conflict")
	}

	payload := buildPassiveRecallPayloadForSage("melchior", &types.PassiveRecallBasis{
		Type:  types.PassiveRecallBasisUserMessage,
		Query: "alpha recall",
	})
	if payload == nil {
		t.Fatal("期望返回错误载荷")
	}
	if !payload.Empty {
		t.Fatalf("期望错误时标记 empty，实际=%+v", payload)
	}
	if strings.TrimSpace(payload.Error) == "" {
		t.Fatalf("期望保留访问范围错误信息，实际=%+v", payload)
	}
	if len(payload.NoteHints) != 0 {
		t.Fatalf("错误路径不应返回线索，实际=%+v", payload.NoteHints)
	}
}

func TestBuildSourceAwareUserInputBySage_InjectsPassiveRecallEnvelopePerScope(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	originalScope := resolveWorkspaceAIMainNotebookAccessScope
	originalAttrs := passiveRecallGetBlockAttrs
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
		resolveWorkspaceAIMainNotebookAccessScope = originalScope
		passiveRecallGetBlockAttrs = originalAttrs
	})

	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "doc-alpha-block", RootID: "doc-alpha", Content: "alpha recall"},
			{ID: "sleep-anchor", RootID: "sleep-doc", Content: "alpha bedtime"},
			{ID: "active-anchor", RootID: "active-doc", Content: "alpha diary"},
		}, 3, 3, 1, false
	}
	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			AccessibleRootIDs: map[string]struct{}{
				"doc-alpha": {},
			},
		}, nil
	}
	passiveRecallGetBlockAttrs = func(id string) map[string]string {
		switch id {
		case "sleep-anchor":
			return map[string]string{magiMemoryKindAttr: config.WannaSleepMergedRecordName}
		case "active-anchor":
			return map[string]string{magiDiaryBlockAttr: "true"}
		default:
			return map[string]string{}
		}
	}

	coordinator := NewCoordinator(5 * time.Second)
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
	inputs := coordinator.buildSourceAwareUserInputBySage(
		"passive-recall-session",
		"alpha recall",
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: "alpha recall"}},
		&types.PassiveRecallBasis{
			Type:        types.PassiveRecallBasisUserMessage,
			Query:       "alpha recall",
			UserMessage: "alpha recall",
		},
	)

	for sageName, scopeName := range map[string]string{
		"melchior":  "melchior-accessible-notes",
		"balthazar": "balthazar-active-records",
		"casper":    "casper-sleep-notes",
	} {
		input := inputs[sageName]
		if !strings.Contains(input, "<passive_memory_recall>") {
			t.Fatalf("%s 期望注入 passive_memory_recall 信封，实际=%s", sageName, input)
		}
		if !strings.Contains(input, `"`+"scope"+`":"`+scopeName+`"`) {
			t.Fatalf("%s 期望带上正确 scope，实际=%s", sageName, input)
		}
	}
	if !strings.Contains(inputs["melchior"], `"id":"doc-alpha"`) {
		t.Fatalf("melchior 期望拿到可访问文档 ID，实际=%s", inputs["melchior"])
	}
	if !strings.Contains(inputs["melchior"], `"relatedTo":"当前用户消息：alpha recall"`) {
		t.Fatalf("melchior 期望明确说明这些 ID 跟什么相关，实际=%s", inputs["melchior"])
	}
	if !strings.Contains(inputs["melchior"], `"keywordHitCounts":{"alpha":1,"recall":1}`) {
		t.Fatalf("melchior 期望提供整体关键词命中统计，实际=%s", inputs["melchior"])
	}
	if strings.Contains(inputs["melchior"], `"matchedKeywords"`) {
		t.Fatalf("melchior 不应再为每条笔记枚举 matchedKeywords，实际=%s", inputs["melchior"])
	}
	if !strings.Contains(inputs["balthazar"], `"id":"active-anchor"`) {
		t.Fatalf("balthazar 期望拿到主动记录锚点 ID，实际=%s", inputs["balthazar"])
	}
	if !strings.Contains(inputs["casper"], `"id":"sleep-anchor"`) {
		t.Fatalf("casper 期望拿到睡前笔记锚点 ID，实际=%s", inputs["casper"])
	}
	if !strings.Contains(inputs["melchior"], "<source=user_message>\nalpha recall\n</source>") {
		t.Fatalf("期望 source=user_message 保留原始消息，实际=%s", inputs["melchior"])
	}
}

func TestBuildSourceAwareUserInputBySage_PreservesHeartbeatPromptAlongsidePassiveRecall(t *testing.T) {
	originalSearch := runNoteKeywordFullTextSearch
	originalScope := resolveWorkspaceAIMainNotebookAccessScope
	originalAttrs := passiveRecallGetBlockAttrs
	originalLoadBlock := passiveRecallLoadBlock
	t.Cleanup(func() {
		runNoteKeywordFullTextSearch = originalSearch
		resolveWorkspaceAIMainNotebookAccessScope = originalScope
		passiveRecallGetBlockAttrs = originalAttrs
		passiveRecallLoadBlock = originalLoadBlock
	})

	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "doc-heartbeat-block", RootID: "doc-heartbeat", Content: "台灯 线索 待办"},
		}, 1, 1, 1, false
	}
	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			AccessibleRootIDs: map[string]struct{}{
				"doc-heartbeat": {},
			},
		}, nil
	}
	passiveRecallGetBlockAttrs = func(id string) map[string]string {
		return map[string]string{}
	}
	passiveRecallLoadBlock = func(id string) *kernelsql.Block {
		return nil
	}

	coordinator := NewCoordinator(5 * time.Second)
	heartbeatPrompt := "这是一次系统心跳唤醒，不是外部用户对话。"
	sourceCtx := &types.RequestSourceContext{
		Channel:       types.SourceChannelSystemCron,
		PrincipalID:   "system-cron",
		IdentityID:    "system-cron",
		Nickname:      "System Cron",
		InterfaceID:   "magi-heartbeat",
		InterfaceKind: "system-cron-job",
		TrustBase:     types.TrustLevelHigh,
		RiskLevel:     types.TrustLevelLow,
	}
	inputs := coordinator.buildSourceAwareUserInputBySage(
		"heartbeat-passive-recall-session",
		heartbeatPrompt,
		sourceCtx,
		[]types.ClaimedHistoryMessage{{Role: "user", Content: heartbeatPrompt}},
		&types.PassiveRecallBasis{
			Type:         types.PassiveRecallBasisPreviousSleep,
			Query:        "台灯 线索 待办",
			SleepSummary: "台灯 线索 待办",
		},
	)

	melchiorInput := inputs["melchior"]
	if !strings.Contains(melchiorInput, "<passive_memory_recall>") {
		t.Fatalf("期望心跳输入包含被动召回信封，实际=%s", melchiorInput)
	}
	if !strings.Contains(melchiorInput, `"id":"doc-heartbeat"`) {
		t.Fatalf("期望心跳输入包含相关笔记 ID，实际=%s", melchiorInput)
	}
	if !strings.Contains(melchiorInput, `"relatedTo":"上一轮睡前笔记：台灯 线索 待办"`) {
		t.Fatalf("期望心跳输入明确说明这些 ID 跟上一轮什么内容相关，实际=%s", melchiorInput)
	}
	if !strings.Contains(melchiorInput, `"keywordHitCounts"`) {
		t.Fatalf("期望心跳输入包含整体关键词命中统计，实际=%s", melchiorInput)
	}
	if !strings.Contains(melchiorInput, "<source=user_message>\n"+heartbeatPrompt+"\n</source>") {
		t.Fatalf("期望心跳输入保留原始 heartbeat 提示词，实际=%s", melchiorInput)
	}
}

func expectKeywordHitCounts(t *testing.T, got map[string]int, expected map[string]int) {
	t.Helper()
	if len(got) != len(expected) {
		t.Fatalf("关键词命中统计数量不符，got=%v expected=%v", got, expected)
	}
	for keyword, expectedCount := range expected {
		if got[strings.TrimSpace(keyword)] != expectedCount {
			t.Fatalf("关键词 %s 命中次数不符，got=%v expected=%v", keyword, got, expected)
		}
	}
}
