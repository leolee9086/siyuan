package tools

import (
	"errors"
	"path/filepath"
	"strings"
)

const forgeProtectedApprovalArg = "_forgeProtectedApproval"

type forgeProtectedApproval struct{}

var forgeProtectedInfrastructurePaths = map[string]bool{
	"app/package.json":                        true,
	"app/scripts/forge-start.js":              true,
	"app/scripts/forge-runtime-supervisor.js": true,
	"kernel/agent/agent.go":                   true,
	"kernel/agent/command_review.go":          true,
	"kernel/agent/tools.go":                   true,
	"kernel/api/forge_runtime.go":             true,
	"kernel/conf/ai.go":                       true,
	"kernel/mcp/tools/forge.go":               true,
	"kernel/mcp/tools/forge_protection.go":    true,
	"kernel/mcp/tools/forge_runtime.go":       true,
	"kernel/util/forge_supervisor.go":         true,
	"kernel/forge_restart_test_policy.json":   true,
}

// WithForgeProtectedApproval 注入仅由原生 Agent 本次人工复核产生的进程内 capability。
func WithForgeProtectedApproval(args map[string]interface{}) {
	args[forgeProtectedApprovalArg] = forgeProtectedApproval{}
}

// RequiresFreshForgeApproval 判断工具参数是否可能修改核心测试或重启门禁实现。
func RequiresFreshForgeApproval(toolName string, args map[string]interface{}) bool {
	switch strings.TrimSpace(toolName) {
	case ForgeDevRepoBashToolName:
		return true
	case ForgeDevRepoWriteToolName, ForgeDevRepoDeleteToolName, ForgeDevRepoEditToolName:
		return isProtectedForgeRelativePath(stringArg(args, "path", ""))
	case ForgeDevRepoGitToolName:
		if strings.ToLower(stringArg(args, "action", "")) != "commit" {
			return false
		}
		paths, err := forgePathsArg(args["paths"])
		if err != nil {
			return true
		}
		for _, path := range paths {
			if isProtectedForgeRelativePath(path) {
				return true
			}
		}
	}
	return false
}

func requireProtectedForgeApproval(args map[string]interface{}, root string, targets ...string) error {
	forgeRoot, err := ForgeDevRepoRoot()
	if err != nil {
		return nil
	}
	for _, target := range targets {
		if !sameOrSubForgePath(forgeRoot, target) {
			continue
		}
		relative := relativeForgePath(forgeRoot, target)
		if !isProtectedForgeRelativePath(relative) {
			continue
		}
		if _, approved := args[forgeProtectedApprovalArg].(forgeProtectedApproval); !approved {
			return errors.New("forge_protected_approval_required: 核心测试与 Forge 重启门禁文件必须经过本次人工复核，拒绝未授权修改")
		}
	}
	return nil
}

func requireForgeCommandApproval(args map[string]interface{}, root string) error {
	if !isForgeSourceCommandRoot(root) {
		return nil
	}
	if _, approved := args[forgeProtectedApprovalArg].(forgeProtectedApproval); !approved {
		return errors.New("源码命令可能修改核心测试或重启门禁，必须经过本次人工复核")
	}
	return nil
}

func isForgeSourceCommandRoot(root string) bool {
	forgeRoot, err := ForgeDevRepoRoot()
	return err == nil && sameOrSubForgePath(forgeRoot, root)
}

func isProtectedForgeRelativePath(path string) bool {
	normalized := strings.ToLower(strings.TrimPrefix(filepath.ToSlash(filepath.Clean(path)), "./"))
	if forgeProtectedInfrastructurePaths[normalized] {
		return true
	}
	return strings.HasPrefix(normalized, "kernel/") && strings.HasSuffix(strings.ToLower(normalized), "_test.go")
}
