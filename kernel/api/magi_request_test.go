package api

import (
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/session"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestExtractClaimedRecentHistory_TrimsAndSkipsTransportMessages(t *testing.T) {
	messages := []openai.ChatCompletionMessage{
		{
			Role:    openai.ChatMessageRoleSystem,
			Content: `<magi_request_source>{"source":"guardian","requestId":"req-1"}</magi_request_source>`,
		},
		{Role: openai.ChatMessageRoleUser, Content: "第1条"},
		{Role: openai.ChatMessageRoleAssistant, Content: "第2条"},
		{Role: openai.ChatMessageRoleUser, Content: "第3条"},
		{Role: openai.ChatMessageRoleAssistant, Content: "第4条"},
		{Role: openai.ChatMessageRoleUser, Content: "第5条"},
		{Role: openai.ChatMessageRoleAssistant, Content: "第6条"},
		{Role: openai.ChatMessageRoleUser, Content: "第7条"},
		{Role: openai.ChatMessageRoleAssistant, Content: "第8条"},
		{Role: openai.ChatMessageRoleUser, Content: "第9条"},
	}

	got := extractClaimedRecentHistory(messages)
	if len(got) != maxClaimedRecentHistory {
		t.Fatalf("expected %d history items, got %d", maxClaimedRecentHistory, len(got))
	}
	if got[0].Content != "第2条" {
		t.Fatalf("expected oldest kept item to be 第2条, got %s", got[0].Content)
	}
	if got[len(got)-1].Content != "第9条" {
		t.Fatalf("expected latest kept item to be 第9条, got %s", got[len(got)-1].Content)
	}
	for _, item := range got {
		if item.Role == openai.ChatMessageRoleSystem {
			t.Fatalf("transport system message should not leak into claimed history: %+v", item)
		}
	}
}

func TestGetOrCreateSession_UsesDeterministicSourceSessionKeyWithoutHeader(t *testing.T) {
	oldMgr := magiSessionMgr
	isolateMagiSourceSID(t)
	defer func() {
		magiSessionMgr = oldMgr
	}()

	magiSessionMgr = session.NewSessionManager(time.Minute)

	sourceCtx := &types.RequestSourceContext{
		PrincipalID:      "principal-a",
		SourceSessionKey: "guardian:principal-a:main-1:conv-1",
	}

	firstContext := newTestGinContext()
	firstSessionID := getOrCreateSession(firstContext, sourceCtx)
	expectedSessionID := buildDeterministicMagiMonitorSessionID(sourceCtx.SourceSessionKey)
	if firstSessionID != expectedSessionID {
		t.Fatalf("expected deterministic session id %s, got %s", expectedSessionID, firstSessionID)
	}

	secondContext := newTestGinContext()
	secondSessionID := getOrCreateSession(secondContext, sourceCtx)
	if secondSessionID != firstSessionID {
		t.Fatalf("expected reused session id %s, got %s", firstSessionID, secondSessionID)
	}
}

func TestGetOrCreateSession_IgnoresLegacySessionHeader(t *testing.T) {
	oldMgr := magiSessionMgr
	isolateMagiSourceSID(t)
	defer func() {
		magiSessionMgr = oldMgr
	}()

	magiSessionMgr = session.NewSessionManager(time.Minute)

	sourceCtx := &types.RequestSourceContext{
		PrincipalID:      "principal-a",
		SourceSessionKey: "guardian:principal-a:main-1:conv-1",
	}

	contextWithLegacyHeader := newTestGinContext()
	contextWithLegacyHeader.Request.Header.Set("X-MAGI-Session-ID", "legacy-session-123")

	sessionID := getOrCreateSession(contextWithLegacyHeader, sourceCtx)
	expectedSessionID := buildDeterministicMagiMonitorSessionID(sourceCtx.SourceSessionKey)
	if sessionID != expectedSessionID {
		t.Fatalf("expected deterministic session id %s, got %s", expectedSessionID, sessionID)
	}
	if sessionID == "legacy-session-123" {
		t.Fatalf("legacy session header should be ignored, got %s", sessionID)
	}
}

func TestGetOrCreateSession_ReturnsEmptyWhenSessionManagerUnavailable(t *testing.T) {
	oldMgr := magiSessionMgr
	isolateMagiSourceSID(t)
	defer func() {
		magiSessionMgr = oldMgr
	}()

	magiSessionMgr = nil

	sessionID := getOrCreateSession(newTestGinContext(), &types.RequestSourceContext{
		PrincipalID:      "principal-a",
		SourceSessionKey: "guardian:principal-a:main-1:conv-1",
	})
	if sessionID != "" {
		t.Fatalf("expected empty session id when session manager is unavailable, got %s", sessionID)
	}
}

func isolateMagiSourceSID(t *testing.T) {
	t.Helper()
	type entry struct {
		key   interface{}
		value interface{}
	}
	var snapshot []entry
	magiSourceSID.Range(func(key, value interface{}) bool {
		snapshot = append(snapshot, entry{key: key, value: value})
		return true
	})
	magiSourceSID.Clear()
	t.Cleanup(func() {
		magiSourceSID.Clear()
		for _, item := range snapshot {
			magiSourceSID.Store(item.key, item.value)
		}
	})
}

func TestSubmitMagiTask_ReturnsInitErrorBeforeSessionLookup(t *testing.T) {
	oldInitErr := magiInitErr
	oldMgr := magiSessionMgr
	defer func() {
		magiInitErr = oldInitErr
		magiSessionMgr = oldMgr
	}()

	magiInitErr = errors.New("persona profile incomplete")
	magiSessionMgr = nil

	_, err := submitMagiTask(newTestGinContext(), openai.ChatCompletionRequest{
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleUser, Content: "现在感觉如何?"},
		},
	}, &types.RequestSourceContext{})
	if err == nil {
		t.Fatal("expected init error, got nil")
	}
	if !strings.Contains(err.Error(), "MAGI system not initialized: persona profile incomplete") {
		t.Fatalf("unexpected error: %v", err)
	}
}
