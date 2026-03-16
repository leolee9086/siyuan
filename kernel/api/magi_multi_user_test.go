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

// TestMagiMultiUserSessionIsolation 测试多用户会话隔离
// 验证Melchior能够为不同用户维护独立的历史记录
func TestMagiMultiUserSessionIsolation(t *testing.T) {
	apiBase := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_BASE"))
	apiKey := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_KEY"))
	modelName := strings.TrimSpace(os.Getenv("MAGI_LIVE_MODEL"))

	if apiBase == "" || apiKey == "" || modelName == "" {
		t.Skip("跳过在线测试：未设置 MAGI_LIVE_API_BASE / API_KEY / MODEL 环境变量")
	}
	_ = setupMagiPersonaPresetForAPITests(t)

	tempDir := t.TempDir()
	util.WorkspaceDir = tempDir
	util.WorkspaceName = "testMagiMultiUser"
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
	armorByUser := map[string]string{
		"alice": issueLiveArmorTokenForIdentity(t, "alice", "alice"),
		"bob":   issueLiveArmorTokenForIdentity(t, "bob", "bob"),
	}

	gin.SetMode(gin.TestMode)

	// 测试场景：两个用户穿插对话
	type userMessage struct {
		userID  string
		message string
		expect  string // 期望回复中包含的关键词
	}

	messages := []userMessage{
		{userID: "alice", message: "我叫Alice，我最喜欢的颜色是蓝色", expect: ""},
		{userID: "bob", message: "我叫Bob，我最喜欢的颜色是红色", expect: ""},
		{userID: "alice", message: "请问我最喜欢什么颜色？", expect: "蓝"},
		{userID: "bob", message: "请问我最喜欢什么颜色？", expect: "红"},
	}

	for i, msg := range messages {
		t.Run(fmt.Sprintf("Step%d_%s", i+1, msg.userID), func(t *testing.T) {
			payload := map[string]interface{}{
				"model":  modelName,
				"stream": false,
				"user":   fmt.Sprintf("principal:%s;interface:test-runner;kind:magi-main-ui;conversation:session-%s", msg.userID, msg.userID),
				"messages": []map[string]string{
					{"role": "user", "content": msg.message},
				},
			}
			body, _ := json.Marshal(payload)

			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)
			ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
			defer cancel()

			req := httptest.NewRequest(http.MethodPost, "/api/s-forge/magi/v1/chat/completions", bytes.NewReader(body)).WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+armorByUser[msg.userID])
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

			t.Logf("\n【用户%s】: %s\n【回复】: %s\n", msg.userID, msg.message, replyContent)

			if msg.expect != "" && !strings.Contains(replyContent, msg.expect) {
				t.Errorf("期望回复包含'%s'，但实际回复为: %s", msg.expect, replyContent)
			}
		})

		time.Sleep(300 * time.Millisecond)
	}
}
