package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	utilstream "github.com/siyuan-note/siyuan/kernel/util/stream"
)

func parseWannaSpeakToolContent(
	toolArgumentsByName map[string][]string,
	tracker *wannaSpeakStateTracker,
) (content string, hasWannaSpeak bool, err error) {
	_, hasStart := toolArgumentsByName[config.WannaSpeakStartToolName]
	continueArgs, hasContinue := toolArgumentsByName[config.WannaSpeakContinueToolName]
	_, hasStop := toolArgumentsByName[config.WannaSpeakStopToolName]
	if !hasStart && !hasContinue && !hasStop {
		return "", false, nil
	}
	if tracker != nil && !tracker.HasEffectiveTransition() && !hasContinue {
		return "", false, nil
	}

	if tracker != nil {
		if parseErr := tracker.ValidatePairedState(); parseErr != nil {
			return "", true, parseErr
		}
	}
	segments, parseErr := extractToolContentSegments(continueArgs, config.WannaSpeakContinueToolName)
	if parseErr != nil {
		return "", true, parseErr
	}
	content = strings.TrimSpace(strings.Join(segments, ""))
	if content == "" {
		return "", true, fmt.Errorf("%s 与 %s 已调用但缺少 %s 内容", config.WannaSpeakStartToolName, config.WannaSpeakStopToolName, config.WannaSpeakContinueToolName)
	}
	return content, true, nil
}

func parseWannaDowntimeToolContent(toolCalls []types.ToolCall) (note *types.HeartbeatDowntimeTool, hasDowntime bool, err error) {
	if len(toolCalls) == 0 {
		return nil, false, nil
	}

	var downtimeCall *types.ToolCall
	for _, call := range toolCalls {
		if !config.IsWannaSleepOrRestToolName(strings.TrimSpace(call.Function.Name)) {
			continue
		}
		if downtimeCall != nil {
			return nil, true, fmt.Errorf("睡前/工作日志工具每轮最多调用一次")
		}
		cloned := call
		downtimeCall = &cloned
	}
	if downtimeCall == nil {
		return nil, false, nil
	}

	var payload types.HeartbeatDowntimeTool
	toolName := strings.TrimSpace(downtimeCall.Function.Name)
	if err := json.Unmarshal([]byte(downtimeCall.Function.Arguments), &payload); err != nil {
		return nil, true, fmt.Errorf("%s 参数解析失败: %w", toolName, err)
	}
	payload.Summary = strings.TrimSpace(payload.Summary)
	payload.NextStepPlan = strings.TrimSpace(payload.NextStepPlan)
	payload.DreamScene = strings.TrimSpace(payload.DreamScene)
	payload.Reflection = strings.TrimSpace(payload.Reflection)
	payload.Mood = strings.TrimSpace(payload.Mood)
	if payload.Summary == "" {
		return nil, true, fmt.Errorf("%s 的 summary 不能为空", toolName)
	}

	switch toolName {
	case config.WannaSleepPlanToolName:
		if payload.NextStepPlan == "" && payload.Reflection == "" {
			return nil, true, fmt.Errorf("%s 必须填写 nextStepPlan 或 reflection", toolName)
		}
	case config.WannaSleepDreamToolName:
		if payload.DreamScene == "" {
			return nil, true, fmt.Errorf("%s 必须填写 dreamScene", toolName)
		}
	case config.WannaRestDreamToolName:
		if payload.Mood == "" {
			return nil, true, fmt.Errorf("%s 必须填写 mood", toolName)
		}
	case config.WannaRestPlanToolName:
		if payload.NextStepPlan == "" {
			return nil, true, fmt.Errorf("%s 必须填写 nextStepPlan", toolName)
		}
	}
	return &payload, true, nil
}

func cloneWannaDowntimeToolCall(toolCalls []types.ToolCall) *types.ToolCall {
	for _, call := range toolCalls {
		if !config.IsWannaSleepOrRestToolName(strings.TrimSpace(call.Function.Name)) {
			continue
		}
		cloned := call
		return &cloned
	}
	return nil
}

func countDowntimeResponses(responses []types.SageResponse) int {
	count := 0
	for _, response := range responses {
		if response.WantsDowntime {
			count++
		}
	}
	return count
}

func buildHeartbeatDowntimePreview(sageName string, note *types.HeartbeatDowntimeTool, isRest bool) string {
	if note == nil {
		return ""
	}
	parts := []string{strings.TrimSpace(note.Summary)}
	switch strings.TrimSpace(sageName) {
	case "melchior":
		if note.Reflection != "" {
			parts = append(parts, "回想反思："+note.Reflection)
		}
		if note.NextStepPlan != "" {
			parts = append(parts, "下一步计划："+note.NextStepPlan)
		}
	case "balthazar":
		if isRest {
			if note.Mood != "" {
				parts = append(parts, "工作心情："+note.Mood)
			}
		} else {
			if note.DreamScene != "" {
				parts = append(parts, "画面描述："+note.DreamScene)
			}
		}
	}
	return strings.TrimSpace(strings.Join(parts, "\n"))
}

func collectToolCallNames(toolCalls []types.ToolCall) []string {
	if len(toolCalls) == 0 {
		return nil
	}
	ret := make([]string, 0, len(toolCalls))
	for _, call := range toolCalls {
		name := strings.TrimSpace(call.Function.Name)
		if name == "" {
			continue
		}
		ret = append(ret, name)
	}
	return ret
}

func collectToolArgumentsByName(toolCalls []types.ToolCall) map[string][]string {
	if len(toolCalls) == 0 {
		return nil
	}
	ret := map[string][]string{}
	for _, call := range toolCalls {
		name := strings.TrimSpace(call.Function.Name)
		if name == "" {
			continue
		}
		ret[name] = append(ret[name], call.Function.Arguments)
	}
	return ret
}

func extractToolContentSegments(args []string, toolName string) ([]string, error) {
	if len(args) == 0 {
		return nil, nil
	}

	segments := make([]string, 0, len(args))
	for _, raw := range args {
		if strings.TrimSpace(raw) == "" {
			return nil, fmt.Errorf("%s 缺少参数", toolName)
		}
		var payload struct {
			Content string `json:"content"`
		}
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			return nil, fmt.Errorf("%s 参数解析失败: %w", toolName, err)
		}
		if strings.TrimSpace(payload.Content) == "" {
			return nil, fmt.Errorf("%s 的 content 不能为空", toolName)
		}
		segments = append(segments, payload.Content)
	}
	return segments, nil
}

func convertToolCallDeltasForCollector(magiCalls []types.ToolCallDelta) []utilstream.ToolCallDelta {
	result := make([]utilstream.ToolCallDelta, len(magiCalls))
	for i, tc := range magiCalls {
		result[i] = utilstream.ToolCallDelta{
			Index: tc.Index,
			ID:    tc.ID,
			Type:  tc.Type,
		}
		if tc.Function != nil {
			result[i].Function = &utilstream.ToolCallFunctionDelta{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			}
		}
	}
	return result
}
