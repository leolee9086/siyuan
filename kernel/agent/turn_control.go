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

// AgentChat 保留原始调用契约；未提供控制器时行为与既有上游兼容路径一致。
func AgentChat(ctx context.Context, client *openai.Client, model string, sessionID string, userEntryID string, contentRevision int64, userMessage string, language string, references []Reference, editorCtx EditorContext, pluginActions []PluginAction, regenerate bool, confirmTimeout time.Duration, maxRetries int, reasoningEffort string, taskDirectory *TaskDirectoryBinding, ownerIdentityID string, ownerAuthorizationExpiresAt int64, requestTimeout, streamIdleTimeout time.Duration) <-chan AgentEvent {
	return AgentChatWithControl(ctx, client, model, sessionID, userEntryID, contentRevision, userMessage, language,
		references, editorCtx, pluginActions, regenerate, confirmTimeout, maxRetries, reasoningEffort,
		taskDirectory, ownerIdentityID, ownerAuthorizationExpiresAt, requestTimeout, streamIdleTimeout, nil)
}
