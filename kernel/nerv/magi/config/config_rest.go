package config

const (
	WannaRestPlanToolName   = "wanna_rest_plan"
	WannaRestDreamToolName  = "wanna_rest_dream"
	WannaRestRecordToolName = "wanna_rest_record"
	WannaRestMergedRecordName = "wanna_rest_merged"
	WannaRestLabel          = "工作日志工具"
)

// BuildWannaRestPlanToolDef 构建非休眠时段 Melchior 的工作日志工具定义。
func BuildWannaRestPlanToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaRestPlanToolName,
			Description: "仅在心跳唤醒轮次可用（非休眠时段）。表示本轮工作告一段落，需要记录这几轮的工作总结与下一轮的工作计划。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "本轮已完成的主要工作总结。",
					},
					"nextStepPlan": map[string]interface{}{
						"type":        "string",
						"description": "下一轮行动的具体工作计划。",
					},
				},
				"required": []string{"summary", "nextStepPlan"},
			},
		},
	}
}

// BuildWannaRestDreamToolDef 构建非休眠时段 Balthazar 的工作日志工具定义。
func BuildWannaRestDreamToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaRestDreamToolName,
			Description: "仅在心跳唤醒轮次可用（非休眠时段）。描述当前工作情境的画面氛围与心情感受。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "画面描述与心情的总体摘要。",
					},
					"mood": map[string]interface{}{
						"type":        "string",
						"description": "当前工作心情或感受的细致描述。",
					},
				},
				"required": []string{"summary", "mood"},
			},
		},
	}
}

// BuildWannaRestRecordToolDef 构建非休眠时段 Casper 的工作日志工具定义。
func BuildWannaRestRecordToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        WannaRestRecordToolName,
			Description: "仅在心跳唤醒轮次可用（非休眠时段）。记录本轮的观察所得与备注。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"summary": map[string]interface{}{
						"type":        "string",
						"description": "本轮观察所得与备注的总体摘要。",
					},
				},
				"required": []string{"summary"},
			},
		},
	}
}

// IsWannaRestToolName 判断是否非休眠时段的工作日志工具名。
func IsWannaRestToolName(name string) bool {
	switch name {
	case WannaRestPlanToolName, WannaRestDreamToolName, WannaRestRecordToolName:
		return true
	default:
		return false
	}
}

// IsWannaSleepOrRestToolName 判断是否是休眠或工作日志工具名之一。
func IsWannaSleepOrRestToolName(name string) bool {
	return IsWannaSleepToolName(name) || IsWannaRestToolName(name)
}

// ResolveWannaRestToolNameForSage 根据贤者名称返回对应的非休眠工作日志工具名。
func ResolveWannaRestToolNameForSage(sageName string) string {
	switch sageName {
	case "melchior":
		return WannaRestPlanToolName
	case "balthazar":
		return WannaRestDreamToolName
	case "casper":
		return WannaRestRecordToolName
	default:
		return ""
	}
}
