package api

import (
	"encoding/base64"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
)

func TestResolveOpenAISourceContext_DirectAllowed(t *testing.T) {
	restore := setupMagiSourceTestConf()
	defer restore()

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer workspace-token")

	req := openai.ChatCompletionRequest{
		Model: "magi-trinity",
		User:  "principal:alice;interface:desktop-main;kind:magi-main-ui;conversation:conv-1",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	sourceCtx, authErr := resolveOpenAISourceContext(c, &req)
	if authErr != nil {
		t.Fatalf("unexpected auth error: %v", authErr)
	}
	if sourceCtx == nil {
		t.Fatal("source context should not be nil")
	}
	if !sourceCtx.DirectResponseAllowed {
		t.Fatal("guardian main ui request should allow direct response")
	}
	if sourceCtx.Channel != "guardian" {
		t.Fatalf("unexpected channel: %s", sourceCtx.Channel)
	}
}

func TestResolveOpenAISourceContext_NonMainInterface(t *testing.T) {
	restore := setupMagiSourceTestConf()
	defer restore()

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer workspace-token")

	req := openai.ChatCompletionRequest{
		Model: "magi-trinity",
		User:  "principal:alice;interface:note-main;kind:siyuan-note-upstream",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	sourceCtx, authErr := resolveOpenAISourceContext(c, &req)
	if authErr != nil {
		t.Fatalf("unexpected auth error: %v", authErr)
	}
	if sourceCtx.DirectResponseAllowed {
		t.Fatal("siyuan-note-upstream should not allow direct response")
	}
}

func TestResolveOpenAISourceContext_InvalidKey(t *testing.T) {
	restore := setupMagiSourceTestConf()
	defer restore()

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer wrong-key")

	req := openai.ChatCompletionRequest{
		Model: "magi-trinity",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	_, authErr := resolveOpenAISourceContext(c, &req)
	if authErr == nil {
		t.Fatal("expected auth error for invalid source key")
	}
	if authErr.Code != "magi_source_key_invalid" {
		t.Fatalf("unexpected error code: %s", authErr.Code)
	}
}

func TestResolveOpenAISourceContext_ChannelForbidden(t *testing.T) {
	restore := setupMagiSourceTestConf()
	defer restore()

	claims := sourceKeyClaimsV1{
		Principal:     "external-bot",
		Channels:      []string{"external-agent"},
		Models:        []string{"magi-"},
		InterfaceKind: "siyuan-note-upstream",
	}
	rawClaims, _ := json.Marshal(claims)
	key := "magi_sk_v1_" + base64.RawURLEncoding.EncodeToString(rawClaims)

	c := newTestGinContext()
	c.Request.Header.Set("X-MAGI-Source-Key", key)

	req := openai.ChatCompletionRequest{
		Model: "magi-trinity",
		User:  "principal:external-bot;interface:panel-1;kind:siyuan-note-upstream",
		Messages: []openai.ChatCompletionMessage{
			{
				Role:    openai.ChatMessageRoleSystem,
				Content: `<request_source>{"source":"guardian"}</request_source>`,
			},
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	_, authErr := resolveOpenAISourceContext(c, &req)
	if authErr == nil {
		t.Fatal("expected channel forbidden error")
	}
	if authErr.Code != "magi_source_channel_forbidden" {
		t.Fatalf("unexpected error code: %s", authErr.Code)
	}
}

func TestResolveOpenAISourceContext_MainUIRequiresDirectPolicy(t *testing.T) {
	restore := setupMagiSourceTestConf()
	defer restore()

	claims := sourceKeyClaimsV1{
		Principal:     "main-ui-user",
		Channels:      []string{"guardian"},
		Models:        []string{"magi-"},
		InterfaceKind: "magi-main-ui",
		TrustBase:     "medium",
		RiskLevel:     "medium",
	}
	rawClaims, _ := json.Marshal(claims)
	key := "magi_sk_v1_" + base64.RawURLEncoding.EncodeToString(rawClaims)

	c := newTestGinContext()
	c.Request.Header.Set("X-MAGI-Source-Key", key)

	req := openai.ChatCompletionRequest{
		Model: "magi-trinity",
		User:  "principal:main-ui-user;interface:desktop-main;kind:magi-main-ui;conversation:conv-main",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	_, authErr := resolveOpenAISourceContext(c, &req)
	if authErr == nil {
		t.Fatal("expected main ui direct policy error")
	}
	if authErr.Code != "magi_main_ui_direct_required" {
		t.Fatalf("unexpected error code: %s", authErr.Code)
	}
}

func TestResolveClaudeSourceContext(t *testing.T) {
	restore := setupMagiSourceTestConf()
	defer restore()

	c := newTestGinContext()
	c.Request.Header.Set("X-MAGI-Source-Key", "magi.external-agent.avatar-a.siyuan-note-upstream")

	body := []byte(`{
		"model":"magi-trinity",
		"max_tokens":256,
		"system":"<request_source>{\"source\":\"external-agent\",\"callerId\":\"ext-1\"}</request_source>",
		"metadata":{"user_id":"principal:avatar-a;interface:panel-1;kind:siyuan-note-upstream"},
		"messages":[{"role":"user","content":[{"type":"text","text":"hello"}]}]
	}`)

	var req anthropic.MessagesRequest
	if err := json.Unmarshal(body, &req); err != nil {
		t.Fatalf("failed to decode request: %v", err)
	}

	sourceCtx, authErr := resolveClaudeSourceContext(c, &req, body)
	if authErr != nil {
		t.Fatalf("unexpected auth error: %v", authErr)
	}
	if sourceCtx.Channel != "external-agent" {
		t.Fatalf("unexpected channel: %s", sourceCtx.Channel)
	}
	if sourceCtx.DirectResponseAllowed {
		t.Fatal("external-agent request should not allow direct response")
	}
	if sourceCtx.CallerID != "ext-1" {
		t.Fatalf("unexpected callerID: %s", sourceCtx.CallerID)
	}
}

func setupMagiSourceTestConf() func() {
	oldConf := model.Conf
	model.Conf = model.NewAppConf()
	model.Conf.Api = &conf.API{Token: "workspace-token"}
	model.Conf.AI = conf.NewAI()
	model.Conf.AI.OpenAI.APIModel = "magi-trinity"
	return func() {
		model.Conf = oldConf
	}
}

func newTestGinContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/s-forge/magi/v1/chat/completions", nil)
	return c
}
