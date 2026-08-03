package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func newRuntimeMonitorHistoryContext(body string, authHeader string) (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(
		http.MethodPost,
		"https://localhost/api/s-forge/magi/v1/runtime/monitor/history",
		strings.NewReader(body),
	)
	request.Header.Set("Content-Type", "application/json")
	if authHeader != "" {
		request.Header.Set("Authorization", authHeader)
	}
	context, _ := gin.CreateTestContext(recorder)
	context.Request = request
	return context, recorder
}

func TestMagiRuntimeMonitorHistoryRequiresArmorToken(t *testing.T) {
	cleanup := setupMagiSourceTestConf(t)
	defer cleanup()

	context, recorder := newRuntimeMonitorHistoryContext(`{"afterSeq":0}`, "Bearer workspace-token")

	magiRuntimeMonitorHistory(context)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"magi_armor_invalid"`) {
		t.Fatalf("unexpected authorization response: %s", recorder.Body.String())
	}
}

func TestMagiRuntimeMonitorHistoryAllowsGuardianMainUIArmorToken(t *testing.T) {
	cleanup := setupMagiSourceTestConf(t)
	defer cleanup()

	token := issueTestArmorToken(t, "history-guardian", magiRouteClassGuardian, magiRequestChannelMainUI)
	context, recorder := newRuntimeMonitorHistoryContext(`{"afterSeq":0}`, "Bearer "+token)

	magiRuntimeMonitorHistory(context)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"events"`) {
		t.Fatalf("expected history response, got: %s", recorder.Body.String())
	}
}

func TestMagiRuntimeMonitorHistoryRejectsAvatarOnlyArmorToken(t *testing.T) {
	cleanup := setupMagiSourceTestConf(t)
	defer cleanup()

	token := issueTestArmorToken(t, "history-avatar", magiRouteClassAvatarOnly, magiRequestChannelMainUI)
	context, recorder := newRuntimeMonitorHistoryContext(`{"afterSeq":0}`, "Bearer "+token)

	magiRuntimeMonitorHistory(context)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if !strings.Contains(recorder.Body.String(), `"code":"magi_main_ui_history_forbidden"`) {
		t.Fatalf("unexpected authorization response: %s", recorder.Body.String())
	}
}
