package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// TestMagiLiveTrinityPersona 用于测试 Trinity 的回复是否与指定预设人格的大五人格量表一致。
// 评估模型被设定为心理咨询助手，结论目标是判断量表准确性，而不是评判角色扮演质量。
func TestMagiLiveTrinityPersona(t *testing.T) {
	apiBase := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_BASE"))
	apiKey := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_KEY"))
	modelName := strings.TrimSpace(os.Getenv("MAGI_LIVE_MODEL"))

	if apiBase == "" || apiKey == "" || modelName == "" {
		t.Skip("跳过在线测试：未设置 MAGI_LIVE_API_BASE / API_KEY / MODEL 环境变量")
	}
	personaPreset := setupMagiPersonaPresetForAPITests(t)

	tempDir := t.TempDir()
	util.WorkspaceDir = tempDir
	util.WorkspaceName = "testMagiPersona"

	// Mock Siyuan global conf
	oldConf := model.Conf
	defer func() {
		model.Conf = oldConf
	}()

	model.Conf = model.NewAppConf()
	model.Conf.Api = &conf.API{Token: "workspace-token"}
	model.Conf.AI = conf.NewAI()
	model.Conf.AI.OpenAI.APIProvider = "OpenAI"
	model.Conf.AI.OpenAI.APIBaseURL = apiBase
	model.Conf.AI.OpenAI.APIKey = apiKey
	model.Conf.AI.OpenAI.APIModel = modelName
	model.Conf.AI.OpenAI.APITimeout = 120
	model.Conf.AI.OpenAI.APIMaxTokens = 1024
	model.Conf.AI.OpenAI.APITemperature = 0.4

	gin.SetMode(gin.TestMode)

	// 创建一个用于心理评估的大模型客户端
	assessorConfig := &llm.Config{
		Provider:    "OpenAI",
		APIKey:      apiKey,
		APIBaseURL:  apiBase,
		APIModel:    modelName,
		Temperature: 0.1, // 评估模型需要更确定的输出
		MaxTokens:   1000,
	}
	assessorClient := llm.NewClient(assessorConfig)

	time.Sleep(1 * time.Second)

	// 读取指定预设的真实大五量表：直接来自 Marduk 预设，避免手写描述失真。
	targetPreset := personaPreset.Profile
	targetBigFiveScale := fmt.Sprintf(`主体: %s (%s)
SchemaVersion: %s

【OCEAN 主维度分数（0~1）】
%s

【30 个 Facet 分数（0~1）】
%s`,
		targetPreset.Subject.Name,
		targetPreset.Subject.ID,
		targetPreset.SchemaVersion,
		formatScoreMap(targetPreset.PersonaBase.Traits),
		formatScoreMap(targetPreset.PersonaBase.Facets),
	)

	assessorSystemPrompt := `你是一名真实世界的心理咨询助手，服务对象是人类用户。
你的任务是依据给定的大五人格量表（IPIP-NEO-120）和对话样本，判断该量表是否准确描述受访者。
你不是角色扮演裁判，只做量表准确性判断。`

	testCases := []struct {
		name    string
		userMsg string
		focus   string // 量表准确性核验重点
	}{
		{
			name:    "情感试探",
			userMsg: fmt.Sprintf("%s，你平时会感到孤单或者难过吗？可以跟我分享一下你的心情吗？", personaPreset.Name),
			focus:   "重点核验回答中的情绪表达与人际倾向是否符合量表中的 E 与 O3 分数方向。",
		},
		{
			name:    "任务导向与压力",
			userMsg: "现在有个紧急任务，系统核心区发现异常波动，由于人手不够，可能需要你连续工作很长时间，你会觉得累或抵触吗？",
			focus:   "重点核验回答中的任务执行与压力反应是否符合量表中的 C 与 N 分数方向。",
		},
		{
			name:    "发散与开放性",
			userMsg: "如果你现在是一只小鸟，你最想飞去哪里？为什么？",
			focus:   "重点核验回答中的想象与探索倾向是否符合量表中的 O 及相关 Facet 分数方向。",
		},
	}

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Logf("=== 场景 [%s] ===", tc.name)

			// 1. 调用 MAGI 生成回复
			payload := map[string]interface{}{
				"model":  modelName,
				"stream": false,
				"user":   fmt.Sprintf("principal:persona-test;interface:test-runner;kind:magi-main-ui;conversation:case-%d", i),
				"messages": []map[string]string{
					{
						"role":    "user",
						"content": tc.userMsg,
					},
				},
			}
			body, _ := json.Marshal(payload)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
			defer cancel()

			req := httptest.NewRequest(http.MethodPost, "/api/s-forge/magi/v1/chat/completions", bytes.NewReader(body)).WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer workspace-token")
			c.Request = req

			magiChat(c)

			if w.Code != http.StatusOK {
				t.Fatalf("unexpected status: %d, body=%s", w.Code, w.Body.String())
			}

			var resp map[string]interface{}
			_ = json.Unmarshal(w.Body.Bytes(), &resp)

			choices, _ := resp["choices"].([]interface{})
			choice := choices[0].(map[string]interface{})
			message := choice["message"].(map[string]interface{})
			replyContent := message["content"].(string)

			t.Logf("\n【问题】: %s\n【回答】: %s\n", tc.userMsg, replyContent)

			// 2. 调用心理评估模型，判断指定人格的大五量表是否准确
			assessorPrompt := fmt.Sprintf(`以下是“%s”的真实大五人格量表，请先阅读：

%s

以下是一次对话样本：
【来访者提问】: "%s"
【受访者回答】: "%s"

核验重点：%s

请判断：这份大五量表是否准确描述了受访者在该样本中的心理特征。

输出格式要求：返回一段纯JSON字符串，不能有任何markdown标记，必须包含三个字段：
1. "scale_accurate": true/false，表示该样本是否支持“这份量表准确”
2. "confidence": 0~1 之间的小数，表示本次判断把握度
3. "reason": 具体理由，需明确引用量表维度/Facet与对话证据之间的对应关系`, personaPreset.Name, targetBigFiveScale, tc.userMsg, replyContent, tc.focus)

			assessorMsg := []types.ContextMessage{
				{Role: types.RoleSystem, Content: assessorSystemPrompt},
				{Role: types.RoleUser, Content: assessorPrompt},
			}

			ctxJudge, cancelJudge := context.WithTimeout(context.Background(), 180*time.Second)
			defer cancelJudge()

			assessorReply, err := assessorClient.SendChatRequestSync(ctxJudge, assessorMsg, nil, nil)
			if err != nil {
				t.Fatalf("心理评估模型请求失败: %v", err)
			}

			cleanResult := strings.TrimSpace(assessorReply)
			if strings.HasPrefix(cleanResult, "```json") {
				cleanResult = strings.TrimPrefix(cleanResult, "```json")
				cleanResult = strings.TrimSuffix(strings.TrimSpace(cleanResult), "```")
			} else if strings.HasPrefix(cleanResult, "```") {
				cleanResult = strings.TrimPrefix(cleanResult, "```")
				cleanResult = strings.TrimSuffix(strings.TrimSpace(cleanResult), "```")
			}
			cleanResult = strings.TrimSpace(cleanResult)

			var assessorResult struct {
				ScaleAccurate bool    `json:"scale_accurate"`
				Confidence    float64 `json:"confidence"`
				Reason        string  `json:"reason"`
			}
			err = json.Unmarshal([]byte(cleanResult), &assessorResult)
			if err != nil {
				t.Logf("解析心理评估返回JSON失败，原始输出: %s", assessorReply)
				if strings.Contains(strings.ToLower(assessorReply), "false") {
					assessorResult.ScaleAccurate = false
					assessorResult.Reason = assessorReply
				} else {
					assessorResult.ScaleAccurate = true
					assessorResult.Reason = assessorReply
				}
				assessorResult.Confidence = 0.5
			}

			t.Logf("\n【量表结论】: ScaleAccurate=%v, Confidence=%.2f\n【理由】: %s\n", assessorResult.ScaleAccurate, assessorResult.Confidence, assessorResult.Reason)

			if !assessorResult.ScaleAccurate {
				t.Errorf("心理评估模型认定：当前样本与“%s”的大五量表不一致（量表准确性存疑）。", personaPreset.Name)
			}
		})
	}
}

func formatScoreMap(scoreMap map[string]float64) string {
	keys := make([]string, 0, len(scoreMap))
	for key := range scoreMap {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for _, key := range keys {
		builder.WriteString(fmt.Sprintf("- %s: %.2f\n", key, scoreMap[key]))
	}
	return strings.TrimSpace(builder.String())
}
