package tools

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	pathpkg "path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

const forgeProtectedApprovalArg = "_forgeProtectedApproval"

type forgeProtectedApproval struct{}

const forgeRestartPolicyRelativePath = "kernel/forge_restart_test_policy.json"

var requiredForgeCoreTestCommand = []string{"go", "test", "-short", "-tags", "fts5", "./..."}

type forgeRestartPolicy struct {
	SchemaVersion     int      `json:"schemaVersion"`
	Scope             string   `json:"scope"`
	Command           []string `json:"command"`
	ProtectedPaths    []string `json:"protectedPaths"`
	ProtectedPrefixes []string `json:"protectedPrefixes"`
	CoreDefinition    string   `json:"coreDefinition"`
}

type forgeRestartPolicyRegistry struct {
	mu       sync.Mutex
	policies map[string]forgeRestartPolicy
}

var activeForgeRestartPolicies = forgeRestartPolicyRegistry{
	policies: map[string]forgeRestartPolicy{},
}

// WithForgeProtectedApproval 注入仅由原生 Agent 本次人工复核产生的进程内 capability。
func WithForgeProtectedApproval(args map[string]interface{}) {
	args[forgeProtectedApprovalArg] = forgeProtectedApproval{}
}

// RequiresFreshForgeApproval 判断工具参数是否可能修改核心测试或重启门禁实现。
func RequiresFreshForgeApproval(toolName string, args map[string]interface{}) (bool, error) {
	switch strings.TrimSpace(toolName) {
	case ForgeDevRepoBashToolName:
		root, err := repositoryToolRoot(args)
		if err != nil {
			return true, err
		}
		_, err = activeForgeRestartPolicy(root)
		return true, err
	case ForgeDevRepoBatchReplaceToolName:
		if preview, _ := args["preview"].(bool); preview {
			return false, nil
		}
		root, err := repositoryToolRoot(args)
		if err != nil {
			return true, err
		}
		_, err = activeForgeRestartPolicy(root)
		return true, err
	case ForgeDevRepoWriteToolName, ForgeDevRepoDeleteToolName, ForgeDevRepoEditToolName:
		root, err := repositoryToolRoot(args)
		if err != nil {
			return true, err
		}
		return isProtectedForgeRelativePath(root, stringArg(args, "path", ""))
	case ForgeDevRepoGitToolName:
		if strings.ToLower(stringArg(args, "action", "")) != "commit" {
			return false, nil
		}
		root, err := repositoryToolRoot(args)
		if err != nil {
			return true, err
		}
		paths, err := forgePathsArg(args["paths"])
		if err != nil {
			return true, err
		}
		for _, path := range paths {
			protected, policyErr := isProtectedForgeRelativePath(root, path)
			if policyErr != nil {
				return true, policyErr
			}
			if protected {
				return true, nil
			}
		}
	}
	return false, nil
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
		protected, policyErr := isProtectedForgeRelativePath(forgeRoot, relative)
		if policyErr != nil {
			return policyErr
		}
		if !protected {
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
	if _, err := activeForgeRestartPolicy(root); err != nil {
		return err
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

func isProtectedForgeRelativePath(root, relativePath string) (bool, error) {
	policy, err := activeForgeRestartPolicy(root)
	if err != nil {
		return false, err
	}
	normalized := strings.ToLower(strings.TrimPrefix(filepath.ToSlash(filepath.Clean(relativePath)), "./"))
	if normalized == forgeRestartPolicyRelativePath ||
		(strings.HasPrefix(normalized, "kernel/") && strings.HasSuffix(normalized, "_test.go")) {
		return true, nil
	}
	for _, protectedPath := range policy.ProtectedPaths {
		if normalized == strings.ToLower(protectedPath) {
			return true, nil
		}
	}
	for _, prefix := range policy.ProtectedPrefixes {
		if strings.HasPrefix(normalized, strings.ToLower(prefix)) {
			return true, nil
		}
	}
	return false, nil
}

func activeForgeRestartPolicy(root string) (forgeRestartPolicy, error) {
	key, err := filepath.Abs(root)
	if err != nil {
		return forgeRestartPolicy{}, fmt.Errorf("解析 Forge 仓库根目录失败: %w", err)
	}
	key = filepath.Clean(key)
	if runtime.GOOS == "windows" {
		key = strings.ToLower(key)
	}
	activeForgeRestartPolicies.mu.Lock()
	defer activeForgeRestartPolicies.mu.Unlock()
	if policy, ok := activeForgeRestartPolicies.policies[key]; ok {
		return policy, nil
	}
	policy, err := loadForgeRestartPolicy(root)
	if err != nil {
		return forgeRestartPolicy{}, err
	}
	// 运行中的 Kernel 固定首次读取的策略。策略文件本身始终是代码根保护项；
	// 扩展后的策略只在通过 Supervisor 门禁并切换到新 Kernel 后生效。
	activeForgeRestartPolicies.policies[key] = policy
	return policy, nil
}

func loadForgeRestartPolicy(root string) (forgeRestartPolicy, error) {
	policyPath := filepath.Join(root, filepath.FromSlash(forgeRestartPolicyRelativePath))
	data, err := os.ReadFile(policyPath)
	if err != nil {
		return forgeRestartPolicy{}, fmt.Errorf("读取 Forge 重启策略失败 %s: %w", policyPath, err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var policy forgeRestartPolicy
	if err := decoder.Decode(&policy); err != nil {
		return forgeRestartPolicy{}, fmt.Errorf("解析 Forge 重启策略失败 %s: %w", policyPath, err)
	}
	if err := requireJSONEOF(decoder); err != nil {
		return forgeRestartPolicy{}, fmt.Errorf("解析 Forge 重启策略失败 %s: %w", policyPath, err)
	}
	if err := validateForgeRestartPolicy(policy); err != nil {
		return forgeRestartPolicy{}, fmt.Errorf("Forge 重启策略无效 %s: %w", policyPath, err)
	}
	return policy, nil
}

func requireJSONEOF(decoder *json.Decoder) error {
	var trailing interface{}
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("JSON 包含多个顶层值")
		}
		return err
	}
	return nil
}

func validateForgeRestartPolicy(policy forgeRestartPolicy) error {
	if policy.SchemaVersion != 2 || policy.Scope != "all-packages" ||
		strings.TrimSpace(policy.CoreDefinition) == "" || !equalStringSlices(policy.Command, requiredForgeCoreTestCommand) {
		return errors.New("核心测试范围被收窄或策略结构不正确")
	}
	if err := validateForgePolicyEntries(policy.ProtectedPaths, "protectedPaths", false); err != nil {
		return err
	}
	return validateForgePolicyEntries(policy.ProtectedPrefixes, "protectedPrefixes", true)
}

func validateForgePolicyEntries(entries []string, field string, trailingSlash bool) error {
	if len(entries) == 0 {
		return fmt.Errorf("%s 必须包含至少一个保护项", field)
	}
	previous := ""
	for index, entry := range entries {
		if entry == "" || strings.Contains(entry, "\\") || strings.Contains(entry, ":") ||
			strings.IndexFunc(entry, func(r rune) bool { return r < 0x20 }) >= 0 || strings.HasSuffix(entry, "/") != trailingSlash {
			return fmt.Errorf("%s 包含无效路径: %q", field, entry)
		}
		pathPart := strings.TrimSuffix(entry, "/")
		if pathPart == "" || pathpkg.IsAbs(pathPart) || pathpkg.Clean(pathPart) != pathPart ||
			pathPart == "." || pathPart == ".." || strings.HasPrefix(pathPart, "../") {
			return fmt.Errorf("%s 路径越出仓库或未规范化: %q", field, entry)
		}
		folded := strings.ToLower(entry)
		if index > 0 && previous >= folded {
			return fmt.Errorf("%s 必须忽略大小写后有序且无重复", field)
		}
		previous = folded
	}
	return nil
}

func equalStringSlices(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
