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
)

type queryToolArchiveLocation struct {
	BlockID  string
	DocID    string
	DocHPath string
}

type wannaSleepMemoryLocation struct {
	BlockID  string
	DocID    string
	DocHPath string
}

var persistQueryToolResultToNotebook = persistDetailedQueryToolResultToNotebook
var persistWannaSleepMemoryToNotebook = persistWannaSleepMemoryEntryToNotebook
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
	if config.IsWannaSleepToolName(toolName) {
		return materializeWannaSleepToolResultForContext(sessionID, roundID, sage, toolCall, detailedResult)
	}
	if toolName == config.WriteDiaryToolName {
		return materializeDiaryToolResultForContext(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
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

	if sage != nil && sage.GetName() == "melchior" {
		return detailedResult
	}

	summary, err := buildCompactToolHistorySummary(toolCall, assistantContent, detailedResult, archiveLocation)
	if err != nil {
		logging.LogWarnf("构建查询工具历史摘要失败 [%s/%s]: %v", toolName, toolCall.ID, err)
		return detailedResult
	}
	return summary
}

func isArchivedQueryTool(toolName string) bool {
	switch strings.TrimSpace(toolName) {
	case config.NoteKeywordSearchToolName,
		config.ForgeDevRepoListToolName,
		config.ForgeDevRepoReadToolName,
		config.ForgeDevRepoSearchToolName,
		config.NoteByIDReadToolName:
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

func materializeWannaSleepToolResultForContext(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	sleepAt := toolResultMemoryNow()

	var args types.WannaSleepTool
	if err := json.Unmarshal([]byte(strings.TrimSpace(toolCall.Function.Arguments)), &args); err != nil {
		logging.LogWarnf("解析 wanna_sleep 参数失败 [%s]: %v", toolCall.ID, err)
	}
	summary := strings.TrimSpace(args.Summary)

	if summary != "" {
		if _, err := persistWannaSleepMemoryToNotebook(sessionID, roundID, sage, toolCall, summary, sleepAt); err != nil {
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
		payload["state"] = "sleeping"
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
	payload["sleepAt"] = sleepAt.Format(time.RFC3339)

	resultBytes, err := json.Marshal(payload)
	if err != nil {
		logging.LogWarnf("序列化 wanna_sleep 工具结果失败 [%s]: %v", toolCall.ID, err)
		return detailedResult
	}
	return string(resultBytes)
}

func persistWannaSleepMemoryEntryToNotebook(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	summary string,
	sleepAt time.Time,
) (*wannaSleepMemoryLocation, error) {
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

	markdown := buildSleepNoteCalloutMarkdown(sessionID, roundID, sage, toolCall, summary, sleepAt)
	blockID, err := appendMarkdownBlock(docID, markdown)
	if err != nil {
		return nil, err
	}

	attrs := map[string]string{
		magiMemoryBlockAttr: "true",
		magiMemoryKindAttr:  strings.TrimSpace(toolCall.Function.Name),
		magiToolNameAttr:    strings.TrimSpace(toolCall.Function.Name),
		magiSleepAtAttr:     sleepAt.Format(time.RFC3339),
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

	return &wannaSleepMemoryLocation{
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

	docID, err = model.CreateWithMarkdown("", boxID, docHPath, "", "", "", false, "")
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

	docID, err = model.CreateWithMarkdown("", boxID, docHPath, "", "", "", false, "")
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

func buildSleepNoteCalloutMarkdown(
	sessionID, roundID string,
	sage *sages.Sage,
	toolCall types.ToolCall,
	summary string,
	sleepAt time.Time,
) string {
	title := "睡前笔记"
	if sage != nil {
		title = sage.GetDisplayName() + " 睡前笔记"
	}

	fields := []CalloutField{
		{Label: "摘要", Value: summary},
	}
	if sage != nil {
		fields = append(fields, CalloutField{Label: "贤者", Value: sage.GetDisplayName()})
	}
	fields = append(fields,
		CalloutField{Label: "工具", Value: strings.TrimSpace(toolCall.Function.Name)},
		CalloutField{Label: "睡眠时间", Value: sleepAt.Format(time.RFC3339)},
	)
	if strings.TrimSpace(sessionID) != "" {
		fields = append(fields, CalloutField{Label: "会话", Value: strings.TrimSpace(sessionID)})
	}
	if strings.TrimSpace(roundID) != "" {
		fields = append(fields, CalloutField{Label: "轮次", Value: strings.TrimSpace(roundID)})
	}
	return BuildCalloutMarkdown("DREAM", "🌙 "+title, fields...)
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
		var embedLines strings.Builder
		for _, block := range result.Blocks {
			if strings.TrimSpace(block.ID) != "" {
				if embedLines.Len() > 0 {
					embedLines.WriteString("\n")
				}
				embedLines.WriteString("{{! ")
				embedLines.WriteString(strings.TrimSpace(block.ID))
				embedLines.WriteString("}}")
			}
		}
		if embedLines.Len() > 0 {
			fields = append(fields, CalloutField{Label: "结果", Value: embedLines.String()})
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
	_ = location
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
	_ = location
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
	_ = location
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
	_ = location
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
		RenderedContent  string `json:"renderedContent"`
		Type             string `json:"type"`
		Content          string `json:"content"`
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
		"purpose": purpose,
		"query":   query,
	}
	if payload.RestrictedDoc != "" {
		summary["blockID"] = payload.ID
		summary["restrictedDocument"] = payload.RestrictedDoc
	} else if payload.Format == "markdown" || payload.Format == "kramdown" {
		summary["blockID"] = payload.ID
		summary["rootID"] = payload.RootID
		summary["format"] = payload.Format
		if payload.RenderedContent != "" {
			contentRunes := []rune(payload.RenderedContent)
			if len(contentRunes) > 200 {
				summary["contentPreview"] = string(contentRunes[:200]) + "..."
			} else {
				summary["contentPreview"] = payload.RenderedContent
			}
		}
	} else {
		summary["blockID"] = payload.ID
		summary["rootID"] = payload.RootID
		summary["type"] = payload.Type
		if payload.Content != "" {
			contentRunes := []rune(payload.Content)
			if len(contentRunes) > 200 {
				summary["contentPreview"] = string(contentRunes[:200]) + "..."
			} else {
				summary["contentPreview"] = payload.Content
			}
		}
		if payload.TotalChildren > 0 {
			summary["children"] = map[string]interface{}{
				"total":    payload.TotalChildren,
				"returned": payload.ReturnedChildren,
				"hasMore":  payload.HasMoreChildren,
			}
		}
	}
	_ = location
	return summary
}
