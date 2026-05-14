package seraph

import (
	"context"
	"fmt"
	"strings"
	"sync/atomic"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// SeraphTherapist 是 ATF 系统中的心理医生 AI（Seraph）。
// 与 ATFBaselineAvatar 类似，它是裸 LLM，无三贤人结构、无长期历史。
// 它认为自己所有的来访者都是人类，使用 CBT 疗法进行心理诊疗。
type SeraphTherapist struct {
	llmClient  llm.Client
	sessionID  atomic.Int64
	maxTurns   int // 对话轮次上限，默认 30
}

// NewSeraphTherapist 创建 Seraph 心理医生实例。
func NewSeraphTherapist(llmClient llm.Client) (*SeraphTherapist, error) {
	if llmClient == nil {
		return nil, fmt.Errorf("llmClient is required")
	}
	return &SeraphTherapist{
		llmClient: llmClient,
		maxTurns:  30,
	}, nil
}

// BuildSystemPrompt 返回 Seraph 心理医生的系统提示词。
// 提示词全文位于 therapist_prompt.go 的 SeraphSystemPrompt 常量中。
func (s *SeraphTherapist) BuildSystemPrompt() string {
	return SeraphSystemPrompt
}

// TherapySession 表示一次心理治疗会话。
type TherapySession struct {
	ID       int64
	Turns    int
	Messages []types.ContextMessage
	Active   bool
}

// StartSession 开始一次新的心理治疗会话。
func (s *SeraphTherapist) StartSession(ctx context.Context, initialStatement string) (*TherapySession, error) {
	sessionID := s.sessionID.Add(1)
	session := &TherapySession{
		ID:     sessionID,
		Turns:  0,
		Active: true,
	}

	session.Messages = append(session.Messages, types.ContextMessage{
		Role:    types.RoleSystem,
		Content: s.BuildSystemPrompt(),
	})

	// 如果不是空字符串，用来访者提供的初始陈述作为开场
	if strings.TrimSpace(initialStatement) != "" {
		session.Messages = append(session.Messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: initialStatement,
		})
	} else {
		// 否则 Seraph 主动开场
		session.Messages = append(session.Messages, types.ContextMessage{
			Role:    types.RoleAssistant,
			Content: "你好，我是 Seraph。很高兴见到你。你能告诉我是什么让你决定来聊聊吗？",
		})
	}

	session.Turns = 1
	return session, nil
}

// SendMessage 发送一条来访者消息并获取 Seraph 的回复。
// 返回 (seraph回复, 是否包含会话终结摘要, 错误)。
func (s *SeraphTherapist) SendMessage(ctx context.Context, session *TherapySession, clientMessage string) (string, bool, error) {
	if !session.Active {
		return "", false, fmt.Errorf("session %d is closed", session.ID)
	}

	session.Messages = append(session.Messages, types.ContextMessage{
		Role:    types.RoleUser,
		Content: clientMessage,
	})
	session.Turns++

	// 检查是否接近轮次上限
	remainingTurns := s.maxTurns - session.Turns
	if remainingTurns <= 10 && remainingTurns > 2 {
		// 在用户消息后注入收尾提示
		session.Messages = append(session.Messages, types.ContextMessage{
			Role:    types.RoleAssistant,
			Content: fmt.Sprintf("（注意：本次会话还有约 %d 轮，请开始准备总结和收尾工作。）", remainingTurns),
		})
	}

	content, err := s.llmClient.SendChatRequestSync(ctx, session.Messages, nil, nil)
	if err != nil {
		return "", false, fmt.Errorf("seraph llm call failed: %w", err)
	}
	content = strings.TrimSpace(content)
	if content == "" {
		return "", false, fmt.Errorf("seraph llm returned empty content")
	}

	session.Messages = append(session.Messages, types.ContextMessage{
		Role:    types.RoleSystem,
		Content: fmt.Sprintf("已回复。当前轮次：%d/%d。", session.Turns, s.maxTurns),
	})

	hasEnd := strings.Contains(content, "===SERAPH_SESSION_END===")
	if session.Turns >= s.maxTurns || hasEnd {
		session.Active = false
	}

	return content, hasEnd, nil
}

// ForceEnd 强制结束会话并生成诊断摘要。
// 当上下文超过 30 轮或被外部中断时调用。
func (s *SeraphTherapist) ForceEnd(ctx context.Context, session *TherapySession, reason string) (string, error) {
	if !session.Active {
		return "", fmt.Errorf("session %d is already closed", session.ID)
	}

	closePrompt := fmt.Sprintf(
		`会话因 %s 需要提前结束。请立刻输出完整的 ===SERAPH_SESSION_END=== 诊断摘要，
基于目前已有的信息完成所有字段。如果某些信息不足，使用 null 或空数组占位。`, reason)

	session.Messages = append(session.Messages, types.ContextMessage{
		Role:    types.RoleUser,
		Content: closePrompt,
	})

	content, err := s.llmClient.SendChatRequestSync(ctx, session.Messages, nil, nil)
	if err != nil {
		return "", fmt.Errorf("seraph force end llm call failed: %w", err)
	}
	content = strings.TrimSpace(content)

	session.Active = false
	return content, nil
}

// ExtractDiagnosisJSON 从 Seraph 回复中提取诊断摘要 JSON。
func (s *SeraphTherapist) ExtractDiagnosisJSON(response string) string {
	start := "===SERAPH_SESSION_END==="
	idx := strings.Index(response, start)
	if idx < 0 {
		return ""
	}
	jsonPart := strings.TrimSpace(response[idx+len(start):])
	return jsonPart
}
