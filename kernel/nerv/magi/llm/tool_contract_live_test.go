package llm

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// TestLiveConfiguredToolContract 使用工作空间中已配置的接口验证与原生 Agent 一致的工具调用请求契约。
// 测试进程只消费配置，不输出接口地址、Provider 标识或密钥。
func TestLiveConfiguredToolContract(t *testing.T) {
	workspaceDir := strings.TrimSpace(os.Getenv("MAGI_LIVE_WORKSPACE"))
	if workspaceDir == "" {
		t.Skip("set MAGI_LIVE_WORKSPACE to run the configured provider contract test")
	}
	modelName := strings.TrimSpace(os.Getenv("MAGI_LIVE_MODEL"))
	if modelName == "" {
		modelName = "deepseek-v4-flash"
	}

	data, err := os.ReadFile(filepath.Join(workspaceDir, "conf", "conf.json"))
	if err != nil {
		t.Fatalf("load workspace AI configuration failed: %v", err)
	}
	var appConfig struct {
		AI     *conf.AI     `json:"ai"`
		System *conf.System `json:"system"`
	}
	if err = json.Unmarshal(data, &appConfig); err != nil {
		t.Fatalf("parse workspace AI configuration failed: %v", err)
	}
	if appConfig.AI == nil {
		t.Fatal("workspace AI configuration is missing")
	}
	appConfig.AI.DecryptAPIKeys()
	appConfig.AI.Normalize()
	provider, model := appConfig.AI.GetModel(modelName)
	if provider == nil || model == nil {
		t.Fatalf("configured model %q was not found", modelName)
	}

	tool := openai.Tool{
		Type: openai.ToolTypeFunction,
		Function: &openai.FunctionDefinition{
			Name:        "propose_action_plan",
			Description: "提交本轮行动计划。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"plan": map[string]interface{}{
						"type":        "string",
						"description": "本轮的简短行动计划。",
					},
				},
				"required": []string{"plan"},
			},
		},
	}
	messages := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "必须调用提供的工具提交行动计划。"},
		{Role: types.RoleUser, Content: "请提交一个不超过十个字的测试计划。"},
	}
	client := NewClientFromProvider(
		provider,
		model,
		"s-forge-magi-tool-contract-test",
		appConfig.AI.EffectiveAPIProxy(appConfig.System),
	)
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()

	result, requestErr := client.SendChatRequestSyncDetailed(ctx, messages, []openai.Tool{tool}, nil)
	if requestErr != nil {
		t.Fatalf("tool request failed: %v", requestErr)
	}
	if result == nil {
		t.Fatal("tool request returned a nil result")
	}
	if len(result.ToolCalls) == 0 {
		t.Fatalf("tool request returned no tool call, finish_reason=%q", result.FinishReason)
	}
	if result.ToolCalls[0].Function.Name != "propose_action_plan" {
		t.Fatalf("tool request called unexpected tool %q", result.ToolCalls[0].Function.Name)
	}
}
