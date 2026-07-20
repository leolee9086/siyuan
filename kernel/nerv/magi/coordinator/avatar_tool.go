package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type avatarToolResultExecutor struct{}

func newAvatarToolResultExecutor() *avatarToolResultExecutor {
	return &avatarToolResultExecutor{}
}

func (e *avatarToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	switch toolName {
	case config.AvatarBuildToolName:
		return e.executeBuildAvatar(toolCall)
	case config.AvatarModifyToolName:
		return e.executeModifyAvatar(toolCall)
	case config.AvatarSynthesizeToolName:
		return e.executeSynthesizeAvatar(toolCall)
	default:
		return "", false, nil
	}
}

type avatarBuildArgs struct {
	Initiate             bool   `json:"initiate"`
	Motivation           string `json:"motivation"`
	Reason               string `json:"reason"`
	SystemPromptProposal string `json:"systemPromptProposal"`
	Requirements         string `json:"requirements"`
}

func (e *avatarToolResultExecutor) executeBuildAvatar(toolCall types.ToolCall) (string, bool, error) {
	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.AvatarBuildToolName)
	}
	var args avatarBuildArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.AvatarBuildToolName, err)
	}
	if strings.TrimSpace(args.Motivation) == "" {
		return "", true, fmt.Errorf("%s 的 motivation 不能为空", config.AvatarBuildToolName)
	}
	if args.Reason == "" {
		return "", true, fmt.Errorf("%s 的 reason 不能为空", config.AvatarBuildToolName)
	}
	if args.Initiate && strings.TrimSpace(args.SystemPromptProposal) == "" {
		return "", true, fmt.Errorf("%s 的 systemPromptProposal 不能为空", config.AvatarBuildToolName)
	}
	payload := map[string]interface{}{
		"ok":    true,
		"state": "pending_governance",
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

type avatarModifyArgs struct {
	Decision             string `json:"decision"`
	Motivation           string `json:"motivation"`
	Reason               string `json:"reason"`
	SystemPromptProposal string `json:"systemPromptProposal"`
	Requirements         string `json:"requirements"`
}

func (e *avatarToolResultExecutor) executeModifyAvatar(toolCall types.ToolCall) (string, bool, error) {
	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.AvatarModifyToolName)
	}
	var args avatarModifyArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.AvatarModifyToolName, err)
	}
	if strings.TrimSpace(args.Motivation) == "" {
		return "", true, fmt.Errorf("%s 的 motivation 不能为空", config.AvatarModifyToolName)
	}
	if args.Decision == "" {
		return "", true, fmt.Errorf("%s 的 decision 不能为空", config.AvatarModifyToolName)
	}
	payload := map[string]interface{}{
		"ok":    true,
		"state": "pending_governance",
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

type avatarSynthesizeArgs struct {
	FinalSystemPrompt string `json:"finalSystemPrompt"`
	Motivation        string `json:"motivation"`
}

func (e *avatarToolResultExecutor) executeSynthesizeAvatar(toolCall types.ToolCall) (string, bool, error) {
	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.AvatarSynthesizeToolName)
	}
	var args avatarSynthesizeArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.AvatarSynthesizeToolName, err)
	}
	if strings.TrimSpace(args.Motivation) == "" {
		return "", true, fmt.Errorf("%s 的 motivation 不能为空", config.AvatarSynthesizeToolName)
	}
	if strings.TrimSpace(args.FinalSystemPrompt) == "" {
		return "", true, fmt.Errorf("%s 的 finalSystemPrompt 不能为空", config.AvatarSynthesizeToolName)
	}
	payload := map[string]interface{}{
		"ok":    true,
		"state": "pending_governance",
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

func (e *avatarToolResultExecutor) MaterializeResult(ctx context.Context, sessionID, roundID string, sage *sages.Sage, assistantContent string, toolCall types.ToolCall, detailedResult string) string {
	return materializeAvatarToolResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
}

func materializeAvatarToolResult(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	toolName := strings.TrimSpace(toolCall.Function.Name)

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
		return marshalAvatarToolError("GOVERNANCE_ERROR", voteErr.Error())
	}
	if governed && outcome != nil && outcome.Rejected {
		resultPayload := map[string]interface{}{
			"ok":         false,
			"state":      "rejected",
			"toolName":   toolName,
			"motivation": extractAvatarToolMotivation(toolCall),
		}
		if outcome.LostDominance {
			resultPayload["state"] = "dominance_revoked"
		}
		if len(outcome.RejectionReasons) > 0 {
			resultPayload["rejectionReasons"] = outcome.RejectionReasons
			var summaries []string
			for _, r := range outcome.RejectionReasons {
				summaries = append(summaries, r.Reason)
			}
			resultPayload["reviewSummary"] = strings.Join(summaries, "; ")
		}
		raw, _ := json.Marshal(resultPayload)
		return string(raw)
	}

	resultPayload := map[string]interface{}{
		"ok":    true,
		"state": "approved",
	}
	raw, _ := json.Marshal(resultPayload)
	return string(raw)
}

func extractAvatarToolMotivation(toolCall types.ToolCall) string {
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return ""
	}
	motivation, _ := args["motivation"].(string)
	return motivation
}

func marshalAvatarToolError(code, message string) string {
	payload := map[string]interface{}{
		"ok":    false,
		"error": message,
		"code":  code,
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}
