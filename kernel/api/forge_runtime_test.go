package api

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestForgeRuntimeShutdownRequiresAuthenticatedLoopbackSupervisor(t *testing.T) {
	previousMode := util.Mode
	previousToken := os.Getenv(util.ForgeSupervisorTokenEnv)
	previousClose := forgeRuntimeClose
	t.Cleanup(func() {
		util.Mode = previousMode
		_ = os.Setenv(util.ForgeSupervisorTokenEnv, previousToken)
		forgeRuntimeClose = previousClose
	})
	util.Mode = util.ModeForge
	_ = os.Setenv(util.ForgeSupervisorTokenEnv, "shutdown-token")

	called := make(chan struct{}, 1)
	forgeRuntimeClose = func(force, setCurrentWorkspace bool, execInstallPkg int) int {
		if force || setCurrentWorkspace || execInstallPkg != 1 {
			t.Errorf("unexpected close arguments: force=%v setCurrentWorkspace=%v execInstallPkg=%d", force, setCurrentWorkspace, execInstallPkg)
		}
		called <- struct{}{}
		return 0
	}

	invalidRequest := httptest.NewRequest(http.MethodPost, "/api/s-forge/forge/runtime/shutdown", nil)
	invalidRequest.RemoteAddr = "127.0.0.1:1234"
	invalidRecorder := httptest.NewRecorder()
	invalidContext, _ := gin.CreateTestContext(invalidRecorder)
	invalidContext.Request = invalidRequest
	forgeRuntimeShutdown(invalidContext)
	if invalidRecorder.Code != http.StatusForbidden {
		t.Fatalf("invalid request status = %d", invalidRecorder.Code)
	}

	validRequest := httptest.NewRequest(http.MethodPost, "/api/s-forge/forge/runtime/shutdown", nil)
	validRequest.RemoteAddr = "127.0.0.1:1234"
	validRequest.Header.Set(util.ForgeSupervisorTokenHeader, "shutdown-token")
	validRecorder := httptest.NewRecorder()
	validContext, _ := gin.CreateTestContext(validRecorder)
	validContext.Request = validRequest
	forgeRuntimeShutdown(validContext)
	if validRecorder.Code != http.StatusAccepted {
		t.Fatalf("valid request status = %d", validRecorder.Code)
	}

	select {
	case <-called:
	case <-time.After(time.Second):
		t.Fatal("valid supervisor request did not schedule graceful close")
	}
}
