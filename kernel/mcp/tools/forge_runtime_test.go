package tools

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestForgeRuntimeRestartRequiresInProcessApproval(t *testing.T) {
	result, _ := forgeRuntimeRestartHandler(map[string]interface{}{"reason": "verified change"})
	if !result.IsError || !containsToolResult(result, "逐次人工复核") {
		t.Fatalf("direct restart call was not rejected: %s", toolResultText(result))
	}
}

func TestForgeRuntimeProtectedTestApprovalRequiresInProcessApproval(t *testing.T) {
	result, _ := forgeRuntimeApproveTestsHandler(map[string]interface{}{"jobId": "job-1", "revision": "rev-1"})
	if !result.IsError || !containsToolResult(result, "逐次人工复核") {
		t.Fatalf("direct protected test approval was not rejected: %s", toolResultText(result))
	}
}

func TestForgeRuntimeToolsUseAuthenticatedSupervisor(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "kernel"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "kernel", "go.mod"), []byte("module test"), 0644); err != nil {
		t.Fatal(err)
	}

	const token = "supervisor-test-token"
	requests := make(chan string, 3)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get(util.ForgeSupervisorTokenHeader) != token {
			t.Errorf("missing supervisor token")
		}
		requests <- r.Method + " " + r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path == "/restart" {
			w.WriteHeader(http.StatusAccepted)
			_, _ = w.Write([]byte(`{"job":{"id":"job-1","state":"queued"}}`))
			return
		}
		if r.URL.Path == "/approve-protected-tests" {
			_, _ = w.Write([]byte(`{"approval":{"jobId":"job-1","state":"approved"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"mode":"forge-source-supervisor"}`))
	}))
	t.Cleanup(server.Close)

	previousResolver := forgeRepoRootResolver
	previousMode := util.Mode
	previousURL := os.Getenv(util.ForgeSupervisorURLEnv)
	previousToken := os.Getenv(util.ForgeSupervisorTokenEnv)
	previousRoot := os.Getenv(util.ForgeSupervisorRootEnv)
	forgeRepoRootResolver = func() (string, error) { return root, nil }
	util.Mode = util.ModeForge
	_ = os.Setenv(util.ForgeSupervisorURLEnv, server.URL)
	_ = os.Setenv(util.ForgeSupervisorTokenEnv, token)
	_ = os.Setenv(util.ForgeSupervisorRootEnv, root)
	t.Cleanup(func() {
		forgeRepoRootResolver = previousResolver
		util.Mode = previousMode
		_ = os.Setenv(util.ForgeSupervisorURLEnv, previousURL)
		_ = os.Setenv(util.ForgeSupervisorTokenEnv, previousToken)
		_ = os.Setenv(util.ForgeSupervisorRootEnv, previousRoot)
	})

	status, _ := forgeRuntimeStatusHandler(nil)
	if status.IsError || !containsToolResult(status, "forge-source-supervisor") {
		t.Fatalf("status failed: %s", toolResultText(status))
	}
	restartArgs := map[string]interface{}{"reason": "verified change"}
	WithForgeRuntimeApproval(restartArgs)
	restart, _ := forgeRuntimeRestartHandler(restartArgs)
	if restart.IsError || !containsToolResult(restart, "job-1") {
		t.Fatalf("restart failed: %s", toolResultText(restart))
	}
	approvalArgs := map[string]interface{}{"jobId": "job-1", "revision": "rev-1"}
	WithForgeRuntimeApproval(approvalArgs)
	approval, _ := forgeRuntimeApproveTestsHandler(approvalArgs)
	if approval.IsError || !containsToolResult(approval, "approved") {
		t.Fatalf("protected test approval failed: %s", toolResultText(approval))
	}

	if got := <-requests; got != "GET /status" {
		t.Fatalf("unexpected status request: %s", got)
	}
	if got := <-requests; !strings.HasPrefix(got, "POST /restart") {
		t.Fatalf("unexpected restart request: %s", got)
	}
	if got := <-requests; !strings.HasPrefix(got, "POST /approve-protected-tests") {
		t.Fatalf("unexpected approval request: %s", got)
	}
}
