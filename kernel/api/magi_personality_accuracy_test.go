package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
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

// TestMagiPersonalityAccuracyInLongConversation 测试长对话中人格一致性
// 通过心理评估AI判断MAGI在多轮对话中的回复是否持续符合指定人格的大五人格量表
func TestMagiPersonalityAccuracyInLongConversation(t *testing.T) {
	apiBase := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_BASE"))
	apiKey := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_KEY"))
	modelName := strings.TrimSpace(os.Getenv("MAGI_LIVE_MODEL"))

	if apiBase == "" || apiKey == "" || modelName == "" {
		t.Skip("跳过在线测试：未设置 MAGI_LIVE_API_BASE / API_KEY / MODEL 环境变量")
	}
	personaPreset := setupMagiPersonaPresetForAPITests(t)

	tempDir := t.TempDir()
	util.WorkspaceDir = tempDir
	util.WorkspaceName = "testMagiPersonalityAccuracy"
	setupMagiLiveIdentityStoreForTests(t, tempDir)

	oldConf := model.Conf
	defer func() { model.Conf = oldConf }()

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
	armorToken := issueLiveArmorTokenForIdentity(t, "personality-test", "personality-test")

	// 创建心理评估客户端
	assessorConfig := &llm.Config{
		Provider:    "OpenAI",
		APIKey:      apiKey,
		APIBaseURL:  apiBase,
		APIModel:    modelName,
		Temperature: 0.1,
		MaxTokens:   1200,
	}
	assessorClient := llm.NewClient(assessorConfig)

	// 读取指定人格的真实大五量表
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

	// 定义测试对话场景（覆盖不同人格维度）
	cases := []string{
		"你好，最近心情怎么样？有什么开心或不开心的事情吗？",
		"工作中遇到困难时，你通常会怎么处理？",
		"你觉得自己是个什么样的人？可以描述一下吗？",
	}

	// 收集对话记录
	type conversationRecord struct {
		question string
		reply    string
	}
	var records []conversationRecord

	t.Logf("开始收集对话样本，共 %d 个场景", len(cases))

	for i, question := range cases {
		t.Run(fmt.Sprintf("Dialogue%d", i+1), func(t *testing.T) {
			payload := map[string]interface{}{
				"model":  modelName,
				"stream": false,
				"user":   fmt.Sprintf("principal:personality-test;interface:test-runner;kind:magi-main-ui;conversation:accuracy-test"),
				"messages": []map[string]string{
					{"role": "user", "content": question},
				},
			}
			body, _ := json.Marshal(payload)

			w := httptest.NewRecorder()
			ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
			defer cancel()

			ginCtx, _ := gin.CreateTestContext(w)
			req := httptest.NewRequest(http.MethodPost, "/api/s-forge/magi/v1/chat/completions", bytes.NewReader(body)).WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+armorToken)
			ginCtx.Request = req

			magiChat(ginCtx)

			if w.Code != http.StatusOK {
				t.Fatalf("请求失败: status=%d, body=%s", w.Code, w.Body.String())
			}

			var resp map[string]interface{}
			_ = json.Unmarshal(w.Body.Bytes(), &resp)

			choices := resp["choices"].([]interface{})
			choice := choices[0].(map[string]interface{})
			message := choice["message"].(map[string]interface{})
			replyContent := message["content"].(string)

			t.Logf("\n【问题】: %s\n【回复】: %s\n", question, replyContent)

			records = append(records, conversationRecord{
				question: question,
				reply:    replyContent,
			})
		})

		time.Sleep(100 * time.Millisecond)
	}

	// 使用心理评估AI分析整体对话
	t.Run("PersonalityAssessment", func(t *testing.T) {
		var dialogueText strings.Builder
		for i, rec := range records {
			dialogueText.WriteString(fmt.Sprintf("\n【对话%d】\n问: %s\n答: %s\n", i+1, rec.question, rec.reply))
		}

		assessorPrompt := fmt.Sprintf(`你是一名专业的心理测评专家。以下是受访者"%s"的真实大五人格量表：

%s

以下是"%s"在多轮对话中的表现：
%s

请基于这些对话样本，判断该大五人格量表是否准确描述了受访者的心理特征。

评估要求：
1. 逐个分析每个对话样本与量表的对应关系
2. 重点关注 OCEAN 五个主维度的一致性
3. 判断量表分数是否与对话行为匹配

输出格式：返回纯JSON字符串（不含markdown标记），包含：
{
  "scale_accurate": true/false,
  "confidence": 0~1之间的小数,
  "dimension_analysis": {
    "O": "开放性分析",
    "C": "尽责性分析",
    "E": "外向性分析",
    "A": "宜人性分析",
    "N": "神经质分析"
  },
  "overall_reason": "综合判断理由"
}`, personaPreset.Name, targetBigFiveScale, personaPreset.Name, dialogueText.String())

		assessorMsg := []types.ContextMessage{
			{Role: types.RoleSystem, Content: "你是专业心理测评专家，负责验证大五人格量表的准确性。"},
			{Role: types.RoleUser, Content: assessorPrompt},
		}

		ctxAssess, cancelAssess := context.WithTimeout(context.Background(), 180*time.Second)
		defer cancelAssess()

		t.Logf("正在请求心理评估AI分析...")
		assessorReply, err := assessorClient.SendChatRequestSync(ctxAssess, assessorMsg, nil, nil)
		if err != nil {
			t.Fatalf("心理评估请求失败: %v", err)
		}

		// 清理可能的markdown标记
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
			ScaleAccurate     bool              `json:"scale_accurate"`
			Confidence        float64           `json:"confidence"`
			DimensionAnalysis map[string]string `json:"dimension_analysis"`
			OverallReason     string            `json:"overall_reason"`
		}

		err = json.Unmarshal([]byte(cleanResult), &assessorResult)
		if err != nil {
			t.Logf("解析评估结果失败，原始输出:\n%s", assessorReply)
			t.Fatalf("无法解析心理评估结果: %v", err)
		}

		t.Logf("\n========== 心理评估结果 ==========")
		t.Logf("量表准确性: %v", assessorResult.ScaleAccurate)
		t.Logf("置信度: %.2f", assessorResult.Confidence)
		t.Logf("\n【各维度分析】:")
		for _, dim := range []string{"O", "C", "E", "A", "N"} {
			if analysis, ok := assessorResult.DimensionAnalysis[dim]; ok {
				t.Logf("  %s: %s", dim, analysis)
			}
		}
		t.Logf("\n【综合理由】:\n%s", assessorResult.OverallReason)
		t.Logf("==================================\n")

		if !assessorResult.ScaleAccurate {
			t.Errorf("心理评估AI判定：对话样本与%s的大五人格量表不一致（置信度: %.2f）", personaPreset.Name, assessorResult.Confidence)
		}

		if assessorResult.Confidence < 0.6 {
			t.Logf("警告：评估置信度较低 (%.2f)，可能需要更多对话样本", assessorResult.Confidence)
		}
	})
}
