package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	defaultDiaryCalloutType = "NOTE"
	magiDiaryBlockAttr      = "custom-magi-diary-entry"
)

type diaryToolEntryLocation struct {
	BlockID string
	DocID   string
	DocPath string
}

type diaryToolResultExecutor struct{}

var persistDiaryToolEntryToDailyNote = persistDiaryToolEntryToAIMainDailyNote
var createDiaryToolDailyNote = model.CreateDailyNote
var setDiaryToolBlockAttrs = model.SetBlockAttrs

func newDiaryToolResultExecutor() *diaryToolResultExecutor {
	return &diaryToolResultExecutor{}
}

func (e *diaryToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.WriteDiaryToolName {
		return "", false, nil
	}

	args, err := parseWriteDiaryToolArgs(toolCall.Function.Arguments)
	if err != nil {
		return "", true, err
	}

	if links, valid := validateNoteToolContent(config.WriteDiaryToolName, toolCall.Function.Arguments); !valid {
		return marshalLinkInsufficientResult(config.WriteDiaryToolName, links), true, nil
	}

	payload := map[string]interface{}{
		"ok":          true,
		"state":       "pending_write",
		"calloutType": normalizeDiaryCalloutType(args.CalloutType),
	}
	if motivation := normalizeGovernedActionMotivation(args.Motivation); motivation != "" {
		payload["motivation"] = motivation
	}
	if title := normalizeDiaryTitle(args.Title); title != "" {
		payload["title"] = title
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return "", true, marshalErr
	}
	return string(resultBytes), true, nil
}

func parseWriteDiaryToolArgs(rawArgs string) (*types.WriteDiaryTool, error) {
	rawArgs = strings.TrimSpace(rawArgs)
	if rawArgs == "" {
		return nil, fmt.Errorf("%s 参数不能为空", config.WriteDiaryToolName)
	}

	var args types.WriteDiaryTool
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return nil, fmt.Errorf("%s 参数解析失败: %w", config.WriteDiaryToolName, err)
	}

	args.Motivation = normalizeGovernedActionMotivation(args.Motivation)
	args.Markdown = normalizeDiaryMarkdown(args.Markdown)
	args.CalloutType = normalizeDiaryCalloutType(args.CalloutType)
	args.Title = normalizeDiaryTitle(args.Title)

	if args.Motivation == "" {
		return nil, fmt.Errorf("%s 的 motivation 不能为空", config.WriteDiaryToolName)
	}
	if strings.TrimSpace(args.Markdown) == "" {
		return nil, fmt.Errorf("%s 的 markdown 不能为空", config.WriteDiaryToolName)
	}
	if strings.Contains(args.CalloutType, "]") {
		return nil, fmt.Errorf("%s 的 calloutType 不能包含 ]", config.WriteDiaryToolName)
	}
	return &args, nil
}

func materializeDiaryToolResultForContext(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	args, err := parseWriteDiaryToolArgs(toolCall.Function.Arguments)
	if err != nil {
		return marshalDiaryToolFailure(err)
	}

	payload := map[string]interface{}{}
	if trimmed := strings.TrimSpace(detailedResult); trimmed != "" {
		_ = json.Unmarshal([]byte(trimmed), &payload)
	}
	if len(payload) == 0 {
		payload["ok"] = true
		payload["state"] = "pending_write"
	}

	if state, _ := payload["state"].(string); state == "link_insufficient" {
		return detailedResult
	}

	if outcome, governed, voteErr := dominantActionToolGovernance.EvaluateActionVote(
		ctx,
		sessionID,
		roundID,
		sage,
		assistantContent,
		toolCall,
	); voteErr != nil {
		return marshalDiaryToolFailure(voteErr)
	} else if governed {
		if outcome != nil && outcome.Rejected {
			return marshalGovernedActionToolRejection(toolCall.Function.Name, payload, outcome)
		}
	}

	location, err := persistDiaryToolEntryToDailyNote(sessionID, roundID, sage, toolCall, args)
	if err != nil {
		return marshalDiaryToolFailure(err)
	}

	payload["ok"] = true
	payload["state"] = "written"
	payload["calloutType"] = args.CalloutType
	payload["motivation"] = args.Motivation
	if args.Title != "" {
		payload["title"] = args.Title
	}
	if location != nil {
		if location.BlockID != "" {
			payload["blockId"] = location.BlockID
		}
		if location.DocID != "" {
			payload["docId"] = location.DocID
		}
		if location.DocPath != "" {
			payload["docPath"] = location.DocPath
		}
	}

	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return marshalDiaryToolFailure(marshalErr)
	}
	return string(resultBytes)
}
func marshalGovernedActionToolRejection(
	toolName string,
	payload map[string]interface{},
	outcome *governedActionVoteOutcome,
) string {
	if payload == nil {
		payload = map[string]interface{}{}
	}
	payload["ok"] = false
	payload["toolName"] = strings.TrimSpace(toolName)
	payload["reviewSummary"] = "该行动已被专家团队否决。"
	if outcome != nil && len(outcome.RejectionReasons) > 0 {
		payload["rejectionReasons"] = outcome.RejectionReasons
	}
	if outcome != nil && outcome.LostDominance {
		payload["state"] = "dominance_revoked"
		payload["remainingAttempts"] = 0
		payload["instruction"] = "连续两次未获批准，当前轮次将改由其他处理路径继续。"
	} else {
		payload["state"] = "rejected"
		payload["remainingAttempts"] = 1
		payload["instruction"] = buildGovernedActionRetryPrompt(config.WriteDiaryToolName)
	}

	resultBytes, err := json.Marshal(payload)
	if err != nil {
		if outcome != nil && outcome.LostDominance {
			return `{"ok":false,"state":"dominance_revoked"}`
		}
		return `{"ok":false,"state":"rejected"}`
	}
	return string(resultBytes)
}

func persistDiaryToolEntryToAIMainDailyNote(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	args *types.WriteDiaryTool,
) (*diaryToolEntryLocation, error) {
	if args == nil {
		return nil, fmt.Errorf("日记工具参数不能为空")
	}

	accessScope, accessErr := resolveWorkspaceAIMainNotebookAccessScope()
	if accessErr != nil {
		msg := strings.TrimSpace(buildNoteKeywordScopeMessage(accessScope, accessErr))
		if msg == "" {
			msg = accessErr.Error()
		}
		return nil, fmt.Errorf("%s", msg)
	}
	if accessScope == nil || accessScope.ActiveNotebook == nil || strings.TrimSpace(accessScope.ActiveNotebook.ID) == "" {
		return nil, fmt.Errorf("当前工作空间还没有 AI 主笔记本，无法写入日记")
	}

	docPath, _, err := createDiaryToolDailyNote(accessScope.ActiveNotebook.ID)
	if err != nil {
		return nil, fmt.Errorf("创建 AI 主笔记本日记失败: %w", err)
	}
	docID := strings.TrimSpace(util.GetTreeID(docPath))
	if docID == "" {
		return nil, fmt.Errorf("无法从日记路径解析文档 ID")
	}

	blockID, err := appendMarkdownBlock(docID, buildDiaryCalloutMarkdown(args))
	if err != nil {
		return nil, fmt.Errorf("追加日记 callout 失败: %w", err)
	}

	attrs := map[string]string{
		magiDiaryBlockAttr: "true",
		magiMemoryKindAttr: "diary",
		magiToolNameAttr:   strings.TrimSpace(toolCall.Function.Name),
	}
	if args.CalloutType != "" {
		attrs["custom-magi-diary-callout-type"] = args.CalloutType
	}
	if args.Title != "" {
		attrs["custom-magi-diary-title"] = args.Title
	}
	if strings.TrimSpace(toolCall.ID) != "" {
		attrs[magiToolCallIDAttr] = strings.TrimSpace(toolCall.ID)
	}
	if strings.TrimSpace(roundID) != "" {
		attrs[magiRoundIDAttr] = strings.TrimSpace(roundID)
	}
	if strings.TrimSpace(sessionID) != "" {
		attrs[magiSessionIDAttr] = strings.TrimSpace(sessionID)
	}
	if sage != nil && strings.TrimSpace(sage.GetName()) != "" {
		attrs[magiSageAttr] = strings.TrimSpace(sage.GetName())
	}
	if err := setDiaryToolBlockAttrs(blockID, attrs); err != nil {
		return nil, fmt.Errorf("设置日记块属性失败: %w", err)
	}

	return &diaryToolEntryLocation{
		BlockID: blockID,
		DocID:   docID,
		DocPath: docPath,
	}, nil
}

func buildDiaryCalloutMarkdown(args *types.WriteDiaryTool) string {
	if args == nil {
		return ""
	}
	return BuildCalloutMarkdown(
		normalizeDiaryCalloutType(args.CalloutType),
		normalizeDiaryTitle(args.Title),
		CalloutField{Value: normalizeDiaryMarkdown(args.Markdown)},
	)
}

func normalizeDiaryMarkdown(markdown string) string {
	markdown = strings.ReplaceAll(markdown, "\r\n", "\n")
	markdown = strings.ReplaceAll(markdown, "\r", "\n")
	return markdown
}

func normalizeDiaryCalloutType(calloutType string) string {
	calloutType = strings.TrimSpace(strings.Join(strings.Fields(calloutType), " "))
	if calloutType == "" {
		return defaultDiaryCalloutType
	}
	return calloutType
}

func normalizeDiaryTitle(title string) string {
	return strings.TrimSpace(strings.Join(strings.Fields(title), " "))
}

func marshalDiaryToolFailure(err error) string {
	payload := map[string]interface{}{
		"ok":    false,
		"state": "write_failed",
	}
	if err != nil {
		payload["error"] = err.Error()
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return `{"ok":false,"state":"write_failed"}`
	}
	return string(resultBytes)
}
