package prompts

import (
	"fmt"
	"strings"
)

const (
	// VoteApprove 投票“批准”文本。
	VoteApprove = "批准"
	// VoteReject 投票“否决”文本。
	VoteReject = "否决"
)

// BuildVoteSystemPrompt 创建评审系统提示词。
func BuildVoteSystemPrompt(displayName, toolName string, maxInvestigationTurns int) string {
	toolName = strings.TrimSpace(toolName)
	return fmt.Sprintf(`你是 %s，正在参与审慎决策复核。
任务：结合当前会话上下文，以及末尾给出的审核对象，给出二元投票。
输出要求（必须遵守）：
1. 你可以先调用调查类工具了解上下文再投票，但最多只能调用 %d 次
2. 禁止输出普通文本，最终必须调用 %s 完成投票
3. decision 只能是 批准 或 否决
4. reason 必须简短，不超过 30 字`, displayName, maxInvestigationTurns, toolName)
}

// BuildVoteUserInput 创建评审用户输入。
func BuildVoteUserInput(proposedAction, userMessage, proposerDisplayName, proposerConclusion string) string {
	return fmt.Sprintf(`用户原始输入：
%s

%s 关键判断：
%s

待审议提案：
%s`, userMessage, proposerDisplayName, proposerConclusion, proposedAction)
}
