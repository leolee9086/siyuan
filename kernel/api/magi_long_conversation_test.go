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

// TestMagiLongConversationStability 测试长时间对话中的稳定性
// 验证MAGI系统在多用户、多轮次对话中的：
// 1. 上下文记忆持久性
// 2. 用户会话隔离
// 3. 系统稳定性
// 4. 复杂信息的准确回忆
func TestMagiLongConversationStability(t *testing.T) {
	apiBase := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_BASE"))
	apiKey := strings.TrimSpace(os.Getenv("MAGI_LIVE_API_KEY"))
	modelName := strings.TrimSpace(os.Getenv("MAGI_LIVE_MODEL"))

	if apiBase == "" || apiKey == "" || modelName == "" {
		t.Skip("跳过在线测试：未设置 MAGI_LIVE_API_BASE / API_KEY / MODEL 环境变量")
	}
	_ = setupMagiPersonaPresetForAPITests(t)

	tempDir := t.TempDir()
	util.WorkspaceDir = tempDir
	util.WorkspaceName = "testMagiLongConv"

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

	// 定义测试用户及其信息
	type userProfile struct {
		userID   string
		name     string
		age      int
		city     string
		hobby    string
		pet      string
		favFood  string
		favColor string
	}

	users := []userProfile{
		{
			userID:   "alice",
			name:     "Alice",
			age:      28,
			city:     "北京",
			hobby:    "阅读",
			pet:      "猫",
			favFood:  "寿司",
			favColor: "蓝色",
		},
		{
			userID:   "bob",
			name:     "Bob",
			age:      35,
			city:     "上海",
			hobby:    "跑步",
			pet:      "狗",
			favFood:  "火锅",
			favColor: "红色",
		},
		{
			userID:   "charlie",
			name:     "Charlie",
			age:      42,
			city:     "深圳",
			hobby:    "摄影",
			pet:      "鹦鹉",
			favFood:  "披萨",
			favColor: "绿色",
		},
	}

	// 定义复杂的对话场景
	type conversationStep struct {
		userID  string
		message string
		expect  string // 期望回复中包含的关键词
		desc    string // 测试步骤描述
	}

	steps := []conversationStep{
		// 第一阶段：用户自我介绍（建立基础信息）
		{userID: "alice", message: "你好，我叫Alice，今年28岁", expect: "", desc: "Alice介绍姓名和年龄"},
		{userID: "bob", message: "你好，我是Bob，35岁", expect: "", desc: "Bob介绍姓名和年龄"},
		{userID: "charlie", message: "大家好，我是Charlie，42岁", expect: "", desc: "Charlie介绍姓名和年龄"},

		// 第二阶段：添加更多个人信息
		{userID: "alice", message: "我住在北京，喜欢阅读", expect: "", desc: "Alice添加城市和爱好"},
		{userID: "bob", message: "我在上海工作，平时喜欢跑步", expect: "", desc: "Bob添加城市和爱好"},
		{userID: "charlie", message: "我在深圳，业余时间喜欢摄影", expect: "", desc: "Charlie添加城市和爱好"},

		// 第三阶段：添加宠物和食物偏好
		{userID: "alice", message: "我养了一只猫，最喜欢吃寿司", expect: "", desc: "Alice添加宠物和食物"},
		{userID: "bob", message: "我有一只狗，最爱吃火锅", expect: "", desc: "Bob添加宠物和食物"},
		{userID: "charlie", message: "我养了一只鹦鹉，喜欢吃披萨", expect: "", desc: "Charlie添加宠物和食物"},

		// 第四阶段：添加颜色偏好
		{userID: "alice", message: "对了，我最喜欢的颜色是蓝色", expect: "", desc: "Alice添加颜色偏好"},
		{userID: "bob", message: "我最喜欢红色", expect: "", desc: "Bob添加颜色偏好"},
		{userID: "charlie", message: "我偏爱绿色", expect: "", desc: "Charlie添加颜色偏好"},

		// 第五阶段：测试基础记忆（单项回忆）
		{userID: "alice", message: "请问我叫什么名字？", expect: "Alice", desc: "Alice测试姓名记忆"},
		{userID: "bob", message: "我多大年龄？", expect: "35", desc: "Bob测试年龄记忆"},
		{userID: "charlie", message: "我住在哪里？", expect: "深圳", desc: "Charlie测试城市记忆"},

		// 第六阶段：测试复合记忆（多项信息）
		{userID: "alice", message: "请总结一下我的基本信息", expect: "28", desc: "Alice测试综合信息回忆"},
		{userID: "bob", message: "我的爱好和宠物是什么？", expect: "跑步", desc: "Bob测试多项信息"},
		{userID: "charlie", message: "我喜欢什么颜色和食物？", expect: "绿", desc: "Charlie测试偏好记忆"},

		// 第七阶段：交叉验证（确保用户隔离）
		{userID: "alice", message: "我养的是什么宠物？", expect: "猫", desc: "Alice验证宠物信息"},
		{userID: "bob", message: "我最喜欢的颜色是什么？", expect: "红", desc: "Bob验证颜色信息"},
		{userID: "charlie", message: "我的年龄是多少？", expect: "42", desc: "Charlie验证年龄信息"},

		// 第八阶段：复杂推理（基于已知信息）
		{userID: "alice", message: "根据我的信息，你觉得我适合去哪里旅游？", expect: "", desc: "Alice测试推理能力"},
		{userID: "bob", message: "基于我的爱好，推荐一个适合我的活动", expect: "", desc: "Bob测试推理能力"},
		{userID: "charlie", message: "考虑我的职业兴趣，给我一些建议", expect: "", desc: "Charlie测试推理能力"},

		// 第九阶段：长期记忆测试（回到早期信息）
		{userID: "alice", message: "我最开始告诉你我多大了？", expect: "28", desc: "Alice测试长期记忆"},
		{userID: "bob", message: "我一开始说我住在哪里？", expect: "上海", desc: "Bob测试长期记忆"},
		{userID: "charlie", message: "我最初介绍的爱好是什么？", expect: "摄影", desc: "Charlie测试长期记忆"},
	}

	t.Logf("开始长对话稳定性测试，共 %d 个步骤，%d 个用户", len(steps), len(users))

	for i, step := range steps {
		stepNum := i + 1
		t.Run(fmt.Sprintf("Step%02d_%s_%s", stepNum, step.userID, step.desc), func(t *testing.T) {
			payload := map[string]interface{}{
				"model":  modelName,
				"stream": false,
				"user":   fmt.Sprintf("principal:user-%s;interface:test-runner;kind:magi-main-ui;conversation:session-%s", step.userID, step.userID),
				"messages": []map[string]string{
					{"role": "user", "content": step.message},
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
				t.Fatalf("步骤 %d 失败: status=%d, body=%s", stepNum, w.Code, w.Body.String())
			}

			var resp map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("步骤 %d 解析响应失败: %v", stepNum, err)
			}

			choices, ok := resp["choices"].([]interface{})
			if !ok || len(choices) == 0 {
				t.Fatalf("步骤 %d 响应格式错误: 无choices", stepNum)
			}

			choice := choices[0].(map[string]interface{})
			message := choice["message"].(map[string]interface{})
			replyContent := message["content"].(string)

			t.Logf("\n[步骤%02d] 用户=%s\n问题: %s\n回复: %s\n", stepNum, step.userID, step.message, replyContent)

			if step.expect != "" && !strings.Contains(replyContent, step.expect) {
				t.Errorf("步骤 %d 验证失败: 期望包含'%s'，实际回复: %s", stepNum, step.expect, replyContent)
			}
		})

		// 在步骤之间添加短暂延迟，避免API限流
		time.Sleep(1500 * time.Millisecond)
	}

	t.Logf("长对话稳定性测试完成，共执行 %d 个步骤", len(steps))
}
