package config

import (
	"testing"
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
		Trinity: AgentConfig{
			Name:  "trinity",
			Tools: []ToolDef{BuildSpeakToolDef()},
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

	hasTrinityPublicStart := false
	hasTrinityPublicContinue := false
	hasTrinityPublicStop := false
	hasTrinityInternalStart := false
	hasTrinityInternalContinue := false
	hasTrinityInternalStop := false
	for _, tool := range cfg.Trinity.Tools {
		switch tool.Function.Name {
		case SpeakStartToolName:
			hasTrinityPublicStart = true
		case SpeakContinueToolName:
			hasTrinityPublicContinue = true
		case SpeakStopToolName:
			hasTrinityPublicStop = true
		case SpeakInternalStartToolName:
			hasTrinityInternalStart = true
		case SpeakInternalContinueToolName:
			hasTrinityInternalContinue = true
		case SpeakInternalStopToolName:
			hasTrinityInternalStop = true
		}
	}
	if !hasTrinityPublicStart || !hasTrinityPublicContinue || !hasTrinityPublicStop ||
		!hasTrinityInternalStart || !hasTrinityInternalContinue || !hasTrinityInternalStop {
		t.Fatalf(
			"Trinity 工具未被标准化为状态工具: publicStart=%v publicContinue=%v publicStop=%v internalStart=%v internalContinue=%v internalStop=%v",
			hasTrinityPublicStart,
			hasTrinityPublicContinue,
			hasTrinityPublicStop,
			hasTrinityInternalStart,
			hasTrinityInternalContinue,
			hasTrinityInternalStop,
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

func TestDefaultContextStrategy_TrinityMatchesCoreSages(t *testing.T) {
	strategies := defaultContextStrategy()
	trinity, ok := strategies["trinity"]
	if !ok || trinity == nil {
		t.Fatal("缺少 trinity 默认上下文策略")
	}

	if trinity.Type != "token_percent" {
		t.Fatalf("期望 trinity 使用 token_percent，实际=%s", trinity.Type)
	}
	if trinity.Percent != 0.8 {
		t.Fatalf("期望 trinity percent=0.8，实际=%v", trinity.Percent)
	}
}
