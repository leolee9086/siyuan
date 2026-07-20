package config

import (
	"reflect"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

// TestDefaultMelchiorConfig_HasWannaSpeakTransitionTools 验证默认 Melchior 配置包含成对表达工具。
func TestDefaultMelchiorConfig_HasWannaSpeakTransitionTools(t *testing.T) {
	cfg := defaultMelchiorConfig()

	if len(cfg.Tools) == 0 {
		t.Fatal("Melchior 配置未包含任何工具")
	}

	hasStart := false
	hasContinue := false
	hasStop := false
	for _, tool := range cfg.Tools {
		switch tool.Function.Name {
		case WannaSpeakStartToolName:
			hasStart = true
		case WannaSpeakContinueToolName:
			hasContinue = true
		case WannaSpeakStopToolName:
			hasStop = true
		}
	}

	if !hasStart || !hasContinue || !hasStop {
		t.Fatalf("Melchior 默认配置缺少表达状态工具: start=%v continue=%v stop=%v", hasStart, hasContinue, hasStop)
	}
}

// TestApplyRequiredAvatarTools_EnsuresPairedSpeechTools 验证配置加载时自动补齐成对表达工具。
func TestApplyRequiredAvatarTools_EnsuresPairedSpeechTools(t *testing.T) {
	// 创建一个缺少表达工具的配置
	cfg := &MAGIConfig{
		Melchior: AgentConfig{
			Name:  "melchior",
			Tools: []ToolDef{BuildAvatarBuildToolDef()},
		},
	}

	applyRequiredAvatarTools(cfg)

	hasMelchiorStart := false
	hasMelchiorContinue := false
	hasMelchiorStop := false
	for _, tool := range cfg.Melchior.Tools {
		switch tool.Function.Name {
		case WannaSpeakStartToolName:
			hasMelchiorStart = true
		case WannaSpeakContinueToolName:
			hasMelchiorContinue = true
		case WannaSpeakStopToolName:
			hasMelchiorStop = true
		}
	}
	if !hasMelchiorStart || !hasMelchiorContinue || !hasMelchiorStop {
		t.Fatalf(
			"Melchior 工具未被标准化为状态工具: start=%v continue=%v stop=%v",
			hasMelchiorStart,
			hasMelchiorContinue,
			hasMelchiorStop,
		)
	}

}

func TestBuildWannaSpeakTransitionToolDef_Structure(t *testing.T) {
	startTool := BuildWannaSpeakStartToolDef()
	continueTool := BuildWannaSpeakContinueToolDef()
	stopTool := BuildWannaSpeakStopToolDef()

	if startTool.Type != "function" || continueTool.Type != "function" || stopTool.Type != "function" {
		t.Fatalf(
			"期望工具 Type 为 function，得到 start=%s continue=%s stop=%s",
			startTool.Type,
			continueTool.Type,
			stopTool.Type,
		)
	}
	if startTool.Function.Name != WannaSpeakStartToolName {
		t.Fatalf("期望 Name 为 '%s'，得到 '%s'", WannaSpeakStartToolName, startTool.Function.Name)
	}
	if continueTool.Function.Name != WannaSpeakContinueToolName {
		t.Fatalf("期望 Name 为 '%s'，得到 '%s'", WannaSpeakContinueToolName, continueTool.Function.Name)
	}
	if stopTool.Function.Name != WannaSpeakStopToolName {
		t.Fatalf("期望 Name 为 '%s'，得到 '%s'", WannaSpeakStopToolName, stopTool.Function.Name)
	}
}

func TestBuildWannaSleepToolDefs_Structure(t *testing.T) {
	tests := []struct {
		name         string
		tool         ToolDef
		wantName     string
		wantRequired []string
		wantField    string
		wantDesc     string
	}{
		{
			name:         "record",
			tool:         BuildWannaSleepRecordToolDef(),
			wantName:     WannaSleepRecordToolName,
			wantRequired: []string{"summary"},
			wantField:    "summary",
			wantDesc:     "当前心情",
		},
		{
			name:         "plan",
			tool:         BuildWannaSleepPlanToolDef(),
			wantName:     WannaSleepPlanToolName,
			wantRequired: []string{"summary", "nextStepPlan"},
			wantField:    "nextStepPlan",
			wantDesc:     "下一步",
		},
		{
			name:         "dream",
			tool:         BuildWannaSleepDreamToolDef(),
			wantName:     WannaSleepDreamToolName,
			wantRequired: []string{"summary", "dreamScene"},
			wantField:    "dreamScene",
			wantDesc:     "画面",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.tool.Type != "function" {
				t.Fatalf("期望 Type=function，实际=%s", tt.tool.Type)
			}
			if tt.tool.Function.Name != tt.wantName {
				t.Fatalf("期望 Name=%s，实际=%s", tt.wantName, tt.tool.Function.Name)
			}
			if !strings.Contains(tt.tool.Function.Description, tt.wantDesc) {
				t.Fatalf("期望工具描述包含 %q，实际=%s", tt.wantDesc, tt.tool.Function.Description)
			}

			properties, ok := tt.tool.Function.Parameters["properties"].(map[string]interface{})
			if !ok {
				t.Fatal("Parameters 缺少 properties")
			}
			if _, ok := properties[tt.wantField]; !ok {
				t.Fatalf("Parameters 缺少 %s", tt.wantField)
			}

			required, ok := tt.tool.Function.Parameters["required"].([]string)
			if !ok {
				t.Fatal("Parameters 缺少 required")
			}
			if len(required) != len(tt.wantRequired) {
				t.Fatalf("required 数量不符，实际=%v", required)
			}
			for i, want := range tt.wantRequired {
				if required[i] != want {
					t.Fatalf("required[%d] 期望=%s，实际=%s", i, want, required[i])
				}
			}
		})
	}
}

// TestBuildDeliberationSignalToolDef_Structure 验证 deliberation_signal 工具定义结构
func TestBuildDeliberationSignalToolDef_Structure(t *testing.T) {
	tool := BuildDeliberationSignalToolDef()
	params, ok := tool.Function.Parameters["properties"].(map[string]interface{})
	if !ok {
		t.Fatal("Parameters 缺少 properties 字段")
	}

	if _, ok := params["requires_deliberation"]; !ok {
		t.Fatal("Parameters 缺少 requires_deliberation 字段")
	}

	if _, ok := params["reason"]; !ok {
		t.Fatal("Parameters 缺少 reason 字段")
	}
	if _, ok := params["proposed_action"]; !ok {
		t.Fatal("Parameters 缺少 proposed_action 字段")
	}

	required, ok := tool.Function.Parameters["required"].([]string)
	if !ok {
		t.Fatal("Parameters 缺少 required 字段")
	}

	if len(required) != 3 {
		t.Fatalf("期望 required 包含 3 个字段，得到 %d", len(required))
	}
}

func TestDefaultContextStrategy_CoversOnlyCoreSages(t *testing.T) {
	strategies := defaultContextStrategy()
	if len(strategies) != 3 {
		t.Fatalf("期望仅保留三贤人的默认上下文策略，实际=%d", len(strategies))
	}

	// melchior: token_percent, percent=80
	{
		strategy, ok := strategies["melchior"]
		if !ok || strategy == nil {
			t.Fatal("缺少 melchior 默认上下文策略")
		}
		if strategy.Type != "token_percent" {
			t.Fatalf("期望 melchior 使用 token_percent，实际=%s", strategy.Type)
		}
		if strategy.Percent != 80 {
			t.Fatalf("期望 melchior percent=80，实际=%v", strategy.Percent)
		}
	}

	// balthazar: token_percent, percent=40
	{
		strategy, ok := strategies["balthazar"]
		if !ok || strategy == nil {
			t.Fatal("缺少 balthazar 默认上下文策略")
		}
		if strategy.Type != "token_percent" {
			t.Fatalf("期望 balthazar 使用 token_percent，实际=%s", strategy.Type)
		}
		if strategy.Percent != 40 {
			t.Fatalf("期望 balthazar percent=40，实际=%v", strategy.Percent)
		}
	}

	// casper: round_count, count=7
	{
		strategy, ok := strategies["casper"]
		if !ok || strategy == nil {
			t.Fatal("缺少 casper 默认上下文策略")
		}
		if strategy.Type != "round_count" {
			t.Fatalf("期望 casper 使用 round_count，实际=%s", strategy.Type)
		}
		if strategy.Count != 7 {
			t.Fatalf("期望 casper count=7，实际=%d", strategy.Count)
		}
	}
}

func TestBuildNoteKeywordSearchToolDef_Structure(t *testing.T) {
	tool := BuildNoteKeywordSearchToolDef()
	if tool.Type != "function" {
		t.Fatalf("期望工具 Type=function，实际=%s", tool.Type)
	}
	if tool.Function.Name != NoteKeywordSearchToolName {
		t.Fatalf("期望工具名=%s，实际=%s", NoteKeywordSearchToolName, tool.Function.Name)
	}

	params, ok := tool.Function.Parameters["properties"].(map[string]interface{})
	if !ok {
		t.Fatal("Parameters 缺少 properties")
	}
	if _, ok := params["query"]; !ok {
		t.Fatal("Parameters 缺少 query")
	}
	if _, ok := params["purpose"]; !ok {
		t.Fatal("Parameters 缺少 purpose")
	}
	required, ok := tool.Function.Parameters["required"].([]string)
	if !ok || !reflect.DeepEqual(required, []string{"query", "purpose"}) {
		t.Fatalf("required 应包含 query 和 purpose，实际=%v", tool.Function.Parameters["required"])
	}
	limit, ok := params["limit"].(map[string]interface{})
	if !ok {
		t.Fatal("Parameters 缺少 limit")
	}
	if limit["maximum"] != 50 {
		t.Fatalf("期望 limit.maximum=50，实际=%v", limit["maximum"])
	}
}

func TestCoreSagesShareSameNoteKeywordSearchTool(t *testing.T) {
	melchior := defaultMelchiorConfig()
	balthazar := defaultBalthazarConfig()
	casper := defaultCasperConfig()

	getNoteTool := func(tools []ToolDef) (ToolDef, bool) {
		for _, tool := range tools {
			if tool.Function.Name == NoteKeywordSearchToolName {
				return tool, true
			}
		}
		return ToolDef{}, false
	}

	mTool, ok := getNoteTool(melchior.Tools)
	if !ok {
		t.Fatal("Melchior 缺少笔记关键词查询工具")
	}
	bTool, ok := getNoteTool(balthazar.Tools)
	if !ok {
		t.Fatal("Balthazar 缺少笔记关键词查询工具")
	}
	cTool, ok := getNoteTool(casper.Tools)
	if !ok {
		t.Fatal("Casper 缺少笔记关键词查询工具")
	}

	if !reflect.DeepEqual(mTool, bTool) || !reflect.DeepEqual(bTool, cTool) {
		t.Fatal("三贤人的笔记关键词查询工具定义不一致")
	}
}

func TestBuildForgeDevRepoToolDefs_Structure(t *testing.T) {
	// list/read/search 使用纯文本 input 参数
	plainInputTools := []ToolDef{
		BuildForgeDevRepoListToolDef(),
		BuildForgeDevRepoReadToolDef(),
		BuildForgeDevRepoSearchToolDef(),
	}
	expectedPlainNames := []string{
		ForgeDevRepoListToolName,
		ForgeDevRepoReadToolName,
		ForgeDevRepoSearchToolName,
	}

	for idx, tool := range plainInputTools {
		if tool.Type != "function" {
			t.Fatalf("工具[%d] Type 期望=function，实际=%s", idx, tool.Type)
		}
		if tool.Function.Name != expectedPlainNames[idx] {
			t.Fatalf("工具[%d] Name 期望=%s，实际=%s", idx, expectedPlainNames[idx], tool.Function.Name)
		}

		params, ok := tool.Function.Parameters["properties"].(map[string]interface{})
		if !ok {
			t.Fatalf("工具[%d] Parameters 缺少 properties", idx)
		}
		if _, ok := params["input"]; !ok {
			t.Fatalf("工具[%d] Parameters 缺少 input", idx)
		}
		if _, ok := params["purpose"]; !ok {
			t.Fatalf("工具[%d] Parameters 缺少 purpose", idx)
		}
		required, ok := tool.Function.Parameters["required"].([]string)
		if !ok || !reflect.DeepEqual(required, []string{"input", "purpose"}) {
			t.Fatalf("工具[%d] required 应包含 input 和 purpose，实际=%v", idx, tool.Function.Parameters["required"])
		}
	}

	// edit 工具使用结构化 JSON 参数
	editTool := BuildForgeDevRepoEditToolDef()
	if editTool.Type != "function" {
		t.Fatalf("forge_dev_repo_edit Type 期望=function，实际=%s", editTool.Type)
	}
	if editTool.Function.Name != ForgeDevRepoEditToolName {
		t.Fatalf("forge_dev_repo_edit Name 期望=%s，实际=%s", ForgeDevRepoEditToolName, editTool.Function.Name)
	}

	editParams, ok := editTool.Function.Parameters["properties"].(map[string]interface{})
	if !ok {
		t.Fatal("forge_dev_repo_edit Parameters 缺少 properties")
	}
	for _, field := range []string{"target_path", "old_string", "new_string", "motivation"} {
		if _, ok := editParams[field]; !ok {
			t.Fatalf("forge_dev_repo_edit Parameters 缺少 %s", field)
		}
	}

	editRequired, ok := editTool.Function.Parameters["required"].([]string)
	if !ok {
		t.Fatal("forge_dev_repo_edit Parameters 缺少 required")
	}
	if len(editRequired) != 4 {
		t.Fatalf("forge_dev_repo_edit required 期望4个字段，实际=%v", editRequired)
	}
}

func TestBuildWriteDiaryToolDef_Structure(t *testing.T) {
	tool := BuildWriteDiaryToolDef()
	if tool.Type != "function" {
		t.Fatalf("期望工具 Type=function，实际=%s", tool.Type)
	}
	if tool.Function.Name != WriteDiaryToolName {
		t.Fatalf("期望工具名=%s，实际=%s", WriteDiaryToolName, tool.Function.Name)
	}

	params, ok := tool.Function.Parameters["properties"].(map[string]interface{})
	if !ok {
		t.Fatal("Parameters 缺少 properties")
	}
	for _, field := range []string{"motivation", "markdown", "calloutType", "title"} {
		if _, ok := params[field]; !ok {
			t.Fatalf("Parameters 缺少 %s", field)
		}
	}

	required, ok := tool.Function.Parameters["required"].([]string)
	if !ok {
		t.Fatal("Parameters 缺少 required")
	}
	if len(required) != 2 {
		t.Fatalf("期望 required 有2个字段，实际=%v", required)
	}
	if required[0] != "motivation" && required[1] != "motivation" {
		t.Fatal("required 应包含 motivation")
	}
	if required[0] != "markdown" && required[1] != "markdown" {
		t.Fatal("required 应包含 markdown")
	}
}

func TestToolIntentParametersAreExplicitAndRequired(t *testing.T) {
	assertRequired := func(tool ToolDef, field string) {
		t.Helper()
		properties, ok := tool.Function.Parameters["properties"].(map[string]interface{})
		if !ok {
			t.Fatalf("%s 缺少 properties", tool.Function.Name)
		}
		if _, ok := properties[field]; !ok {
			t.Fatalf("%s 缺少显式 %s", tool.Function.Name, field)
		}
		required, ok := tool.Function.Parameters["required"].([]string)
		if !ok {
			t.Fatalf("%s 缺少 required", tool.Function.Name)
		}
		for _, name := range required {
			if name == field {
				return
			}
		}
		t.Fatalf("%s 未强制 %s: %v", tool.Function.Name, field, required)
	}

	queryTools := []ToolDef{
		BuildNoteKeywordSearchToolDef(),
		BuildNoteByIDReadToolDef(),
		BuildForgeDevRepoListToolDef(),
		BuildForgeDevRepoReadToolDef(),
		BuildForgeDevRepoSearchToolDef(),
		BuildSearchWebToolDef(),
		BuildFetchWebPageToolDef(),
		BuildInspectWebSearchEnginesToolDef(),
		BuildRecallCrossSessionMemoriesToolDef(),
		BuildListMagiChannelsToolDef(),
		BuildFetchChannelMessagesToolDef(),
		BuildListMagiContactsToolDef(),
	}
	for _, tool := range queryTools {
		assertRequired(tool, "purpose")
	}

	actionTools := []ToolDef{
		BuildWriteDiaryToolDef(),
		BuildCreateNoteDocumentToolDef(),
		BuildAppendNoteBlocksToolDef(),
		BuildModifyNoteBlockToolDef(),
		BuildRevertNoteBlockToolDef(),
		BuildForgeDevRepoEditToolDef(),
		BuildForgeDevRepoBatchReplaceToolDef(),
		BuildForgeDevRepoBashToolDef(),
		BuildAvatarBuildToolDef(),
		BuildAvatarModifyToolDef(),
		BuildAvatarSynthesizeToolDef(),
		BuildSendChannelMessageToolDef(),
		BuildPersistSessionMemoryToolDef(),
	}
	for _, tool := range actionTools {
		assertRequired(tool, "motivation")
	}
}

func TestBuildDefaultCoreSageTools_ForgeOnlyRepoTools(t *testing.T) {
	originalMode := util.Mode
	defer func() {
		util.Mode = originalMode
	}()

	allForgeToolNames := []string{
		ForgeDevRepoListToolName,
		ForgeDevRepoReadToolName,
		ForgeDevRepoSearchToolName,
		ForgeDevRepoEditToolName,
		ForgeDevRepoBatchReplaceToolName,
		ForgeDevRepoBashToolName,
	}

	util.Mode = util.ModeProd
	prodTools := buildDefaultCoreSageTools()
	for _, toolName := range allForgeToolNames {
		if hasToolDef(prodTools, toolName) {
			t.Fatalf("prod 模式下不应包含 forge 仓库工具: %s", toolName)
		}
	}

	util.Mode = util.ModeForge
	forgeTools := buildDefaultCoreSageTools()
	for _, toolName := range allForgeToolNames {
		if !hasToolDef(forgeTools, toolName) {
			t.Fatalf("forge 模式下缺少仓库工具: %s", toolName)
		}
	}
}

func TestApplyRequiredAvatarTools_StripsForgeRepoToolsOutsideForge(t *testing.T) {
	originalMode := util.Mode
	defer func() {
		util.Mode = originalMode
	}()
	util.Mode = util.ModeProd

	allForgeToolNames := []string{
		ForgeDevRepoListToolName,
		ForgeDevRepoReadToolName,
		ForgeDevRepoSearchToolName,
		ForgeDevRepoEditToolName,
		ForgeDevRepoBatchReplaceToolName,
		ForgeDevRepoBashToolName,
	}

	cfg := &MAGIConfig{
		Melchior: AgentConfig{
			Name: "melchior",
			Tools: []ToolDef{
				BuildForgeDevRepoListToolDef(),
				BuildForgeDevRepoReadToolDef(),
				BuildForgeDevRepoSearchToolDef(),
				BuildForgeDevRepoEditToolDef(),
			},
		},
	}

	applyRequiredAvatarTools(cfg)

	for _, toolName := range allForgeToolNames {
		if hasToolDef(cfg.Melchior.Tools, toolName) {
			t.Fatalf("prod 模式标准化后仍残留 forge 仓库工具: %s", toolName)
		}
	}
}

func hasToolDef(tools []ToolDef, toolName string) bool {
	for _, tool := range tools {
		if tool.Function.Name == toolName {
			return true
		}
	}
	return false
}
