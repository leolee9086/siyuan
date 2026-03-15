package config

import (
	"testing"
)

// TestDefaultMelchiorConfig_HasDeliberationSignalTool 验证默认 Melchior 配置包含 deliberation_signal 工具
func TestDefaultMelchiorConfig_HasDeliberationSignalTool(t *testing.T) {
	cfg := defaultMelchiorConfig()

	if len(cfg.Tools) == 0 {
		t.Fatal("Melchior 配置未包含任何工具")
	}

	hasDeliberationSignal := false
	for _, tool := range cfg.Tools {
		if tool.Function.Name == DeliberationSignalToolName {
			hasDeliberationSignal = true
			break
		}
	}

	if !hasDeliberationSignal {
		t.Fatalf("Melchior 默认配置缺少 %s 工具", DeliberationSignalToolName)
	}
}

// TestApplyRequiredAvatarTools_EnsuresDeliberationSignal 验证配置加载时自动补齐 deliberation_signal 工具
func TestApplyRequiredAvatarTools_EnsuresDeliberationSignal(t *testing.T) {
	// 创建一个没有 deliberation_signal 的配置
	cfg := &MAGIConfig{
		Melchior: AgentConfig{
			Name:  "melchior",
			Tools: []ToolDef{BuildAvatarBuildToolDef()},
		},
	}

	// 应用必需工具
	applyRequiredAvatarTools(cfg)

	// 验证 deliberation_signal 已被添加
	hasDeliberationSignal := false
	for _, tool := range cfg.Melchior.Tools {
		if tool.Function.Name == DeliberationSignalToolName {
			hasDeliberationSignal = true
			break
		}
	}

	if !hasDeliberationSignal {
		t.Fatalf("applyRequiredAvatarTools 未添加 %s 工具", DeliberationSignalToolName)
	}
}

// TestBuildDeliberationSignalToolDef_Structure 验证 deliberation_signal 工具定义结构
func TestBuildDeliberationSignalToolDef_Structure(t *testing.T) {
	tool := BuildDeliberationSignalToolDef()

	if tool.Type != "function" {
		t.Fatalf("期望 Type 为 'function'，得到 '%s'", tool.Type)
	}

	if tool.Function.Name != DeliberationSignalToolName {
		t.Fatalf("期望 Name 为 '%s'，得到 '%s'", DeliberationSignalToolName, tool.Function.Name)
	}

	if tool.Function.Description == "" {
		t.Fatal("Description 不应为空")
	}

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

	required, ok := tool.Function.Parameters["required"].([]string)
	if !ok {
		t.Fatal("Parameters 缺少 required 字段")
	}

	if len(required) != 2 {
		t.Fatalf("期望 required 包含 2 个字段，得到 %d", len(required))
	}
}
