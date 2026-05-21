package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/treenode"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	magiQueryArchiveDocRootHPath = "/MAGI查询结果"
	magiQueryArchiveDocAttr      = "custom-magi-query-archive-doc"
	magiQueryArchiveBlockAttr    = "custom-magi-query-archive"
	magiMemoryDocRootHPath       = "/MAGI记忆"
	magiMemoryDocAttr            = "custom-magi-memory-doc"
	magiMemoryBlockAttr          = "custom-magi-memory"
	magiMemoryKindAttr           = "custom-magi-memory-kind"
	magiToolCallIDAttr           = "custom-magi-tool-call-id"
	magiToolNameAttr             = "custom-magi-tool-name"
	magiRoundIDAttr              = "custom-magi-round-id"
	magiSessionIDAttr            = "custom-magi-session-id"
	magiSageAttr                 = "custom-magi-sage"
	magiPurposeAttr              = "custom-magi-purpose"
	magiSleepAtAttr              = "custom-magi-sleep-at"
	magiRestAtAttr               = "custom-magi-rest-at"
)

type queryToolArchiveLocation struct {
	BlockID  string
	DocID    string
	DocHPath string
}

type downtimeMemoryLocation struct {
	BlockID  string
	DocID    string
	DocHPath string
}

var persistQueryToolResultToNotebook = persistDetailedQueryToolResultToNotebook
var persistWannaDowntimeMemoryToNotebook = persistWannaDowntimeMemoryEntryToNotebook
var toolResultMemoryNow = time.Now

type noteSearchArchiveBlock struct {
	ID string `json:"id"`
}

type noteSearchArchiveResult struct {
	Blocks            []noteSearchArchiveBlock `json:"blocks"`
	MatchedBlockCount int                      `json:"matchedBlockCount"`
	MatchedRootCount  int                      `json:"matchedRootCount"`
}

func materializeToolResultForContext(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	if config.IsWannaSleepOrRestToolName(toolName) {
		return materializeWannaDowntimeToolResultForContext(sessionID, roundID, sage, toolCall, detailedResult)
	}
	if toolName == config.WriteDiaryToolName {
		return materializeDiaryToolResultForContext(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if toolName == config.CreateNoteDocumentToolName ||
		toolName == config.AppendNoteBlocksToolName ||
		toolName == config.ModifyNoteBlockToolName ||
		toolName == config.RevertNoteBlockToolName {
		return materializeNoteEditResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if toolName == config.ForgeDevRepoEditToolName {
		return materializeForgeDevRepoEditResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if toolName == config.ForgeDevRepoBatchReplaceToolName {
		return materializeForgeDevRepoBatchReplaceResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if toolName == config.ForgeDevRepoBashToolName {
		return materializeForgeDevRepoBashResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if toolName == config.AvatarBuildToolName ||
		toolName == config.AvatarModifyToolName ||
		toolName == config.AvatarSynthesizeToolName {
		return materializeAvatarToolResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if toolName == config.SendChannelMessageToolName {
		return materializeSendChannelMessageResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
	}
	if !isArchivedQueryTool(toolName) {
		return detailedResult
	}

	archiveLocation, err := persistQueryToolResultToNotebook(
		sessionID,
		roundID,
		sage,
		toolCall,
		assistantContent,
		detailedResult,
	)
	if err != nil {
		logging.LogWarnf("归档查询工具结果失败 [%s/%s]: %v", toolName, toolCall.ID, err)
	}

	_ = archiveLocation

	return detailedResult
}

// compressArchivedQueryResults 遍历上下文，压缩非 Melchior sage 的查询工具结果。
// 应按消息在上下文中的顺序扫描：先收集 assistant 消息中的 tool_calls，
// 再对匹配到的 tool 消息压缩，最后按 ID 原地更新。
func compressArchivedQueryResults(sessionID string, melchior, balthazar, casper *sages.Sage) {
	for _, sage := range []*sages.Sage{balthazar, casper} {
		if sage == nil || sage.GetName() == "melchior" {
			continue
		}
		messages := sage.GetContextForSession(sessionID)
		if len(messages) == 0 {
			continue
		}

		toolCallByID := map[string]types.ToolCall{}
		for _, msg := range messages {
			if msg.Role == types.RoleAssistant && len(msg.ToolCalls) > 0 {
				for _, tc := range msg.ToolCalls {
					toolCallByID[tc.ID] = tc
				}
			}
		}
		if len(toolCallByID) == 0 {
			continue
		}

		for _, msg := range messages {
			if msg.Role != types.RoleTool || msg.ToolID == "" {
				continue
			}
			tc, ok := toolCallByID[msg.ToolID]
			if !ok || !isArchivedQueryTool(tc.Function.Name) {
				continue
			}
			summary, err := buildCompactToolHistorySummary(tc, "", msg.Content, nil)
			if err != nil {
				logging.LogWarnf("compressArchivedQueryResults: %v", err)
				continue
			}
			if summary == msg.Content {
				continue
			}
			msg.Content = summary
			sage.UpdateContextMessage(sessionID, msg)
		}
	}
}

func isArchivedQueryTool(toolName string) bool {
	switch strings.TrimSpace(toolName) {
	case config.NoteKeywordSearchToolName,
		config.ForgeDevRepoListToolName,
		config.ForgeDevRepoReadToolName,
		config.ForgeDevRepoSearchToolName,
		config.NoteByIDReadToolName,
		config.FetchWebPageToolName:
		return true
	default:
		return false
	}
}

func persistDetailedQueryToolResultToNotebook(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	assistantContent string,
	detailedResult string,
) (*queryToolArchiveLocation, error) {
	accessScope, _ := resolveWorkspaceAIMainNotebookAccessScope()
	if accessScope == nil || accessScope.ActiveNotebook == nil || strings.TrimSpace(accessScope.ActiveNotebook.ID) == "" {
		return nil, nil
	}

	now := toolResultMemoryNow()
	docID, docHPath, err := ensureMagiQueryArchiveDoc(accessScope.ActiveNotebook.ID, now)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(docID) == "" {
		return nil, fmt.Errorf("未能定位查询结果归档文档")
	}

	markdown := buildQueryArchiveCalloutMarkdown(toolCall, assistantContent, detailedResult, now)
	blockID, err := appendMarkdownBlock(docID, markdown)
	if err != nil {
		return nil, err
	}

	attrs := map[string]string{
		magiQueryArchiveBlockAttr: "true",
		magiToolNameAttr:          strings.TrimSpace(toolCall.Function.Name),
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
	if purpose := truncatePurpose(inferToolCallPurpose(toolCall.Function.Name, assistantContent)); purpose != "" {
		attrs[magiPurposeAttr] = purpose
	}
	if err := model.SetBlockAttrs(blockID, attrs); err != nil {
		return nil, fmt.Errorf("设置查询结果归档块属性失败: %w", err)
	}

	return &queryToolArchiveLocation{
		BlockID:  blockID,
		DocID:    docID,
		DocHPath: docHPath,
	}, nil
}

func materializeWannaDowntimeToolResultForContext(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	now := toolResultMemoryNow()
	toolName := strings.TrimSpace(toolCall.Function.Name)
	isRest := config.IsWannaRestToolName(toolName)

	var args types.HeartbeatDowntimeTool
	if err := json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args); err != nil {
		logging.LogWarnf("解析 wanna_sleep 参数失败 [%s]: %v", toolCall.ID, err)
	}
	summary := strings.TrimSpace(args.Summary)

	if summary != "" {
		if _, err := persistWannaDowntimeMemoryToNotebook(sessionID, roundID, sage, toolCall, summary, now); err != nil {
			logging.LogWarnf("归档 wanna_sleep 记忆失败 [%s/%s]: %v", toolCall.Function.Name, toolCall.ID, err)
		}
	}

	payload := map[string]interface{}{}
	if trimmed := strings.TrimSpace(detailedResult); trimmed != "" {
		if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
			payload = map[string]interface{}{}
		}
	}
	if len(payload) == 0 {
		payload["ok"] = true
		if isRest {
			payload["state"] = "rested"
		} else {
			payload["state"] = "sleeping"
		}
	}
	if summary != "" {
		payload["summary"] = summary
	}
	if plan := strings.TrimSpace(args.NextStepPlan); plan != "" {
		payload["nextStepPlan"] = plan
	}
	if dreamScene := strings.TrimSpace(args.DreamScene); dreamScene != "" {
		payload["dreamScene"] = dreamScene
	}
	if reflection := strings.TrimSpace(args.Reflection); reflection != "" {
		payload["reflection"] = reflection
	}
	if mood := strings.TrimSpace(args.Mood); mood != "" {
		payload["mood"] = mood
	}
	if isRest {
		payload["restAt"] = now.Format(time.RFC3339)
	} else {
		payload["sleepAt"] = now.Format(time.RFC3339)
	}

	resultBytes, err := json.Marshal(payload)
	if err != nil {
		logging.LogWarnf("序列化 wanna_sleep 工具结果失败 [%s]: %v", toolCall.ID, err)
		return detailedResult
	}
	return string(resultBytes)
}

func persistWannaDowntimeMemoryEntryToNotebook(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	summary string,
	sleepAt time.Time,
) (*downtimeMemoryLocation, error) {
	accessScope, _ := resolveWorkspaceAIMainNotebookAccessScope()
	if accessScope == nil || accessScope.ActiveNotebook == nil || strings.TrimSpace(accessScope.ActiveNotebook.ID) == "" {
		return nil, nil
	}

	docID, docHPath, err := ensureMagiMemoryDoc(accessScope.ActiveNotebook.ID, sleepAt)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(docID) == "" {
		return nil, fmt.Errorf("未能定位 MAGI 记忆文档")
	}

	toolName := strings.TrimSpace(toolCall.Function.Name)
	isRest := config.IsWannaRestToolName(toolName)

	markdown := buildDowntimeNoteCalloutMarkdown(sessionID, roundID, sage, toolCall, summary, sleepAt)
	blockID, err := appendMarkdownBlock(docID, markdown)
	if err != nil {
		return nil, err
	}

	attrs := map[string]string{
		magiMemoryBlockAttr: "true",
		magiMemoryKindAttr:  toolName,
		magiToolNameAttr:    toolName,
	}
	if isRest {
		attrs[magiRestAtAttr] = sleepAt.Format(time.RFC3339)
	} else {
		attrs[magiSleepAtAttr] = sleepAt.Format(time.RFC3339)
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
	if err := model.SetBlockAttrs(blockID, attrs); err != nil {
		return nil, fmt.Errorf("设置 wanna_sleep 记忆块属性失败: %w", err)
	}

	return &downtimeMemoryLocation{
		BlockID:  blockID,
		DocID:    docID,
		DocHPath: docHPath,
	}, nil
}

func ensureMagiQueryArchiveDoc(boxID string, now time.Time) (docID, docHPath string, err error) {
	docHPath = path.Join(magiQueryArchiveDocRootHPath, now.Format("2006-01-02"))
	if root := treenode.GetBlockTreeRootByHPath(boxID, docHPath); root != nil {
		return root.ID, docHPath, nil
	}

	docID, err = model.CreateWithMarkdown("", boxID, docHPath, "", "", "", false, "", nil)
	if err != nil {
		return "", docHPath, fmt.Errorf("创建查询结果归档文档失败: %w", err)
	}
	if strings.TrimSpace(docID) == "" {
		if root := treenode.GetBlockTreeRootByHPath(boxID, docHPath); root != nil {
			docID = root.ID
		}
	}
	if strings.TrimSpace(docID) == "" {
		return "", docHPath, fmt.Errorf("创建查询结果归档文档后未拿到文档ID")
	}
	if err := model.SetBlockAttrs(docID, map[string]string{magiQueryArchiveDocAttr: "true"}); err != nil {
		logging.LogWarnf("设置查询结果归档文档属性失败 [%s]: %v", docID, err)
	}
	return docID, docHPath, nil
}

func ensureMagiMemoryDoc(boxID string, now time.Time) (docID, docHPath string, err error) {
	docHPath = path.Join(magiMemoryDocRootHPath, now.Format("2006-01-02"))
	if root := treenode.GetBlockTreeRootByHPath(boxID, docHPath); root != nil {
		return root.ID, docHPath, nil
	}

	docID, err = model.CreateWithMarkdown("", boxID, docHPath, "", "", "", false, "", nil)
	if err != nil {
		return "", docHPath, fmt.Errorf("创建 MAGI 记忆文档失败: %w", err)
	}
	if strings.TrimSpace(docID) == "" {
		if root := treenode.GetBlockTreeRootByHPath(boxID, docHPath); root != nil {
			docID = root.ID
		}
	}
	if strings.TrimSpace(docID) == "" {
		return "", docHPath, fmt.Errorf("创建 MAGI 记忆文档后未拿到文档ID")
	}
	if err := model.SetBlockAttrs(docID, map[string]string{magiMemoryDocAttr: "true"}); err != nil {
		logging.LogWarnf("设置 MAGI 记忆文档属性失败 [%s]: %v", docID, err)
	}
	return docID, docHPath, nil
}

func appendMarkdownBlock(parentID string, markdown string) (string, error) {
	parentID = strings.TrimSpace(parentID)
	if parentID == "" {
		return "", fmt.Errorf("归档父块ID不能为空")
	}
	dom := util.NewLute().Md2BlockDOM(markdown, false)
	transactions := []*model.Transaction{
		{
			DoOperations: []*model.Operation{
				{
					Action:   "appendInsert",
					Data:     dom,
					ParentID: parentID,
				},
			},
		},
	}
	model.PerformTransactions(&transactions)
	model.FlushTxQueue()

	if len(transactions) == 0 || len(transactions[0].DoOperations) == 0 {
		return "", fmt.Errorf("归档查询结果时未生成事务")
	}
	blockID := strings.TrimSpace(transactions[0].DoOperations[0].ID)
	if blockID == "" {
		return "", fmt.Errorf("归档查询结果后未拿到块ID")
	}
	return blockID, nil
}

func buildDowntimeNoteCalloutMarkdown(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	summary string,
	sleepAt time.Time,
) string {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	isRest := config.IsWannaRestToolName(toolName)

	var calloutType, title string
	if isRest {
		title = "工作日志"
		if sage != nil {
			title = sage.GetDisplayName() + " 工作日志"
		}
		calloutType = "NOTE"
	} else {
		title = "睡前笔记"
		if sage != nil {
			title = sage.GetDisplayName() + " 睡前笔记"
		}
		calloutType = "DREAM"
	}

	timeLabel := "记录时间"
	if !isRest {
		timeLabel = "睡眠时间"
	}

	fields := []CalloutField{
		{Label: "摘要", Value: summary},
	}
	if sage != nil {
		fields = append(fields, CalloutField{Label: "贤者", Value: sage.GetDisplayName()})
	}
	fields = append(fields,
		CalloutField{Label: "工具", Value: toolName},
		CalloutField{Label: timeLabel, Value: sleepAt.Format(time.RFC3339)},
	)
	if strings.TrimSpace(sessionID) != "" {
		fields = append(fields, CalloutField{Label: "会话", Value: strings.TrimSpace(sessionID)})
	}
	if strings.TrimSpace(roundID) != "" {
		fields = append(fields, CalloutField{Label: "轮次", Value: strings.TrimSpace(roundID)})
	}
	if isRest {
		return BuildCalloutMarkdown(calloutType, "📋 "+title, fields...)
	}
	return BuildCalloutMarkdown(calloutType, "🌙 "+title, fields...)
}

func buildQueryArchiveCalloutMarkdown(
	toolCall types.ToolCall,
	assistantContent string,
	detailedResult string,
	now time.Time,
) string {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	purpose := inferToolCallPurpose(toolName, assistantContent)
	storedAt := now.Format(time.RFC3339)

	switch toolName {
	case config.NoteKeywordSearchToolName:
		return buildNoteSearchArchiveCallout(toolCall, purpose, detailedResult, storedAt)
	case config.ForgeDevRepoListToolName:
		return buildForgeArchiveCallout("代码仓库目录查看", purpose, toolCall, detailedResult, storedAt)
	case config.ForgeDevRepoReadToolName:
		return buildForgeArchiveCallout("代码仓库文件读取", purpose, toolCall, detailedResult, storedAt)
	case config.ForgeDevRepoSearchToolName:
		return buildForgeArchiveCallout("代码仓库文本搜索", purpose, toolCall, detailedResult, storedAt)
	case config.FetchWebPageToolName:
		return buildWebFetchArchiveCallout(toolCall, purpose, storedAt)
	default:
		return buildGenericArchiveCallout(toolName, purpose, storedAt)
	}
}

func buildNoteSearchArchiveCallout(toolCall types.ToolCall, purpose, detailedResult, storedAt string) string {
	var args struct {
		Query string `json:"query"`
	}
	_ = json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args)

	var result noteSearchArchiveResult
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &result)

	fields := []CalloutField{
		{Label: "查询", Value: strings.TrimSpace(args.Query)},
		{Label: "搜索目的", Value: purpose},
		{Label: "匹配块数", Value: strconv.Itoa(len(result.Blocks)) + "（共 " + strconv.Itoa(result.MatchedBlockCount) + " 个命中）"},
		{Label: "搜索时间", Value: storedAt},
	}

	if len(result.Blocks) > 0 {
		var ids []string
		for _, block := range result.Blocks {
			if trimmed := strings.TrimSpace(block.ID); trimmed != "" {
				ids = append(ids, "'"+trimmed+"'")
			}
		}
		if len(ids) > 0 {
			embedSQL := "{{ select * from blocks where id in (" + strings.Join(ids, ", ") + ") }}"
			fields = append(fields, CalloutField{Label: "结果", Value: embedSQL})
		}
	}

	return BuildCalloutMarkdown("QUERY_RESULT", "笔记关键词搜索", fields...)
}

func buildForgeArchiveCallout(displayName, purpose string, toolCall types.ToolCall, detailedResult, storedAt string) string {
	fields := []CalloutField{
		{Label: "搜索目的", Value: purpose},
		{Label: "搜索时间", Value: storedAt},
	}

	pathPrefix := extractForgeArchivePath(toolCall, detailedResult)
	if pathPrefix != "" {
		fields = append(fields, CalloutField{Label: "路径", Value: pathPrefix})
	}

	matchCount := extractForgeArchiveMatchCount(detailedResult)
	if matchCount >= 0 {
		fields = append(fields, CalloutField{Label: "匹配数", Value: strconv.Itoa(matchCount)})
	}

	return BuildCalloutMarkdown("QUERY_RESULT", displayName, fields...)
}

func buildGenericArchiveCallout(toolName, purpose, storedAt string) string {
	return BuildCalloutMarkdown("QUERY_RESULT", toolName,
		CalloutField{Label: "搜索目的", Value: purpose},
		CalloutField{Label: "搜索时间", Value: storedAt},
	)
}

func buildWebFetchArchiveCallout(toolCall types.ToolCall, purpose, storedAt string) string {
	var args struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args)

	fields := []CalloutField{
		{Label: "URL", Value: strings.TrimSpace(args.URL)},
		{Label: "获取目的", Value: purpose},
		{Label: "获取时间", Value: storedAt},
	}
	return BuildCalloutMarkdown("QUERY_RESULT", "网页内容获取", fields...)
}

func extractForgeArchivePath(toolCall types.ToolCall, detailedResult string) string {
	pathValue := extractForgePathFromArgs(toolCall.Function.Arguments)
	if pathValue != "" {
		return pathValue
	}
	return extractForgePathFromPayload(detailedResult)
}

func extractForgePathFromArgs(rawArgs string) string {
	input, _ := parseForgeDevRepoPlainInput(rawArgs)
	if input == nil {
		return ""
	}
	return input.primary("path", "")
}

func extractForgePathFromPayload(detailedResult string) string {
	var payload struct {
		Path string `json:"path"`
	}
	if err := json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload); err != nil {
		return ""
	}
	return strings.TrimSpace(payload.Path)
}

func extractForgeArchiveMatchCount(detailedResult string) int {
	trimmed := strings.TrimSpace(detailedResult)
	if trimmed == "" {
		return -1
	}

	var listPayload struct {
		Entries []struct{} `json:"entries"`
	}
	if err := json.Unmarshal([]byte(trimmed), &listPayload); err == nil {
		return len(listPayload.Entries)
	}

	var searchPayload struct {
		Matches []struct{} `json:"matches"`
	}
	if err := json.Unmarshal([]byte(trimmed), &searchPayload); err == nil {
		return len(searchPayload.Matches)
	}

	return -1
}

func buildCompactToolHistorySummary(
	toolCall types.ToolCall,
	assistantContent string,
	detailedResult string,
	location *queryToolArchiveLocation,
) (string, error) {
	toolName := strings.TrimSpace(toolCall.Function.Name)
	purpose := inferToolCallPurpose(toolName, assistantContent)
	var summary map[string]interface{}

	switch toolName {
	case config.NoteKeywordSearchToolName:
		summary = buildNoteQueryHistorySummary(toolCall, purpose, detailedResult, location)
	case config.ForgeDevRepoListToolName:
		summary = buildForgeListHistorySummary(toolCall, purpose, detailedResult, location)
	case config.ForgeDevRepoReadToolName:
		summary = buildForgeReadHistorySummary(toolCall, purpose, detailedResult, location)
	case config.ForgeDevRepoSearchToolName:
		summary = buildForgeSearchHistorySummary(toolCall, purpose, detailedResult, location)
	case config.NoteByIDReadToolName:
		summary = buildNoteByIDReadHistorySummary(toolCall, purpose, detailedResult, location)
	case config.FetchWebPageToolName:
		summary = buildWebFetchHistorySummary(toolCall, purpose, detailedResult, location)
	default:
		return detailedResult, nil
	}

	summaryBytes, err := json.Marshal(summary)
	if err != nil {
		return "", err
	}
	return string(summaryBytes), nil
}

func buildNoteQueryHistorySummary(
	toolCall types.ToolCall,
	purpose string,
	detailedResult string,
	location *queryToolArchiveLocation,
) map[string]interface{} {
	var args noteKeywordSearchToolArgs
	_ = json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args)

	var payload struct {
		Blocks []struct {
			ID     string `json:"id"`
			RootID string `json:"rootID"`
		} `json:"blocks"`
		RestrictedDocumentIDs []string `json:"restrictedDocumentIDs"`
	}
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload)

	noteIDs := make([]string, 0, len(payload.Blocks)+len(payload.RestrictedDocumentIDs))
	seen := map[string]struct{}{}
	for _, block := range payload.Blocks {
		noteID := strings.TrimSpace(block.RootID)
		if noteID == "" {
			noteID = strings.TrimSpace(block.ID)
		}
		if noteID == "" {
			continue
		}
		if _, ok := seen[noteID]; ok {
			continue
		}
		seen[noteID] = struct{}{}
		noteIDs = append(noteIDs, noteID)
	}
	for _, noteID := range payload.RestrictedDocumentIDs {
		noteID = strings.TrimSpace(noteID)
		if noteID == "" {
			continue
		}
		if _, ok := seen[noteID]; ok {
			continue
		}
		seen[noteID] = struct{}{}
		noteIDs = append(noteIDs, noteID)
	}

	summary := map[string]interface{}{
		"purpose": purpose,
		"query": map[string]interface{}{
			"query": strings.TrimSpace(args.Query),
			"limit": normalizeNoteKeywordSearchLimit(args.Limit),
		},
		"noteIDs": noteIDs,
	}
	if location != nil && location.BlockID != "" {
		summary["archiveBlockID"] = location.BlockID
	}
	return summary
}

func buildForgeListHistorySummary(
	toolCall types.ToolCall,
	purpose string,
	detailedResult string,
	location *queryToolArchiveLocation,
) map[string]interface{} {
	input, _ := parseForgeDevRepoPlainInput(toolCall.Function.Arguments)
	queryPath := "."
	limit := defaultForgeDevRepoListLimit
	if input != nil {
		queryPath = input.primary("path", ".")
		if parsedLimit, err := input.intValue("limit", defaultForgeDevRepoListLimit, maxForgeDevRepoListLimit); err == nil {
			limit = parsedLimit
		}
	}

	var payload forgeDevRepoListPayload
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload)

	paths := make([]string, 0, len(payload.Entries))
	for _, entry := range payload.Entries {
		entryPath := strings.TrimSpace(entry.Name)
		if payload.Path != "" && payload.Path != "." {
			entryPath = path.Join(payload.Path, entryPath)
		}
		paths = append(paths, entryPath)
	}

	summary := map[string]interface{}{
		"purpose": purpose,
		"query": map[string]interface{}{
			"path":  queryPath,
			"limit": limit,
		},
		"paths": dedupeStrings(paths),
	}
	if location != nil && location.BlockID != "" {
		summary["archiveBlockID"] = location.BlockID
	}
	return summary
}

func buildForgeReadHistorySummary(
	toolCall types.ToolCall,
	purpose string,
	detailedResult string,
	location *queryToolArchiveLocation,
) map[string]interface{} {
	input, _ := parseForgeDevRepoPlainInput(toolCall.Function.Arguments)
	queryPath := ""
	start := defaultForgeDevRepoReadStart
	limit := defaultForgeDevRepoReadLimit
	if input != nil {
		queryPath = input.primary("path", "")
		if parsedStart, err := input.intValue("start", defaultForgeDevRepoReadStart, 0); err == nil {
			start = parsedStart
		}
		if parsedLimit, err := input.intValue("limit", defaultForgeDevRepoReadLimit, maxForgeDevRepoReadLimit); err == nil {
			limit = parsedLimit
		}
	}

	var payload forgeDevRepoReadPayload
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload)

	readPath := strings.TrimSpace(payload.Path)
	if readPath == "" {
		readPath = queryPath
	}

	summary := map[string]interface{}{
		"purpose": purpose,
		"query": map[string]interface{}{
			"path":  queryPath,
			"start": start,
			"limit": limit,
		},
		"paths": dedupeStrings([]string{readPath}),
	}
	if payload.Content != "" {
		contentRunes := []rune(payload.Content)
		if len(contentRunes) > 1000 {
			summary["contentPreview"] = string(contentRunes[:1000]) + "..."
			summary["truncatedHint"] = "内容较长已截断，重新调用读取工具可获取完整内容"
		} else {
			summary["contentPreview"] = payload.Content
		}
	}
	if location != nil && location.BlockID != "" {
		summary["archiveBlockID"] = location.BlockID
	}
	return summary
}

func buildForgeSearchHistorySummary(
	toolCall types.ToolCall,
	purpose string,
	detailedResult string,
	location *queryToolArchiveLocation,
) map[string]interface{} {
	input, _ := parseForgeDevRepoPlainInput(toolCall.Function.Arguments)
	queryPath := "."
	pattern := ""
	limit := defaultForgeDevRepoSearchLimit
	ignoreCase := false
	if input != nil {
		queryPath = input.primary("path", ".")
		pattern = input.primary("pattern", "")
		if parsedLimit, err := input.intValue("limit", defaultForgeDevRepoSearchLimit, maxForgeDevRepoSearchLimit); err == nil {
			limit = parsedLimit
		}
		if parsedIgnoreCase, err := input.boolValue("ignorecase", false); err == nil {
			ignoreCase = parsedIgnoreCase
		}
	}

	var payload forgeDevRepoSearchPayload
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload)

	paths := make([]string, 0, len(payload.Matches))
	for _, match := range payload.Matches {
		paths = append(paths, strings.TrimSpace(match.Path))
	}

	summary := map[string]interface{}{
		"purpose": purpose,
		"query": map[string]interface{}{
			"path":       queryPath,
			"pattern":    pattern,
			"limit":      limit,
			"ignoreCase": ignoreCase,
		},
		"paths": dedupeStrings(paths),
	}
	if location != nil && location.BlockID != "" {
		summary["archiveBlockID"] = location.BlockID
	}
	return summary
}

func inferToolCallPurpose(toolName string, assistantContent string) string {
	compact := strings.TrimSpace(strings.Join(strings.Fields(assistantContent), " "))
	if compact != "" {
		return truncatePurpose(compact)
	}

	switch strings.TrimSpace(toolName) {
	case config.NoteKeywordSearchToolName:
		return "检索相关笔记以支撑当前判断"
	case config.ForgeDevRepoListToolName:
		return "查看目录结构以定位相关文件"
	case config.ForgeDevRepoReadToolName:
		return "读取文件内容以提取实现细节"
	case config.ForgeDevRepoSearchToolName:
		return "搜索仓库文本以定位相关实现"
	case config.FetchWebPageToolName:
		return "获取网页内容以获取外部信息"
	default:
		return "支撑当前分析"
	}
}

func truncatePurpose(text string) string {
	text = strings.TrimSpace(text)
	if text == "" {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= 120 {
		return text
	}
	return string(runes[:120]) + "..."
}

func decodeJSONOrString(raw string) interface{} {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	var decoded interface{}
	if err := json.Unmarshal([]byte(trimmed), &decoded); err == nil {
		return decoded
	}
	return trimmed
}

func dedupeStrings(values []string) []string {
	ret := make([]string, 0, len(values))
	seen := map[string]struct{}{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		ret = append(ret, value)
	}
	return ret
}

func buildNoteByIDReadHistorySummary(
	toolCall types.ToolCall,
	purpose string,
	detailedResult string,
	location *queryToolArchiveLocation,
) map[string]interface{} {
	var args noteByIDReadToolArgs
	_ = json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args)

	format := normalizeNoteByIDReadFormat(args.Format)

	var payload struct {
		ID               string `json:"id"`
		RootID           string `json:"rootID"`
		Format           string `json:"format"`
		Type             string `json:"type"`
		TotalChildren    int    `json:"totalChildren"`
		ReturnedChildren int    `json:"returnedChildren"`
		HasMoreChildren  bool   `json:"hasMoreChildren"`
		RestrictedDoc    string `json:"restrictedDocument"`
	}
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload)

	query := map[string]interface{}{
		"blockID": args.ID,
	}
	if args.Start > 0 {
		query["start"] = args.Start
	}
	if args.Limit > 0 {
		query["limit"] = args.Limit
	}
	if format != "tree" {
		query["format"] = format
	}

	summary := map[string]interface{}{
		"purpose":    purpose,
		"query":      query,
		"blockID":    payload.ID,
		"rereadHint": fmt.Sprintf("笔记详细内容可通过 %s 按此 ID 重新获取", config.NoteByIDReadToolName),
	}
	if payload.RootID != "" {
		summary["rootID"] = payload.RootID
	}
	if payload.RestrictedDoc != "" {
		summary["restrictedDocument"] = payload.RestrictedDoc
	} else if payload.Format != "" {
		summary["format"] = payload.Format
		if payload.Format == "tree" && payload.Type != "" {
			summary["type"] = payload.Type
		}
		if payload.TotalChildren > 0 {
			summary["children"] = map[string]interface{}{
				"total":    payload.TotalChildren,
				"returned": payload.ReturnedChildren,
				"hasMore":  payload.HasMoreChildren,
			}
		}
	}
	if location != nil && location.BlockID != "" {
		summary["archiveBlockID"] = location.BlockID
	}
	return summary
}

func buildWebFetchHistorySummary(
	toolCall types.ToolCall,
	purpose string,
	detailedResult string,
	location *queryToolArchiveLocation,
) map[string]interface{} {
	var args struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args)

	var payload fetchWebPageResultPayload
	_ = json.Unmarshal([]byte(strings.TrimSpace(detailedResult)), &payload)

	summary := map[string]interface{}{
		"purpose": purpose,
		"query": map[string]interface{}{
			"url": strings.TrimSpace(args.URL),
		},
	}
	if payload.FilePath != "" {
		summary["filePath"] = payload.FilePath
	}
	if payload.Title != "" {
		summary["title"] = payload.Title
	}
	if payload.CharCount > 0 {
		summary["charCount"] = payload.CharCount
	}
	if location != nil && location.BlockID != "" {
		summary["archiveBlockID"] = location.BlockID
	}
	return summary
}
