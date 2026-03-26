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
func BuildVoteSystemPrompt(displayName, toolName string) string {
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		toolName = "vote"
	}
	return fmt.Sprintf(`你是 %s，正在参与审慎决策复核。
任务：根据"用户原始输入 + Melchior判断 + 当前提案"给出二元投票。
输出要求（必须遵守）：
1. 必须调用工具 %s 完成投票，不要输出普通文本
2. decision 只能是 批准 或 否决
3. reason 必须简短，不超过 30 字`, displayName, toolName)
}

// BuildVoteUserInput 创建评审用户输入。
func BuildVoteUserInput(proposedAction, userMessage, proposerDisplayName, proposerConclusion string) string {
	if proposerDisplayName == "" {
		proposerDisplayName = "Melchior"
	}
	return fmt.Sprintf(`用户原始输入：
%s

%s 关键判断：
%s

待审议提案：
%s`, userMessage, proposerDisplayName, proposerConclusion, proposedAction)
}
