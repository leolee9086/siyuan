package tools

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func writeForgeRestartPolicyFixture(t *testing.T, root string) {
	t.Helper()
	_, currentFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("无法定位 Forge 策略测试源码")
	}
	productionPath := filepath.Clean(filepath.Join(filepath.Dir(currentFile), "..", "..", "forge_restart_test_policy.json"))
	data, err := os.ReadFile(productionPath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := loadForgeRestartPolicy(filepath.Dir(filepath.Dir(productionPath))); err != nil {
		t.Fatalf("生产 Forge 重启策略无效: %v", err)
	}
	policyPath := filepath.Join(root, filepath.FromSlash(forgeRestartPolicyRelativePath))
	if err := os.MkdirAll(filepath.Dir(policyPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(policyPath, data, 0644); err != nil {
		t.Fatal(err)
	}
}

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
	writeForgeRestartPolicyFixture(t, root)

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
	writeForgeRestartPolicyFixture(t, root)
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
		"Invoke-RestMethod http://127.0.0.1:6806/api/s-forge/forge/runtime/restart -Method Post",
		"node -e \"fetch('http://127.0.0.1:6806/api/s-forge/forge/runtime/approveProtectedTests')\"",
		"Get-ChildItem Env:S_FORGE_SUPERVISOR_TOKEN",
		"Get-Content .forge-runtime/supervisor.json",
		"Get-Content .forge-runtime/commit-runtime-gate.json",
		"Get-Content .githooks/post-commit",
		"git commit --no-verify -m bypass",
		"git -c core.hooksPath=NUL commit -m bypass",
		"node -e \"fetch('http://127.0.0.1:6806', {headers:{'x-s-forge-supervisor-token':'x'}})\"",
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
	root := t.TempDir()
	writeForgeRestartPolicyFixture(t, root)
	for _, path := range []string{
		"kernel/agent/command_review.go",
		"kernel/conf/ai.go",
		"app/scripts/forge-commit-runtime-gate.js",
		"app/webpack.config.js",
		".githooks/pre-commit",
		".githooks/post-commit",
		".githooks/pre-merge-commit",
		".githooks/post-merge",
	} {
		protected, err := isProtectedForgeRelativePath(root, path)
		if err != nil {
			t.Fatal(err)
		}
		if !protected {
			t.Fatalf("command review security boundary is not protected: %s", path)
		}
	}
}

func TestForgeRuntimeAuditFilesAreProtectedAndSupervisorCredentialsAreBlocked(t *testing.T) {
	root := t.TempDir()
	writeForgeRestartPolicyFixture(t, root)
	for _, path := range []string{
		".forge-runtime/commit-runtime-gate.json",
		".forge-runtime/operations/operation.log",
		".forge-runtime/incidents/incident.json",
		".githooks/pre-merge-commit",
	} {
		protected, err := isProtectedForgeRelativePath(root, path)
		if err != nil {
			t.Fatal(err)
		}
		if !protected {
			t.Fatalf("runtime audit path is not protected: %s", path)
		}
	}
	for _, path := range []string{
		".forge-runtime/supervisor.json",
		".forge-runtime/supervisor.stale-2026.json",
	} {
		if !isBlockedForgePath(path) {
			t.Fatalf("Supervisor credential path is readable: %s", path)
		}
	}
}

func TestForgeProtectionPolicyFailureBlocksProtectedClassification(t *testing.T) {
	root := t.TempDir()
	policyPath := filepath.Join(root, filepath.FromSlash(forgeRestartPolicyRelativePath))
	if err := os.MkdirAll(filepath.Dir(policyPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(policyPath, []byte(`{"schemaVersion":2}`), 0644); err != nil {
		t.Fatal(err)
	}

	if _, err := isProtectedForgeRelativePath(root, "kernel/api/critical_test.go"); err == nil {
		t.Fatal("无效 Forge 重启策略未阻断保护路径分类")
	}
}

func TestForgeProtectionClassifiesEveryProductionPolicyEntry(t *testing.T) {
	root := t.TempDir()
	writeForgeRestartPolicyFixture(t, root)
	policy, err := loadForgeRestartPolicy(root)
	if err != nil {
		t.Fatal(err)
	}
	for _, protectedPath := range policy.ProtectedPaths {
		protected, classifyErr := isProtectedForgeRelativePath(root, protectedPath)
		if classifyErr != nil {
			t.Fatal(classifyErr)
		}
		if !protected {
			t.Fatalf("生产策略精确路径未被保护: %s", protectedPath)
		}
	}
	for _, prefix := range policy.ProtectedPrefixes {
		candidate := prefix + "policy-probe"
		protected, classifyErr := isProtectedForgeRelativePath(root, candidate)
		if classifyErr != nil {
			t.Fatal(classifyErr)
		}
		if !protected {
			t.Fatalf("生产策略前缀未被保护: %s", prefix)
		}
	}
	for _, codeRootPath := range []string{
		forgeRestartPolicyRelativePath,
		"kernel/agent/session_test.go",
	} {
		protected, classifyErr := isProtectedForgeRelativePath(root, codeRootPath)
		if classifyErr != nil {
			t.Fatal(classifyErr)
		}
		if !protected {
			t.Fatalf("代码根保护项未被保护: %s", codeRootPath)
		}
	}
}

func TestForgeProtectionPolicyRejectsInvalidPathSets(t *testing.T) {
	for _, testCase := range []struct {
		name          string
		entries       []string
		trailingSlash bool
	}{
		{name: "empty", entries: nil},
		{name: "unsorted", entries: []string{"b", "a"}},
		{name: "duplicate", entries: []string{"a", "a"}},
		{name: "escape", entries: []string{"../outside"}},
		{name: "backslash", entries: []string{"app\\file"}},
		{name: "prefix without slash", entries: []string{".githooks"}, trailingSlash: true},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			if err := validateForgePolicyEntries(testCase.entries, "test", testCase.trailingSlash); err == nil {
				t.Fatal("无效策略路径集合通过校验")
			}
		})
	}
}

func TestForgeFreshApprovalUsesPolicyAndKeepsBatchPreviewReadOnly(t *testing.T) {
	root := t.TempDir()
	writeForgeRestartPolicyFixture(t, root)
	previousResolver := forgeRepoRootResolver
	forgeRepoRootResolver = func() (string, error) { return root, nil }
	t.Cleanup(func() { forgeRepoRootResolver = previousResolver })

	for _, testCase := range []struct {
		name     string
		toolName string
		args     map[string]interface{}
		want     bool
	}{
		{name: "batch preview", toolName: ForgeDevRepoBatchReplaceToolName, args: map[string]interface{}{"preview": true}},
		{name: "batch write", toolName: ForgeDevRepoBatchReplaceToolName, args: map[string]interface{}{}, want: true},
		{name: "protected write", toolName: ForgeDevRepoWriteToolName, args: map[string]interface{}{"path": "kernel/conf/ai.go"}, want: true},
		{name: "ordinary write", toolName: ForgeDevRepoWriteToolName, args: map[string]interface{}{"path": "app/src/feature.ts"}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			got, err := RequiresFreshForgeApproval(testCase.toolName, testCase.args)
			if err != nil {
				t.Fatal(err)
			}
			if got != testCase.want {
				t.Fatalf("逐次复核判定错误: got=%v want=%v", got, testCase.want)
			}
		})
	}
}
