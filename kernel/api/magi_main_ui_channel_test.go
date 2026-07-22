package api

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestMagiMainUIChannelHistoryIsContinuousAndIdentityIsolated(t *testing.T) {
	store, err := channel.OpenMessageStore(filepath.Join(t.TempDir(), "main-ui.db"))
	if err != nil {
		t.Fatalf("open message store: %v", err)
	}
	defer store.Close()

	identityA := newMagiMainUITestSource("identity-a", "Alice")
	identityB := newMagiMainUITestSource("identity-b", "Bob")
	request := &openai.ChatCompletionRequest{Messages: []openai.ChatCompletionMessage{
		{Role: openai.ChatMessageRoleUser, Content: "first question"},
	}}
	if err = saveMagiMainUIInbound(context.Background(), store, request, identityA); err != nil {
		t.Fatalf("save identity A inbound: %v", err)
	}
	if err = saveMagiMainUIOutbound(context.Background(), store, &types.Message{Content: "first answer"}, identityA); err != nil {
		t.Fatalf("save identity A outbound: %v", err)
	}
	request.Messages[0].Content = "private question"
	if err = saveMagiMainUIInbound(context.Background(), store, request, identityB); err != nil {
		t.Fatalf("save identity B inbound: %v", err)
	}

	history, err := queryMagiMainUIHistory(context.Background(), store, identityA, 0, 100)
	if err != nil {
		t.Fatalf("query identity A history: %v", err)
	}
	if history.ConversationID != magiMainUIConversationID("identity-a") {
		t.Fatalf("unexpected conversation id: %s", history.ConversationID)
	}
	if len(history.Messages) != 2 {
		t.Fatalf("expected one continuous turn, got %d messages", len(history.Messages))
	}
	if history.Messages[0].Role != openai.ChatMessageRoleUser || history.Messages[0].Content != "first question" {
		t.Fatalf("history is not chronological: %+v", history.Messages)
	}
	if history.Messages[1].Role != openai.ChatMessageRoleAssistant || history.Messages[1].Content != "first answer" {
		t.Fatalf("history is not chronological: %+v", history.Messages)
	}
}

func TestAuthorizeMagiMainUIHistoryRejectsNonGuardianIdentity(t *testing.T) {
	sourceCtx := newMagiMainUITestSource("identity-a", "Alice")
	sourceCtx.Channel = types.SourceChannelExternalAgent
	sourceCtx.DirectResponseAllowed = false

	authErr := authorizeMagiMainUIHistory(sourceCtx)
	if authErr == nil {
		t.Fatal("expected non-Guardian identity to be rejected")
	}
	if authErr.StatusCode != http.StatusForbidden || authErr.Code != "magi_main_ui_history_forbidden" {
		t.Fatalf("unexpected authorization error: %+v", authErr)
	}
}

func TestMagiMainUIHistoryRejectsAvatarOnlyIdentityWithForbidden(t *testing.T) {
	cleanup := setupMagiSourceTestConf(t)
	defer cleanup()

	token := issueTestArmorToken(t, "avatar-only", magiRouteClassAvatarOnly, magiRequestChannelMainUI)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost,
		"https://localhost/api/s-forge/magi/v1/main-ui/history", strings.NewReader(`{"limit":20}`))
	request.Header.Set("Authorization", "Bearer "+token)
	request.Header.Set("Content-Type", "application/json")
	gin.SetMode(gin.TestMode)
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request

	magiMainUIHistory(context)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"magi_main_ui_history_forbidden"`) {
		t.Fatalf("unexpected authorization response: %s", recorder.Body.String())
	}
}

func newMagiMainUITestSource(identityID, nickname string) *types.RequestSourceContext {
	return &types.RequestSourceContext{
		Channel: types.SourceChannelGuardian, PrincipalID: identityID, IdentityID: identityID,
		Nickname: nickname, InterfaceID: magiMainUIChannelID, InterfaceKind: magiMainUIChannelID,
		ConversationID: magiMainUIConversationID(identityID), DirectResponseAllowed: true,
	}
}
