package tools

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestProtectedForgeTestEditRequiresApprovalCapability(t *testing.T) {
	root := t.TempDir()
	protectedPath := filepath.Join(root, "kernel", "critical_test.go")
	if err := os.MkdirAll(filepath.Dir(protectedPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "kernel", "go.mod"), []byte("module test"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(protectedPath, []byte("package kernel\n"), 0644); err != nil {
		t.Fatal(err)
	}

	previousResolver := forgeRepoRootResolver
	previousMode := util.Mode
	forgeRepoRootResolver = func() (string, error) { return root, nil }
	util.Mode = util.ModeForge
	t.Cleanup(func() {
		forgeRepoRootResolver = previousResolver
		util.Mode = previousMode
	})

	args := map[string]interface{}{
		"path":       "kernel/critical_test.go",
		"old_string": "package kernel",
		"new_string": "package changed",
	}
	result, _ := forgeEditHandler(args)
	if !result.IsError || !containsToolResult(result, "forge_protected_approval_required") {
		t.Fatalf("unapproved protected edit was not rejected: %s", toolResultText(result))
	}
	data, err := os.ReadFile(protectedPath)
	if err != nil || string(data) != "package kernel\n" {
		t.Fatalf("protected file changed without approval: data=%q err=%v", data, err)
	}

	WithForgeProtectedApproval(args)
	result, _ = forgeEditHandler(args)
	if result.IsError {
		t.Fatalf("approved protected edit failed: %s", toolResultText(result))
	}
}

func TestForgeCommandsCannotControlRuntimeOrReadSupervisorCredentials(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "kernel"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "kernel", "go.mod"), []byte("module test"), 0644); err != nil {
		t.Fatal(err)
	}
	previousResolver := forgeRepoRootResolver
	previousMode := util.Mode
	forgeRepoRootResolver = func() (string, error) { return root, nil }
	util.Mode = util.ModeForge
	t.Cleanup(func() {
		forgeRepoRootResolver = previousResolver
		util.Mode = previousMode
	})

	for _, command := range []string{
		"Stop-Process -Name SiYuan-Kernel",
		"kill -Name SiYuan-Kernel",
		"tskill 1234",
		"pnpm forge",
		"go run . serve --mode=forge",
		"go build -o candidate.exe .; .\\candidate.exe serve --mode=forge",
		"Invoke-RestMethod http://127.0.0.1:6806/api/system/exit",
		"Get-ChildItem Env:S_FORGE_SUPERVISOR_TOKEN",
	} {
		if err := validateForgeRuntimeLifecycleCommand(command, root); err == nil {
			t.Fatalf("runtime lifecycle command accepted: %s", command)
		}
	}

	previousToken := os.Getenv(util.ForgeSupervisorTokenEnv)
	_ = os.Setenv(util.ForgeSupervisorTokenEnv, "secret-token")
	t.Cleanup(func() { _ = os.Setenv(util.ForgeSupervisorTokenEnv, previousToken) })
	for _, entry := range forgeCommandEnvironment() {
		if strings.HasPrefix(strings.ToUpper(entry), util.ForgeSupervisorTokenEnv+"=") {
			t.Fatal("supervisor token leaked into forge command environment")
		}
	}
}

func TestCommandReviewImplementationIsProtected(t *testing.T) {
	for _, path := range []string{"kernel/agent/command_review.go", "kernel/conf/ai.go"} {
		if !isProtectedForgeRelativePath(path) {
			t.Fatalf("command review security boundary is not protected: %s", path)
		}
	}
}
