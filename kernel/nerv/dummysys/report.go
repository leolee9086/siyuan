package dummysys

import (
	"encoding/json"

	"github.com/sashabaranov/go-openai"
)

const ReportToolName = "report_to_core"

type ReportType string

const (
	ReportTypeHeartbeat ReportType = "heartbeat"
	ReportTypeProgress  ReportType = "progress"
	ReportTypeRisk      ReportType = "risk"
	ReportTypeSummary   ReportType = "summary"
)

type ReportUrgency string

const (
	ReportUrgencyLow    ReportUrgency = "low"
	ReportUrgencyMedium ReportUrgency = "medium"
	ReportUrgencyHigh   ReportUrgency = "high"
)

type ReportPayload struct {
	Type        ReportType    `json:"type"`
	Environment string        `json:"environment"`
	Lessons     string        `json:"lessons"`
	Content     string        `json:"content,omitempty"`
	Urgency     ReportUrgency `json:"urgency,omitempty"`
}

type ReportEvent struct {
	Payload ReportPayload
	RawJSON string
}

type ReportCallback func(event ReportEvent)

func BuildReportToolDefinition() openai.Tool {
	return openai.Tool{
		Type: "function",
		Function: &openai.FunctionDefinition{
			Name:        ReportToolName,
			Description: "向MAGI核心汇报当前工作情况与状态。你必须定期调用此工具来报告心跳、进度、风险或总结。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"type": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"heartbeat", "progress", "risk", "summary"},
						"description": "报告类型: heartbeat=心跳, progress=进度, risk=风险, summary=总结",
					},
					"environment": map[string]interface{}{
						"type":        "string",
						"description": "当前工作的环境/上下文描述（简洁）",
					},
					"lessons": map[string]interface{}{
						"type":        "string",
						"description": "本轮经验和教训（简洁）",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "可选补充说明",
					},
					"urgency": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"low", "medium", "high"},
						"description": "紧急程度: low=常规, medium=注意, high=紧急",
					},
				},
				"required": []string{"type", "environment", "lessons"},
			},
		},
	}
}

func parseReportPayloads(rawArgs []string) []ReportEvent {
	var events []ReportEvent
	for _, raw := range rawArgs {
		var payload ReportPayload
		if err := json.Unmarshal([]byte(raw), &payload); err != nil {
			continue
		}
		events = append(events, ReportEvent{
			Payload: payload,
			RawJSON: raw,
		})
	}
	return events
}
