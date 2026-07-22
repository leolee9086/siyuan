package tools

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	ForgeRuntimeStatusToolName       = "forge_runtime_status"
	ForgeRuntimeRestartToolName      = "forge_runtime_restart"
	ForgeRuntimeApproveTestsToolName = "forge_runtime_approve_tests"
	forgeRuntimeApprovalArg          = "_forgeRuntimeApproval"
	forgeRuntimeMaxResponse          = 2 * 1024 * 1024
)

type forgeRuntimeApproval struct{}

var forgeRuntimeHTTPClient = &http.Client{Timeout: 10 * time.Second}

var ForgeRuntimeStatusTool = &Tool{
	Name:        ForgeRuntimeStatusToolName,
	Description: "仅在由源码 Supervisor 启动的 forge 模式可用。查询当前 Kernel 版本、重启验证阶段、失败原因和保留版本，不修改运行状态。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{}},
	Handler:     forgeRuntimeStatusHandler,
}

var ForgeRuntimeRestartTool = &Tool{
	Name:        ForgeRuntimeRestartToolName,
	Description: "仅在由源码 Supervisor 启动的 forge 模式可用。请求验证 Git 清洁状态、Kernel 代码提交、格式、vet 和全部后端测试，构建候选核心，经健康检查后重启；候选失败时自动恢复上一核心。每次调用都必须由用户复核。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"reason": {Type: "string", Description: "本次 Kernel 修改摘要及重启原因"},
	}, Required: []string{"reason"}},
	Handler: forgeRuntimeRestartHandler,
}

var ForgeRuntimeApproveTestsTool = &Tool{
	Name:        ForgeRuntimeApproveTestsToolName,
	Description: "批准指定 Forge 重启任务中由 Git diff 识别出的受保护核心测试或门禁文件变化。仅在状态为 awaiting_protected_test_approval 时可用，每次调用都必须由用户单独复核，批准仅绑定 jobId 和 revision。",
	Source:      "forge",
	InputSchema: ToolSchema{Type: "object", Properties: map[string]Property{
		"jobId":    {Type: "string", Description: "等待批准的 Supervisor 重启任务 ID"},
		"revision": {Type: "string", Description: "状态中列出的候选 Git revision"},
	}, Required: []string{"jobId", "revision"}},
	Handler: forgeRuntimeApproveTestsHandler,
}

func init() {
	register(ForgeRuntimeStatusTool)
	register(ForgeRuntimeRestartTool)
	register(ForgeRuntimeApproveTestsTool)
}

// WithForgeRuntimeApproval 注入只能由原生 Agent 人工复核路径创建的进程内 capability。
func WithForgeRuntimeApproval(args map[string]interface{}) {
	args[forgeRuntimeApprovalArg] = forgeRuntimeApproval{}
}

func forgeRuntimeStatusHandler(_ map[string]interface{}) (CallToolResult, error) {
	return callForgeSupervisor(http.MethodGet, "/status", nil)
}

func forgeRuntimeRestartHandler(args map[string]interface{}) (CallToolResult, error) {
	if _, approved := args[forgeRuntimeApprovalArg].(forgeRuntimeApproval); !approved {
		return forgeError("Kernel 重编译重启必须由原生 Agent 的逐次人工复核流程触发")
	}
	reason := strings.TrimSpace(stringArg(args, "reason", ""))
	if reason == "" {
		return forgeError("reason 不能为空")
	}
	return callForgeSupervisor(http.MethodPost, "/restart", map[string]string{"reason": reason})
}

func forgeRuntimeApproveTestsHandler(args map[string]interface{}) (CallToolResult, error) {
	if _, approved := args[forgeRuntimeApprovalArg].(forgeRuntimeApproval); !approved {
		return forgeError("受保护核心测试的重启批准必须由原生 Agent 的逐次人工复核流程触发")
	}
	jobID := strings.TrimSpace(stringArg(args, "jobId", ""))
	revision := strings.TrimSpace(stringArg(args, "revision", ""))
	if jobID == "" || revision == "" {
		return forgeError("jobId 和 revision 不能为空")
	}
	return callForgeSupervisor(http.MethodPost, "/approve-protected-tests", map[string]string{"jobId": jobID, "revision": revision})
}

func callForgeSupervisor(method, endpoint string, body interface{}) (CallToolResult, error) {
	root, err := ForgeDevRepoRoot()
	if err != nil {
		return forgeError(err.Error())
	}
	configuredRoot := strings.TrimSpace(os.Getenv(util.ForgeSupervisorRootEnv))
	if configuredRoot == "" || !sameForgeRuntimePath(root, configuredRoot) {
		return forgeError("当前 Kernel 不是由此源码仓库的 Forge Supervisor 启动")
	}
	controlURL, token, ok := util.ForgeSupervisorConnection()
	if !ok {
		return forgeError("Forge Supervisor 控制面未连接")
	}
	var requestBody io.Reader
	if body != nil {
		encoded, encodeErr := json.Marshal(body)
		if encodeErr != nil {
			return forgeError(fmt.Sprintf("编码 Supervisor 请求失败: %v", encodeErr))
		}
		requestBody = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, controlURL+endpoint, requestBody)
	if err != nil {
		return forgeError(fmt.Sprintf("创建 Supervisor 请求失败: %v", err))
	}
	request.Header.Set(util.ForgeSupervisorTokenHeader, token)
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := forgeRuntimeHTTPClient.Do(request)
	if err != nil {
		return forgeError(fmt.Sprintf("连接 Forge Supervisor 失败: %v", err))
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, forgeRuntimeMaxResponse+1))
	if err != nil {
		return forgeError(fmt.Sprintf("读取 Supervisor 响应失败: %v", err))
	}
	if len(data) > forgeRuntimeMaxResponse {
		return forgeError("Forge Supervisor 响应超过大小限制")
	}
	var payload interface{}
	if err := json.Unmarshal(data, &payload); err != nil {
		return forgeError(fmt.Sprintf("Forge Supervisor 返回无效 JSON: %v", err))
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return forgeError(fmt.Sprintf("Forge Supervisor 请求失败 [HTTP %d]: %s", response.StatusCode, strings.TrimSpace(string(data))))
	}
	return forgeResult(payload, nil)
}

func sameForgeRuntimePath(left, right string) bool {
	leftResolved, leftErr := filepath.EvalSymlinks(filepath.Clean(left))
	rightResolved, rightErr := filepath.EvalSymlinks(filepath.Clean(right))
	if leftErr != nil || rightErr != nil {
		return false
	}
	return sameForgePath(leftResolved, rightResolved)
}
