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
	"github.com/siyuan-note/siyuan/kernel/util"
)

// TestMagiLiveDeepSeekRound 真实联调多轮测试（默认跳过）。
//
// 运行前需要设置环境变量：
//
//	MAGI_LIVE_API_BASE=https://api.deepseek.com/v1
//	MAGI_LIVE_API_KEY=...
//	MAGI_LIVE_MODEL=deepseek-chat (可选，默认 deepseek-chat)
func TestMagiLiveDeepSeekRound(t *testing.T) {
	apiBase := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_BASE"))
	apiKey := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_KEY"))
	modelName := strings.TrimSpace(os.Getenv("MAGI_LIVE_MODEL"))
	if apiBase == "" || apiKey == "" {
		t.Skip("skip live MAGI test: MAGI_LIVE_API_BASE or MAGI_LIVE_API_KEY is empty")
	}
	if modelName == "" {
		modelName = "deepseek-chat"
	}
	_ = setupMagiPersonaPresetForAPITests(t)

	tempDir := t.TempDir()
	util.WorkspaceDir = tempDir
	util.WorkspaceName = "testMagiLiveRound"
	setupMagiLiveIdentityStoreForTests(t, tempDir)

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
	armorToken := issueLiveArmorTokenForIdentity(t, "live-test", "live-test")

	// 多轮对话历史
	messages := []map[string]string{}

	// 第一轮：自我介绍和日期
	t.Log("=== Round 1: 自我介绍和日期 ===")
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": "请你用一句中文完成自我介绍，并给出今天的日期（YYYY-MM-DD）。",
	})
	reply1 := sendMagiRequest(t, modelName, messages, armorToken)
	t.Logf("Round 1 reply: %s", reply1)
	messages = append(messages, map[string]string{
		"role":    "assistant",
		"content": reply1,
	})

	// 第二轮：测试上下文记忆
	t.Log("=== Round 2: 测试上下文记忆 ===")
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": "你刚才说的日期是哪一天？请直接回答日期，不要重复介绍。",
	})
	reply2 := sendMagiRequest(t, modelName, messages, armorToken)
	t.Logf("Round 2 reply: %s", reply2)
	messages = append(messages, map[string]string{
		"role":    "assistant",
		"content": reply2,
	})

	// 第三轮：简单计算
	t.Log("=== Round 3: 简单计算 ===")
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": "123 + 456 等于多少？只回答数字。",
	})
	reply3 := sendMagiRequest(t, modelName, messages, armorToken)
	t.Logf("Round 3 reply: %s", reply3)
	messages = append(messages, map[string]string{
		"role":    "assistant",
		"content": reply3,
	})

	// 第四轮：测试多轮记忆
	t.Log("=== Round 4: 测试多轮记忆 ===")
	messages = append(messages, map[string]string{
		"role":    "user",
		"content": "我们一共进行了几轮对话？（包括这一轮）",
	})
	reply4 := sendMagiRequest(t, modelName, messages, armorToken)
	t.Logf("Round 4 reply: %s", reply4)

	t.Log("=== 多轮测试完成 ===")
}

// sendMagiRequest 发送单次MAGI请求并返回回复内容
func sendMagiRequest(t *testing.T, modelName string, messages []map[string]string, armorToken string) string {
	payload := map[string]interface{}{
		"model":    modelName,
		"stream":   false,
		"user":     "principal:live-test;interface:desktop-main;kind:magi-main-ui;conversation:live-multi-round",
		"messages": messages,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload failed: %v", err)
	}

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
	defer cancel()

	req := httptest.NewRequest(http.MethodPost, "/api/s-forge/magi/v1/chat/completions", bytes.NewReader(body)).WithContext(ctx)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+armorToken)
	c.Request = req

	started := time.Now()
	magiChat(c)
	elapsed := time.Since(started)

	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status: %d, body=%s", w.Code, w.Body.String())
	}

	var resp map[string]interface{}
	if err = json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response failed: %v, body=%s", err, w.Body.String())
	}

	choices, ok := resp["choices"].([]interface{})
	if !ok || len(choices) == 0 {
		t.Fatalf("choices missing in response: %s", w.Body.String())
	}
	choice, ok := choices[0].(map[string]interface{})
	if !ok {
		t.Fatalf("invalid first choice: %T", choices[0])
	}
	message, ok := choice["message"].(map[string]interface{})
	if !ok {
		t.Fatalf("message missing in first choice: %v", choice)
	}
	content := strings.TrimSpace(fmt.Sprintf("%v", message["content"]))
	if content == "" {
		t.Fatalf("empty assistant content: %s", w.Body.String())
	}

	t.Logf("Request completed in %s", elapsed)
	return content
}
