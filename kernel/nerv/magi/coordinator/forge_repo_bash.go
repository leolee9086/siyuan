package coordinator

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// forgeDevRepoBashArgs 是 forge_dev_repo_bash 工具参数结构
type forgeDevRepoBashArgs struct {
	Command     string `json:"command"`
	Timeout     int    `json:"timeout"`
	Description string `json:"description"`
}

// forgeDevRepoBashPayload 是 forge_dev_repo_bash 工具结果结构
type forgeDevRepoBashPayload struct {
	RootHint    string `json:"rootHint"`
	Cwd         string `json:"cwd"`
	Command     string `json:"command"`
	ExitCode    int    `json:"exitCode"`
	Stdout      string `json:"stdout"`
	Stderr      string `json:"stderr"`
	Timeout     int    `json:"timeout"`
	Truncated   bool   `json:"truncated"`
	State       string `json:"state"`
	Description string `json:"description,omitempty"`
}

// executeForgeDevRepoBash 执行 forge_dev_repo_bash 工具的主流程。
// 流程：参数解析 → 安全检查 → 自动放行(BashAllow) 或 返回 pending_governance(BashAsk) 或 拒绝(BashDeny)。
func executeForgeDevRepoBash(rawArgs string) (string, error) {
	args, err := parseForgeDevRepoBashArgs(rawArgs)
	if err != nil {
		return "", err
	}

	root, err := resolveForgeDevRepoRoot()
	if err != nil {
		return "", err
	}

	// 命令分类
	cmdClass := classifyBashCommand(args.Command, root)
	switch cmdClass {
	case BashDeny:
		return "", fmt.Errorf("%s 命令被拒绝执行（命令被列入禁止列表）: %s", config.ForgeDevRepoBashToolName, truncateForgeDevRepoBashCommand(args.Command))
	case BashAsk:
		// 需要治理投票
		timeoutVal, timeoutErr := resolveBashTimeout(args.Timeout)
		if timeoutErr != nil {
			timeoutVal = 30
		}
		payload := forgeDevRepoBashPayload{
			RootHint:    compactWorkspacePathHint(root),
			Cwd:         root,
			Command:     args.Command,
			Timeout:     timeoutVal,
			State:       "pending_governance",
			Description: args.Description,
		}
		return marshalForgeDevRepoBashPayload(payload)
	case BashAllow:
		// 安全命令，直接执行
		return executeForgeDevRepoBashCommand(args, root)
	default:
		return "", fmt.Errorf("%s 未知的命令分类", config.ForgeDevRepoBashToolName)
	}
}

// executeForgeDevRepoBashCommand 执行 bash 命令并返回结果。
func executeForgeDevRepoBashCommand(args *forgeDevRepoBashArgs, root string) (string, error) {
	timeoutSec, timeoutErr := resolveBashTimeout(args.Timeout)
	if timeoutErr != nil {
		timeoutSec = 30
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSec)*time.Second)
	defer cancel()

	// 使用 PowerShell 作为 Windows 下的 shell
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", args.Command)
	cmd.Dir = root

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	exitCode := 0
	if runErr := cmd.Run(); runErr != nil {
		if exitErr, ok := runErr.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else if ctx.Err() == context.DeadlineExceeded {
			exitCode = -1 // 超时标记
		} else {
			// 其他执行错误
			return marshalForgeDevRepoBashPayload(forgeDevRepoBashPayload{
				RootHint:  compactWorkspacePathHint(root),
				Cwd:       root,
				Command:   args.Command,
				ExitCode:  -1,
				Stderr:    runErr.Error(),
				Timeout:   timeoutSec,
				State:     "execution_error",
				Truncated: false,
			})
		}
	}

	stdoutStr := stdout.String()
	stderrStr := stderr.String()

	// 输出截断检查
	truncated := false
	if len(stdoutStr) > maxBashOutputBytes {
		stdoutStr = stdoutStr[:maxBashOutputBytes] + "\n... [输出截断: 超过 1MB]"
		truncated = true
	}
	if len(stderrStr) > maxBashOutputBytes {
		stderrStr = stderrStr[:maxBashOutputBytes] + "\n... [输出截断: 超过 1MB]"
		truncated = true
	}

	state := "executed"
	if exitCode != 0 {
		state = "executed_with_errors"
	}

	return marshalForgeDevRepoBashPayload(forgeDevRepoBashPayload{
		RootHint:  compactWorkspacePathHint(root),
		Cwd:       root,
		Command:   args.Command,
		ExitCode:  exitCode,
		Stdout:    stdoutStr,
		Stderr:    stderrStr,
		Timeout:   timeoutSec,
		State:     state,
		Truncated: truncated,
	})
}

// materializeForgeDevRepoBashResult 在治理统合阶段执行需要治理投票的 bash 命令。
// 流程：治理投票 → 通过则执行 → 返回结果。
func materializeForgeDevRepoBashResult(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	args, err := parseForgeDevRepoBashArgs(toolCall.Function.Arguments)
	if err != nil {
		return marshalForgeDevRepoBashFailure(err.Error())
	}

	payload := map[string]interface{}{}
	if trimmed := strings.TrimSpace(detailedResult); trimmed != "" {
		_ = json.Unmarshal([]byte(trimmed), &payload)
	}
	if len(payload) == 0 {
		payload["ok"] = true
		payload["state"] = "pending_governance"
	}

	outcome, governed, voteErr := dominantActionToolGovernance.EvaluateActionVote(
		ctx, sessionID, roundID, sage, assistantContent, toolCall,
	)
	if voteErr != nil {
		return marshalForgeDevRepoBashFailure(voteErr.Error())
	}
	if governed && outcome != nil && outcome.Rejected {
		return marshalForgeDevRepoBashRejection(toolCall.Function.Name, payload, outcome)
	}

	// 治理通过，执行命令
	root, rootErr := resolveForgeDevRepoRoot()
	if rootErr != nil {
		return marshalForgeDevRepoBashFailure(rootErr.Error())
	}

	result, execErr := executeForgeDevRepoBashCommand(args, root)
	if execErr != nil {
		return marshalForgeDevRepoBashFailure(execErr.Error())
	}
	return result
}

// parseForgeDevRepoBashArgs 解析并验证 forge_dev_repo_bash 的 JSON 参数。
func parseForgeDevRepoBashArgs(rawArgs string) (*forgeDevRepoBashArgs, error) {
	trimmed := strings.TrimSpace(rawArgs)
	if trimmed == "" {
		return nil, fmt.Errorf("%s 参数不能为空", config.ForgeDevRepoBashToolName)
	}

	var args forgeDevRepoBashArgs
	if err := json.Unmarshal([]byte(trimmed), &args); err != nil {
		return nil, fmt.Errorf("%s 参数解析失败: %w", config.ForgeDevRepoBashToolName, err)
	}

	args.Command = strings.TrimSpace(args.Command)
	if args.Command == "" {
		return nil, fmt.Errorf("%s 缺少 command", config.ForgeDevRepoBashToolName)
	}

	// timeout=0 表示使用默认值 30 秒，由 resolveBashTimeout 处理
	if args.Timeout != 0 {
		if err := validateBashTimeout(args.Timeout); err != nil {
			return nil, fmt.Errorf("%s timeout 无效: %w", config.ForgeDevRepoBashToolName, err)
		}
	}

	args.Description = strings.TrimSpace(args.Description)
	return &args, nil
}

// marshalForgeDevRepoBashPayload 将 payload 序列化为 JSON 字符串。
func marshalForgeDevRepoBashPayload(payload forgeDevRepoBashPayload) (string, error) {
	resultBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("%s 结果序列化失败: %w", config.ForgeDevRepoBashToolName, err)
	}
	return string(resultBytes), nil
}

// marshalForgeDevRepoBashFailure 构造失败状态的 JSON 结果。
func marshalForgeDevRepoBashFailure(errMsg string) string {
	payload := map[string]interface{}{
		"ok":    false,
		"state": "bash_failed",
	}
	if errMsg != "" {
		payload["error"] = errMsg
	}
	resultBytes, _ := json.Marshal(payload)
	return string(resultBytes)
}

// marshalForgeDevRepoBashRejection 构造治理否决状态的 JSON 结果。
func marshalForgeDevRepoBashRejection(
	toolName string,
	payload map[string]interface{},
	outcome *governedActionVoteOutcome,
) string {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payload["ok"] = false
	payload["toolName"] = strings.TrimSpace(toolName)
	payload["reviewSummary"] = "该命令执行操作已被专家团队否决。"
	if outcome != nil && len(outcome.RejectionReasons) > 0 {
		payload["rejectionReasons"] = outcome.RejectionReasons
	}
	if outcome != nil && outcome.LostDominance {
		payload["state"] = "dominance_revoked"
		payload["remainingAttempts"] = 0
		payload["instruction"] = "连续两次未获批准，当前轮次将改由其他处理路径继续。"
	} else {
		payload["state"] = "rejected"
		payload["remainingAttempts"] = 1
		payload["instruction"] = buildGovernedActionRetryPrompt(config.ForgeDevRepoBashToolName)
	}
	resultBytes, err := json.Marshal(payload)
	if err != nil {
		if outcome != nil && outcome.LostDominance {
			return `{"ok":false,"state":"dominance_revoked"}`
		}
		return `{"ok":false,"state":"rejected"}`
	}
	return string(resultBytes)
}

// truncateForgeDevRepoBashCommand 截断过长的命令用于错误消息。
func truncateForgeDevRepoBashCommand(cmd string) string {
	runes := []rune(strings.TrimSpace(cmd))
	if len(runes) <= 80 {
		return string(runes)
	}
	return string(runes[:80]) + "..."
}
