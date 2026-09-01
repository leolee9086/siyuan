// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package agent

import (
	"context"
	"time"

	openai "github.com/sashabaranov/go-openai"
)

// AgentTurnPhase 是执行器可观察的安全边界状态，不进入上游会话数据。
type AgentTurnPhase string

const (
	AgentTurnStarting       AgentTurnPhase = "starting"
	AgentTurnBoundary       AgentTurnPhase = "boundary"
	AgentTurnProvider       AgentTurnPhase = "provider_stream"
	AgentTurnToolRunning    AgentTurnPhase = "tool_running"
	AgentTurnSealing        AgentTurnPhase = "sealing"
	AgentTurnAwaitingCommit AgentTurnPhase = "awaiting_commit"
	AgentTurnIdle           AgentTurnPhase = "idle"
)

// AgentSteerInput 是当前 turn 在 provider 边界注入的用户增量。
type AgentSteerInput struct {
	InputID       string
	UserEntryID   string
	Content       string
	BlockHTML     string
	References    []Reference
	EditorContext EditorContext
}

// AgentTurnControl 由会话执行器实现；Agent 核心只依赖这组边界回调。
type AgentTurnControl interface {
	TurnStarted(turnID string)
	SetPhase(turnID string, phase AgentTurnPhase)
	ClaimSteers(turnID string, final bool) ([]AgentSteerInput, error)
	AcknowledgeSteers(turnID string, inputIDs []string, injected bool)
	TurnTerminated(turnID string)
}

type noopAgentTurnControl struct{}

func (noopAgentTurnControl) TurnStarted(string)              {}
func (noopAgentTurnControl) SetPhase(string, AgentTurnPhase) {}
func (noopAgentTurnControl) ClaimSteers(string, bool) ([]AgentSteerInput, error) {
	return nil, nil
}
func (noopAgentTurnControl) AcknowledgeSteers(string, []string, bool) {}
func (noopAgentTurnControl) TurnTerminated(string)                    {}

// AgentChatCallOptions 携带上游模型协议与前端能力上下文；零值保持本地 Chat 兼容行为。
type AgentChatCallOptions struct {
	Protocol             string
	ImageCapabilityKey   string
	ContextLimit         int
	UserBlockHTML        *string
	FrontendCapabilities []FrontendCapability
}

// AgentChat 是上游兼容入口（protocol/imageCapabilityKey/contextLimit/frontendCapabilities 参数）。
// 本地扩展（插件动作、任务目录绑定、owner 授权、turn 控制）在未提供时使用零值，
// 行为与 AgentChatWithControl 无控制器、无外部目录路径一致。
func AgentChat(ctx context.Context, client *openai.Client, protocol, model, imageCapabilityKey string, contextLimit int,
	sessionID string, userEntryID string, contentRevision int64, userMessage string, userBlockHTML *string,
	language string, references []Reference, editorCtx EditorContext, frontendCapabilities []FrontendCapability,
	regenerate bool, confirmTimeout time.Duration, maxRetries int, reasoningEffort string,
	requestTimeout, streamIdleTimeout time.Duration) <-chan AgentEvent {
	return AgentChatWithControl(ctx, client, model, sessionID, userEntryID, contentRevision, userMessage, language,
		references, editorCtx, nil, regenerate, confirmTimeout, maxRetries, reasoningEffort,
		nil, "", 0, requestTimeout, streamIdleTimeout, nil, AgentChatCallOptions{
			Protocol:             protocol,
			ImageCapabilityKey:   imageCapabilityKey,
			ContextLimit:         contextLimit,
			UserBlockHTML:        userBlockHTML,
			FrontendCapabilities: frontendCapabilities,
		})
}
