package dummysys

import (
	"context"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// ATFBaselineAvatar 是用于ATF同步率计算的裸LLM基线Avatar。
// 与任务执行Avatar不同，它不包含任何MAGI架构，仅用于问卷测试。
type ATFBaselineAvatar struct {
	llmClient             llm.Client
	integratedDescription string
}

// NewATFBaselineAvatar 创建ATF基线Avatar。
func NewATFBaselineAvatar(llmClient llm.Client, integratedDescription string) (*ATFBaselineAvatar, error) {
	if llmClient == nil {
		return nil, fmt.Errorf("llmClient is required")
	}
	if integratedDescription == "" {
		return nil, fmt.Errorf("integratedDescription is required")
	}

	return &ATFBaselineAvatar{
		llmClient:             llmClient,
		integratedDescription: integratedDescription,
	}, nil
}

// BuildSystemPrompt 构建裸LLM系统提示词（极简，无MAGI架构）。
func (a *ATFBaselineAvatar) BuildSystemPrompt() string {
	return fmt.Sprintf(`你是一个AI助手。请根据以下人格描述，诚实地回答问卷题目。

人格描述：
%s

请对每道题目给出1-5分的评分（1=非常不同意，5=非常同意），并用一两句话简要说明你的想法。`, a.integratedDescription)
}

// AnswerQuestionnaire 回答问卷（用于ATF测试）。
func (a *ATFBaselineAvatar) AnswerQuestionnaire(ctx context.Context, questionPrompt string) (*types.StreamResult, error) {
	systemPrompt := a.BuildSystemPrompt()

	messages := []types.ContextMessage{
		{Role: types.RoleSystem, Content: systemPrompt},
		{Role: types.RoleUser, Content: questionPrompt},
	}

	// 注入请求来源（ATF 基线路径），供前缀缓存监控日志定位调用方。
	ctx = llm.WithRequestSource(ctx, llm.RequestSource{
		RequestType: "atf-baseline",
	})
	content, err := a.llmClient.SendChatRequestSync(ctx, messages, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("baseline avatar llm call failed: %w", err)
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return nil, fmt.Errorf("baseline avatar llm returned empty content")
	}

	return &types.StreamResult{
		Content: content,
		Success: true,
	}, nil
}
