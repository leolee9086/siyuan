package coordinator

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	kernelsql "github.com/siyuan-note/siyuan/kernel/sql"
)

const (
	maxRecallLimit              = 20
	defaultRecallLimit          = 5
	magiCrossSessionBlockAttr   = "custom-magi-memory"
	magiCrossSessionKindAttr    = "custom-magi-memory-kind"
	magiCrossSessionSageAttr    = "custom-magi-sage"
	crossSessionMemoryKind      = "cross-session"
)

type persistSessionMemoryArgs struct {
	Summary string   `json:"summary"`
	Tags    []string `json:"tags"`
}

type recallCrossSessionMemoriesArgs struct {
	Query string   `json:"query"`
	Tags  []string `json:"tags,omitempty"`
	Limit int      `json:"limit,omitempty"`
}

type memorySearchResult struct {
	Content   string `json:"content"`
	Source    string `json:"source"`
	Tags      string `json:"tags"`
	SessionID string `json:"sessionId,omitempty"`
	RoundID   string `json:"roundId,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
	SageLabel string `json:"sageLabel,omitempty"`
}

type crossSessionMemoryToolExecutor struct {
	sageName string
}

func newCrossSessionMemoryToolExecutor(sageName string) *crossSessionMemoryToolExecutor {
	return &crossSessionMemoryToolExecutor{sageName: sageName}
}

func sageAttrToDisplayLabel(sageAttr string) string {
	switch strings.TrimSpace(strings.ToLower(sageAttr)) {
	case "melchior":
		return "工作记录"
	case "balthazar":
		return "情绪记录"
	case "casper":
		return "灵感记录"
	default:
		return "记忆记录"
	}
}

func (e *crossSessionMemoryToolExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	switch strings.TrimSpace(toolCall.Function.Name) {
	case config.PersistSessionMemoryToolName:
		return e.handlePersist(toolCall)
	case config.RecallCrossSessionMemoriesToolName:
		return e.handleRecall(toolCall)
	default:
		return "", false, nil
	}
}

func (e *crossSessionMemoryToolExecutor) handlePersist(toolCall types.ToolCall) (string, bool, error) {
	if _, err := requireExplicitToolMotivation(toolCall.Function.Arguments, config.PersistSessionMemoryToolName); err != nil {
		return "", true, err
	}
	var args persistSessionMemoryArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.PersistSessionMemoryToolName, err)
	}
	args.Summary = strings.TrimSpace(args.Summary)
	if args.Summary == "" {
		return "", true, fmt.Errorf("%s: summary 不能为空", config.PersistSessionMemoryToolName)
	}

	accessScope, accessErr := resolveWorkspaceAIMainNotebookAccessScope()
	if accessErr != nil {
		return "", true, fmt.Errorf("%s: 无法获取工作空间笔记本: %w", config.PersistSessionMemoryToolName, accessErr)
	}

	now := time.Now()
	boxID := strings.TrimSpace(accessScope.ActiveNotebook.ID)
	if boxID == "" {
		return "", true, fmt.Errorf("%s: 笔记本ID为空", config.PersistSessionMemoryToolName)
	}

	docID, docHPath, err := ensureMagiMemoryDoc(boxID, now)
	if err != nil {
		return "", true, fmt.Errorf("%s: 创建记忆文档失败: %w", config.PersistSessionMemoryToolName, err)
	}

	summaryBuilder := strings.Builder{}
	summaryBuilder.WriteString("> [!MEMORY]- ")

	label := sageAttrToDisplayLabel(e.sageName)
	summaryBuilder.WriteString(label)
	summaryBuilder.WriteString(" | ")
	summaryBuilder.WriteString(now.Format("2006-01-02 15:04"))
	summaryBuilder.WriteString("\n")

	for _, tag := range args.Tags {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			summaryBuilder.WriteString(tag)
			summaryBuilder.WriteString(" ")
		}
	}
	summaryBuilder.WriteString("\n\n")
	summaryBuilder.WriteString(args.Summary)

	blockID, err := appendMarkdownBlock(docID, summaryBuilder.String())
	if err != nil {
		return "", true, fmt.Errorf("%s: 写入笔记失败: %w", config.PersistSessionMemoryToolName, err)
	}

	attrs := map[string]string{
		magiCrossSessionBlockAttr: "true",
		magiCrossSessionKindAttr:  crossSessionMemoryKind,
		magiCrossSessionSageAttr:  e.sageName,
	}
	if err := model.SetBlockAttrs(blockID, attrs); err != nil {
		logging.LogWarnf("设置记忆块属性失败 [%s]: %v", blockID, err)
	}

	resultPayload := map[string]interface{}{
		"ok":       true,
		"blockId":  blockID,
		"location": docHPath,
		"label":    label,
	}
	resultBytes, _ := json.Marshal(resultPayload)
	return string(resultBytes), true, nil
}

func (e *crossSessionMemoryToolExecutor) handleRecall(toolCall types.ToolCall) (string, bool, error) {
	if _, err := requireExplicitToolPurpose(toolCall.Function.Arguments, config.RecallCrossSessionMemoriesToolName); err != nil {
		return "", true, err
	}
	var args recallCrossSessionMemoriesArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.RecallCrossSessionMemoriesToolName, err)
	}
	args.Query = strings.TrimSpace(args.Query)
	if args.Query == "" {
		return "", true, fmt.Errorf("%s: query 不能为空", config.RecallCrossSessionMemoriesToolName)
	}
	if args.Limit <= 0 || args.Limit > maxRecallLimit {
		args.Limit = defaultRecallLimit
	}

	label := sageAttrToDisplayLabel(e.sageName)

	results := e.searchPersistedMemories(args.Query, args.Tags, args.Limit)

	if len(results) == 0 {
		payload := map[string]interface{}{
			"results": []memorySearchResult{},
			"message": fmt.Sprintf("未找到与 \"%s\" 相关的%s", args.Query, "记忆"),
			"label":   label,
		}
		resultBytes, _ := json.Marshal(payload)
		return string(resultBytes), true, nil
	}

	type enrichedResult struct {
		Content   string `json:"content"`
		Source    string `json:"source"`
		Tags      string `json:"tags,omitempty"`
		SessionID string `json:"sessionId,omitempty"`
		RoundID   string `json:"roundId,omitempty"`
		SageLabel string `json:"sageLabel"`
	}
	enriched := make([]enrichedResult, 0, len(results))
	for _, r := range results {
		enriched = append(enriched, enrichedResult{
			Content:   r.Content,
			Source:    r.Source,
			Tags:      r.Tags,
			SessionID: r.SessionID,
			RoundID:   r.RoundID,
			SageLabel: r.SageLabel,
		})
	}

	payload := map[string]interface{}{
		"results":      enriched,
		"result_count": len(enriched),
		"label":        label,
	}
	resultBytes, _ := json.Marshal(payload)
	return string(resultBytes), true, nil
}

func (e *crossSessionMemoryToolExecutor) searchPersistedMemories(query string, filterTags []string, limit int) []memorySearchResult {
	blocks, _, _, _, ok := runNoteKeywordFullTextSearch(query, limit*3)
	if !ok || len(blocks) == 0 {
		return nil
	}

	tagSet := make(map[string]bool, len(filterTags))
	for _, t := range filterTags {
		t = strings.TrimSpace(t)
		if t != "" {
			tagSet[t] = true
		}
	}

	var results []memorySearchResult
	for _, block := range blocks {
		if block == nil || strings.TrimSpace(block.ID) == "" {
			continue
		}

		attrs := kernelsql.GetBlockAttrs(block.ID)
		if len(attrs) == 0 {
			continue
		}
		if attrs[magiCrossSessionBlockAttr] != "true" || attrs[magiCrossSessionKindAttr] != crossSessionMemoryKind {
			continue
		}

		blockSage := strings.TrimSpace(attrs[magiCrossSessionSageAttr])
		blockTags := strings.TrimSpace(attrs[magiMemoryBlockAttr+"-tags"])

		if len(tagSet) > 0 && blockTags != "" {
			hasMatch := false
			blockTagList := strings.Split(blockTags, " ")
			for _, bt := range blockTagList {
				bt = strings.TrimSpace(bt)
				if bt != "" && tagSet[bt] {
					hasMatch = true
					break
				}
			}
			if !hasMatch {
				continue
			}
		}

		content := strings.TrimSpace(block.Content)
		if content == "" {
			continue
		}

		if len(content) > 300 {
			content = content[:300] + "..."
		}

		results = append(results, memorySearchResult{
			Content:   content,
			Source:    "persisted",
			Tags:      blockTags,
			SessionID: strings.TrimSpace(attrs[magiSessionIDAttr]),
			RoundID:   strings.TrimSpace(attrs[magiRoundIDAttr]),
			Timestamp: strings.TrimSpace(attrs[magiCrossSessionBlockAttr+"-timestamp"]),
			SageLabel: sageAttrToDisplayLabel(blockSage),
		})

		if len(results) >= limit {
			break
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return len(results[i].Content) > len(results[j].Content)
	})
	if len(results) > limit {
		results = results[:limit]
	}

	return results
}
