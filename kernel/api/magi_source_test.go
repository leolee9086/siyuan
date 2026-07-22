package api

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestResolveOpenAISourceContext_DirectAllowed(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	token := issueTestArmorToken(t, "guardian-main", magiRouteClassGuardian, magiRequestChannelMainUI)

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer "+token)

	req := openai.ChatCompletionRequest{
		Model: "magi-default",
		User:  "principal:guardian-main;interface:desktop-main;kind:magi-main-ui;conversation:conv-1",
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
	if sourceCtx.IdentityID != "guardian-main" {
		t.Fatalf("unexpected identityID: %s", sourceCtx.IdentityID)
	}
	if sourceCtx.Nickname != "tester" {
		t.Fatalf("unexpected nickname: %s", sourceCtx.Nickname)
	}
	if sourceCtx.InterfaceID != magiMainUIChannelID || sourceCtx.InterfaceKind != magiMainUIChannelID {
		t.Fatalf("main UI source must use the built-in channel identity: %+v", sourceCtx)
	}
	if sourceCtx.ConversationID != magiMainUIConversationID("guardian-main") {
		t.Fatalf("main UI conversation must be derived from verified identity: %s", sourceCtx.ConversationID)
	}
	if strings.Contains(sourceCtx.SourceSessionKey, "desktop-main") || strings.Contains(sourceCtx.SourceSessionKey, "conv-1") {
		t.Fatalf("client panel identity leaked into the continuous source key: %s", sourceCtx.SourceSessionKey)
	}
}

func TestResolveOpenAISourceContext_NonMainChannelNoDirect(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	token := issueTestArmorToken(t, "guardian-main", magiRouteClassGuardian, magiRequestChannelToolClaude)

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer "+token)

	req := openai.ChatCompletionRequest{
		Model: "magi-coding",
		User:  "principal:guardian-main;interface:note-main;kind:tool-claude-code",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	sourceCtx, authErr := resolveOpenAISourceContext(c, &req)
	if authErr != nil {
		t.Fatalf("unexpected auth error: %v", authErr)
	}
	if sourceCtx.DirectResponseAllowed {
		t.Fatal("non-main channel should not allow direct response")
	}
	if sourceCtx.Channel != "external-agent" {
		t.Fatalf("unexpected channel: %s", sourceCtx.Channel)
	}
}

func TestResolveOpenAISourceContext_InvalidArmor(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer wrong-token")

	req := openai.ChatCompletionRequest{
		Model: "magi-default",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	_, authErr := resolveOpenAISourceContext(c, &req)
	if authErr == nil {
		t.Fatal("expected auth error for invalid armor token")
	}
	if authErr.Code != "magi_armor_invalid" {
		t.Fatalf("unexpected error code: %s", authErr.Code)
	}
}

func TestResolveOpenAISourceContext_LegacySourceHeaderNoLongerWorks(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	c := newTestGinContext()
	c.Request.Header.Set("X-MAGI-Source-Key", "workspace-token")

	req := openai.ChatCompletionRequest{
		Model: "magi-default",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	_, authErr := resolveOpenAISourceContext(c, &req)
	if authErr == nil {
		t.Fatal("expected auth error when armor token is missing")
	}
	if authErr.Code != "magi_armor_missing" {
		t.Fatalf("unexpected error code: %s", authErr.Code)
	}
}

func TestResolveOpenAISourceContext_ChannelForbiddenByClaims(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	token := issueTestArmorToken(t, "family-user", magiRouteClassGuardian, magiRequestChannelToolCustom)

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer "+token)

	req := openai.ChatCompletionRequest{
		Model: "magi-default",
		User:  "principal:family-user;interface:panel-1;kind:tool-custom",
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
	if authErr.Code != "magi_channel_mismatch" {
		t.Fatalf("unexpected error code: %s", authErr.Code)
	}
}

func TestResolveOpenAISourceContext_MainUIAvatarOnlyAllowedButNoDirect(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	token := issueTestArmorToken(t, "family-user", magiRouteClassAvatarOnly, magiRequestChannelMainUI)

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer "+token)

	req := openai.ChatCompletionRequest{
		Model: "magi-default",
		User:  "principal:family-user;interface:desktop-main;kind:magi-main-ui;conversation:conv-main",
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "hello"},
		},
	}

	sourceCtx, authErr := resolveOpenAISourceContext(c, &req)
	if authErr != nil {
		t.Fatalf("unexpected auth error: %v", authErr)
	}
	if sourceCtx.DirectResponseAllowed {
		t.Fatal("avatar-only main-ui request must not allow direct response")
	}
}

func TestResolveClaudeSourceContext_WithArmor(t *testing.T) {
	restore := setupMagiSourceTestConf(t)
	defer restore()

	token := issueTestArmorToken(t, "tool-user", magiRouteClassAvatarOnly, magiRequestChannelToolClaude)

	c := newTestGinContext()
	c.Request.Header.Set("Authorization", "Bearer "+token)

	body := []byte(`{
		"model":"magi-review",
		"max_tokens":256,
		"system":"<request_source>{\"source\":\"external-agent\",\"callerId\":\"ext-1\"}</request_source>",
		"metadata":{"user_id":"principal:tool-user;interface:panel-1;kind:tool-claude-code"},
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
		t.Fatal("tool request should not allow direct response")
	}
	if sourceCtx.CallerID != "ext-1" {
		t.Fatalf("unexpected callerID: %s", sourceCtx.CallerID)
	}
}

func setupMagiSourceTestConf(t *testing.T) func() {
	t.Helper()

	oldConf := model.Conf
	oldConfDir := util.ConfDir
	oldStore := globalMagiIdentityStore

	tempDir := t.TempDir()
	util.ConfDir = tempDir

	model.Conf = model.NewAppConf()
	model.Conf.Api = &conf.API{Token: "workspace-token"}
	model.Conf.AI = conf.NewAI()
	model.Conf.AI.OpenAI.APIModel = "magi-default"

	globalMagiIdentityStore = &magiIdentityStore{}

	return func() {
		globalMagiIdentityStore = oldStore
		util.ConfDir = oldConfDir
		model.Conf = oldConf
	}
}

func issueTestArmorToken(
	t *testing.T,
	identityID string,
	routeClass string,
	channel string,
) string {
	t.Helper()

	_, err := globalMagiIdentityStore.upsert(
		identityID,
		identityID,
		"tester",
		"pass123456",
		routeClass,
		true,
		0,
		nil,
	)
	if err != nil {
		t.Fatalf("failed to upsert identity: %v", err)
	}
	now := time.Now().Unix()
	token, signErr := signMagiArmorToken(magiArmorClaimsV1{
		Sub: identityID,
		Chn: channel,
		Ws:  magiWorkspaceBinding(),
		Rtc: routeClass,
		Nck: "tester",
		Iat: now,
		Exp: now + 600,
		Jti: "test-jti-" + identityID,
	})
	if signErr != nil {
		t.Fatalf("failed to issue token: %v", signErr)
	}
	return token
}

func newTestGinContext() *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/api/s-forge/magi/v1/chat/completions", nil)
	return c
}
