package dummysys

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util/stream"
)

// AvatarState represents the state of an Avatar
type AvatarState string

const (
	AvatarStateIdle      AvatarState = "idle"
	AvatarStateActive    AvatarState = "active"
	AvatarStateDestroyed AvatarState = "destroyed"
)

// ExposureMode defines how much memory the Avatar can access
type ExposureMode string

const (
	ExposureModeFull      ExposureMode = "full"
	ExposureModePartial   ExposureMode = "partial"
	ExposureModeDistorted ExposureMode = "distorted"
)

// AvatarChannel represents the channel type
type AvatarChannel string

const (
	AvatarChannelGuardian      AvatarChannel = "guardian"
	AvatarChannelExternalAgent AvatarChannel = "external-agent"
	AvatarChannelSystemCron    AvatarChannel = "system-cron"
	AvatarChannelUnknown       AvatarChannel = "unknown"
)

// AvatarConfig holds the configuration for an Avatar
type AvatarConfig struct {
	AvatarRoleID            string
	AvatarNumber            int
	Channel                 AvatarChannel
	SystemPrompt            string
	ExposureMode            ExposureMode
	HeartbeatIntervalRounds int
}

// AvatarDescriptor represents a single Avatar execution entity
type AvatarDescriptor struct {
	config                AvatarConfig
	state                 AvatarState
	llmClient             llm.Client
	context               []types.ContextMessage
	contextMutex          sync.RWMutex
	stateMutex            sync.RWMutex
	createdAt             time.Time
	lastActiveAt          time.Time
	lastHeartbeatAt       time.Time
	destroyedAt           *time.Time
	roundsSinceMetaReport int
}

// NewAvatar creates a new Avatar instance
func NewAvatar(config AvatarConfig, llmClient llm.Client) (*AvatarDescriptor, error) {
	if config.AvatarRoleID == "" {
		return nil, fmt.Errorf("avatarRoleID is required")
	}
	if config.Channel == "" {
		return nil, fmt.Errorf("channel is required")
	}
	if config.SystemPrompt == "" {
		return nil, fmt.Errorf("systemPrompt is required")
	}
	if llmClient == nil {
		return nil, fmt.Errorf("llmClient is required")
	}

	now := time.Now()
	avatar := &AvatarDescriptor{
		config:                config,
		state:                 AvatarStateIdle,
		llmClient:             llmClient,
		context:               make([]types.ContextMessage, 0),
		createdAt:             now,
		lastActiveAt:          now,
		lastHeartbeatAt:       now,
		destroyedAt:           nil,
		roundsSinceMetaReport: 0,
	}

	// Add system prompt to context
	avatar.context = append(avatar.context, types.ContextMessage{
		Role:    "system",
		Content: config.SystemPrompt,
	})

	return avatar, nil
}

// GetState returns the current state of the Avatar
func (a *AvatarDescriptor) GetState() AvatarState {
	a.stateMutex.RLock()
	defer a.stateMutex.RUnlock()
	return a.state
}

// SetState sets the state of the Avatar
func (a *AvatarDescriptor) SetState(state AvatarState) {
	a.stateMutex.Lock()
	defer a.stateMutex.Unlock()
	a.state = state
	if state == AvatarStateActive {
		a.lastActiveAt = time.Now()
	}
}

// GetConfig returns the Avatar configuration
func (a *AvatarDescriptor) GetConfig() AvatarConfig {
	return a.config
}

// GetContext returns a copy of the Avatar's context
func (a *AvatarDescriptor) GetContext() []types.ContextMessage {
	a.contextMutex.RLock()
	defer a.contextMutex.RUnlock()
	contextCopy := make([]types.ContextMessage, len(a.context))
	copy(contextCopy, a.context)
	return contextCopy
}

// AddToContext adds a message to the Avatar's context
func (a *AvatarDescriptor) AddToContext(message types.ContextMessage) {
	a.contextMutex.Lock()
	defer a.contextMutex.Unlock()
	a.context = append(a.context, message)
}

// ProcessMessage processes a user message and returns the Avatar's response
func (a *AvatarDescriptor) ProcessMessage(ctx context.Context, userMessage string) (*types.StreamResult, error) {
	// Check if Avatar is destroyed
	if a.GetState() == AvatarStateDestroyed {
		return nil, fmt.Errorf("avatar is destroyed")
	}

	// Transition to active state
	a.SetState(AvatarStateActive)
	defer a.SetState(AvatarStateIdle)

	// Increment round count
	a.roundsSinceMetaReport++

	// Add user message to context
	a.AddToContext(types.ContextMessage{
		Role:    "user",
		Content: userMessage,
	})

	// Call LLM with current context
	messages := a.GetContext()
	chunkChan, err := a.llmClient.SendChatRequest(ctx, messages, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("avatar llm call failed: %w", err)
	}

	// 使用通用流式处理器
	processor := stream.NewProcessor()
	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				// 流结束，获取结果
				utilResult := processor.GetResult(true)
				result := convertToMagiStreamResult(utilResult)

				if result == nil {
					return nil, fmt.Errorf("avatar llm returned nil result")
				}
				if !result.Success {
					return nil, fmt.Errorf("avatar llm returned unsuccessful result")
				}
				if strings.TrimSpace(result.Content) == "" && !result.HasToolCalls {
					return nil, fmt.Errorf("avatar llm returned empty content")
				}

				// Add assistant response to context
				if result.Content != "" {
					a.AddToContext(types.ContextMessage{
						Role:    "assistant",
						Content: result.Content,
					})
				}

				// Parse tool calls to detect heartbeat
				if result.HasToolCalls {
					a.parseToolCallsForHeartbeat(result)
				}

				return result, nil
			}

			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]

			// 累积内容
			processor.AccumulateContent(choice.Delta.Content)

			// 转换并合并工具调用
			if len(choice.Delta.ToolCalls) > 0 {
				utilToolCalls := convertToolCallDeltas(choice.Delta.ToolCalls)
				processor.MergeToolCalls(utilToolCalls)
			}

		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// convertToolCallDeltas 转换工具调用增量类型
func convertToolCallDeltas(magiCalls []types.ToolCallDelta) []stream.ToolCallDelta {
	result := make([]stream.ToolCallDelta, len(magiCalls))
	for i, tc := range magiCalls {
		result[i] = stream.ToolCallDelta{
			Index: tc.Index,
			ID:    tc.ID,
			Type:  tc.Type,
		}
		if tc.Function != nil {
			result[i].Function = &stream.ToolCallFunctionDelta{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			}
		}
	}
	return result
}

// convertToMagiStreamResult 转换流式结果类型
func convertToMagiStreamResult(utilResult *stream.StreamResult) *types.StreamResult {
	return &types.StreamResult{
		Content:              utilResult.Content,
		Success:              utilResult.Success,
		HasToolCalls:         utilResult.HasToolCalls,
		ToolCallNames:        utilResult.ToolCallNames,
		ToolArgumentsByName:  utilResult.ToolArgumentsByName,
		InternalToolMessages: utilResult.InternalToolMessages,
	}
}

func (a *AvatarDescriptor) processMessageOld(ctx context.Context) (*types.StreamResult, error) {
	// 旧实现保留用于参考
	messages := a.GetContext()
	chunkChan, err := a.llmClient.SendChatRequest(ctx, messages, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("avatar llm call failed: %w", err)
	}
	result, err := llm.ProcessStreamResponse(ctx, chunkChan)
	if err != nil {
		return nil, fmt.Errorf("avatar stream processing failed: %w", err)
	}
	if result == nil {
		return nil, fmt.Errorf("avatar llm returned nil result")
	}
	if !result.Success {
		return nil, fmt.Errorf("avatar llm returned unsuccessful result")
	}
	if strings.TrimSpace(result.Content) == "" && !result.HasToolCalls {
		return nil, fmt.Errorf("avatar llm returned empty content")
	}

	// Add assistant response to context
	if result.Content != "" {
		a.AddToContext(types.ContextMessage{
			Role:    "assistant",
			Content: result.Content,
		})
	}

	// Parse tool calls to detect heartbeat
	if result.HasToolCalls {
		a.parseToolCallsForHeartbeat(result)
	}

	return result, nil
}

// parseToolCallsForHeartbeat checks if report_to_core(type="heartbeat") was called
func (a *AvatarDescriptor) parseToolCallsForHeartbeat(result *types.StreamResult) {
	if result.ToolArgumentsByName == nil {
		return
	}

	reportArgs, exists := result.ToolArgumentsByName["report_to_core"]
	if !exists {
		return
	}

	for _, argJSON := range reportArgs {
		var args struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal([]byte(argJSON), &args); err != nil {
			continue
		}
		if args.Type == "heartbeat" {
			a.updateLastHeartbeat()
			return
		}
	}
}

// CheckHeartbeatTimeout checks if the Avatar has exceeded the heartbeat interval
func (a *AvatarDescriptor) CheckHeartbeatTimeout() bool {
	if a.config.HeartbeatIntervalRounds <= 0 {
		return false // No heartbeat requirement
	}
	return a.roundsSinceMetaReport >= a.config.HeartbeatIntervalRounds
}

// updateLastHeartbeat updates the last heartbeat timestamp and resets round counter
func (a *AvatarDescriptor) updateLastHeartbeat() {
	a.stateMutex.Lock()
	defer a.stateMutex.Unlock()
	a.lastHeartbeatAt = time.Now()
	a.roundsSinceMetaReport = 0
}

// Destroy marks the Avatar as destroyed
func (a *AvatarDescriptor) Destroy() {
	a.SetState(AvatarStateDestroyed)
	now := time.Now()
	a.destroyedAt = &now
}

// GetRoundsSinceMetaReport returns the number of rounds since last meta report
func (a *AvatarDescriptor) GetRoundsSinceMetaReport() int {
	a.stateMutex.RLock()
	defer a.stateMutex.RUnlock()
	return a.roundsSinceMetaReport
}
