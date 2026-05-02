package coordinator

import (
	"fmt"
	"sort"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	kernelsql "github.com/siyuan-note/siyuan/kernel/sql"
)

const (
	passiveRecallSearchLimit  = maxNoteKeywordSearchLimit
	passiveRecallHintLimit    = 10
	passiveRecallMaxAncestors = 16
)

var (
	passiveRecallGetBlockAttrs = func(id string) map[string]string {
		return kernelsql.GetBlockAttrs(id)
	}
	passiveRecallLoadBlock = func(id string) *kernelsql.Block {
		return kernelsql.GetBlock(id)
	}
)

type passiveRecallPayload struct {
	Scope            string                    `json:"scope"`
	QueryBasis       *types.PassiveRecallBasis `json:"queryBasis,omitempty"`
	RelatedTo        string                    `json:"relatedTo,omitempty"`
	KeywordHitCounts map[string]int            `json:"keywordHitCounts,omitempty"`
	NoteHints        []passiveRecallHint       `json:"noteHints"`
	Empty            bool                      `json:"empty,omitempty"`
	Truncated        bool                      `json:"truncated,omitempty"`
	Error            string                    `json:"error,omitempty"`
	ToolHint         string                    `json:"toolHint,omitempty"`
}

type passiveRecallHint struct {
	ID     string `json:"id"`
	RootID string `json:"rootId,omitempty"`
	Kind   string `json:"kind,omitempty"`
}

type passiveRecallAggregate struct {
	ID              string
	RootID          string
	Kind            string
	MatchedKeywords map[string]struct{}
	FirstIndex      int
}

func buildPassiveRecallPayloadsBySage(
	basis *types.PassiveRecallBasis,
) map[string]*passiveRecallPayload {
	if basis == nil || strings.TrimSpace(basis.Query) == "" {
		return nil
	}

	payloads := map[string]*passiveRecallPayload{}
	for _, sageName := range []string{"melchior", "balthazar", "casper"} {
		payloads[sageName] = buildPassiveRecallPayloadForSage(sageName, basis)
	}
	return payloads
}

func buildPassiveRecallPayloadForSage(
	sageName string,
	basis *types.PassiveRecallBasis,
) *passiveRecallPayload {
	if basis == nil {
		return nil
	}

	query := strings.TrimSpace(basis.Query)
	if query == "" {
		return nil
	}

	payload := &passiveRecallPayload{
		Scope:      passiveRecallScopeName(sageName),
		QueryBasis: clonePassiveRecallBasis(basis),
		RelatedTo:  buildPassiveRecallRelatedTo(basis),
		NoteHints:  []passiveRecallHint{},
		ToolHint:   fmt.Sprintf("这里只提供可能相关的笔记或记忆条目 ID，不提供正文；这些 ID 是围绕 relatedTo 所描述的当前状况召回的，整体关键词命中统计见 keywordHitCounts；若要真正回忆具体内容，请自行调用 %s。", config.NoteKeywordSearchToolName),
	}

	queryTokens := buildQueryTokens(query)
	lexicalQuery := buildLexicalQuery(query, queryTokens)
	blocks, _, _, _, _ := runNoteKeywordFullTextSearch(lexicalQuery, passiveRecallSearchLimit)
	rerankBlocksByCommonTokens(blocks, queryTokens)

	hints, keywordHitCounts, truncated, err := buildPassiveRecallHintsForScope(sageName, blocks, queryTokens)
	if err != nil {
		payload.Empty = true
		payload.Error = err.Error()
		return payload
	}

	payload.KeywordHitCounts = keywordHitCounts
	payload.NoteHints = hints
	payload.Empty = len(hints) == 0
	payload.Truncated = truncated
	return payload
}

func clonePassiveRecallBasis(basis *types.PassiveRecallBasis) *types.PassiveRecallBasis {
	if basis == nil {
		return nil
	}
	cloned := *basis
	cloned.Query = strings.TrimSpace(cloned.Query)
	cloned.UserMessage = strings.TrimSpace(cloned.UserMessage)
	cloned.AssistantReply = strings.TrimSpace(cloned.AssistantReply)
	cloned.DowntimeSummary = strings.TrimSpace(cloned.DowntimeSummary)
	return &cloned
}

func buildPassiveRecallRelatedTo(basis *types.PassiveRecallBasis) string {
	if basis == nil {
		return ""
	}

	summary := truncatePassiveRecallRelatedText(basis.Query, 120)
	switch basis.Type {
	case types.PassiveRecallBasisUserMessage:
		if summary == "" {
			summary = truncatePassiveRecallRelatedText(basis.UserMessage, 120)
		}
		if summary == "" {
			return "当前用户消息"
		}
		return "当前用户消息：" + summary
	case types.PassiveRecallBasisPreviousDialogue:
		if summary == "" {
			summary = truncatePassiveRecallRelatedText(strings.TrimSpace(basis.UserMessage+"\n"+basis.AssistantReply), 120)
		}
		if summary == "" {
			return "上一轮用户消息与 AI 回复"
		}
		return "上一轮用户消息与 AI 回复：" + summary
	case types.PassiveRecallBasisPreviousDowntime:
		if summary == "" {
			summary = truncatePassiveRecallRelatedText(basis.DowntimeSummary, 120)
		}
		if summary == "" {
			return "上一轮睡前笔记"
		}
		return "上一轮睡前笔记：" + summary
	default:
		if summary == "" {
			return "当前状况"
		}
		return "当前状况：" + summary
	}
}

func truncatePassiveRecallRelatedText(text string, limit int) string {
	text = strings.TrimSpace(strings.ReplaceAll(text, "\n", " / "))
	if text == "" || limit <= 0 {
		return text
	}
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	return strings.TrimSpace(string(runes[:limit])) + "..."
}

func passiveRecallScopeName(sageName string) string {
	switch strings.TrimSpace(sageName) {
	case "melchior":
		return "melchior-accessible-notes"
	case "balthazar":
		return "balthazar-active-records"
	case "casper":
		return "casper-downtime-notes"
	default:
		return "unknown"
	}
}

func buildPassiveRecallHintsForScope(
	sageName string,
	blocks []*model.Block,
	queryTokens []string,
) ([]passiveRecallHint, map[string]int, bool, error) {
	switch strings.TrimSpace(sageName) {
	case "melchior":
		return buildMelchiorPassiveRecallHints(blocks, queryTokens)
	case "balthazar":
		return buildTaggedBlockPassiveRecallHints(blocks, queryTokens, matchActiveRecordRecallBlock)
	case "casper":
		return buildTaggedBlockPassiveRecallHints(blocks, queryTokens, matchDowntimeRecallBlock)
	default:
		return []passiveRecallHint{}, nil, false, nil
	}
}

func buildMelchiorPassiveRecallHints(
	blocks []*model.Block,
	queryTokens []string,
) ([]passiveRecallHint, map[string]int, bool, error) {
	accessScope, accessErr := resolveWorkspaceAIMainNotebookAccessScope()
	if accessErr != nil {
		msg := strings.TrimSpace(buildNoteKeywordScopeMessage(accessScope, accessErr))
		if msg == "" {
			msg = accessErr.Error()
		}
		return nil, nil, false, fmt.Errorf("%s", msg)
	}

	accessibleRootIDs := map[string]struct{}{}
	if accessScope != nil && accessScope.AccessibleRootIDs != nil {
		accessibleRootIDs = accessScope.AccessibleRootIDs
	}

	aggregated := map[string]*passiveRecallAggregate{}
	orderedKeys := make([]string, 0, len(blocks))
	for index, block := range blocks {
		if block == nil {
			continue
		}
		rootID := resolveNoteKeywordBlockRootID(block)
		if rootID == "" {
			continue
		}
		if _, ok := accessibleRootIDs[rootID]; !ok {
			continue
		}

		aggregate, exists := aggregated[rootID]
		if !exists {
			aggregate = &passiveRecallAggregate{
				ID:              rootID,
				RootID:          rootID,
				Kind:            "note",
				MatchedKeywords: map[string]struct{}{},
				FirstIndex:      index,
			}
			aggregated[rootID] = aggregate
			orderedKeys = append(orderedKeys, rootID)
		}
		mergePassiveRecallKeywords(aggregate.MatchedKeywords, passiveRecallMatchedKeywords(queryTokens, block.Content))
	}

	return finalizePassiveRecallAggregates(aggregated, orderedKeys)
}

func buildTaggedBlockPassiveRecallHints(
	blocks []*model.Block,
	queryTokens []string,
	matcher func(map[string]string) (string, bool),
) ([]passiveRecallHint, map[string]int, bool, error) {
	aggregated := map[string]*passiveRecallAggregate{}
	orderedKeys := make([]string, 0, len(blocks))

	for index, block := range blocks {
		if block == nil {
			continue
		}

		anchorID, rootID, kind := resolveTaggedAncestorForPassiveRecall(block, matcher)
		if anchorID == "" {
			continue
		}

		aggregate, exists := aggregated[anchorID]
		if !exists {
			aggregate = &passiveRecallAggregate{
				ID:              anchorID,
				RootID:          rootID,
				Kind:            kind,
				MatchedKeywords: map[string]struct{}{},
				FirstIndex:      index,
			}
			aggregated[anchorID] = aggregate
			orderedKeys = append(orderedKeys, anchorID)
		}
		mergePassiveRecallKeywords(aggregate.MatchedKeywords, passiveRecallMatchedKeywords(queryTokens, block.Content))
	}

	return finalizePassiveRecallAggregates(aggregated, orderedKeys)
}

func finalizePassiveRecallAggregates(
	aggregated map[string]*passiveRecallAggregate,
	orderedKeys []string,
) ([]passiveRecallHint, map[string]int, bool, error) {
	if len(aggregated) == 0 {
		return []passiveRecallHint{}, nil, false, nil
	}

	ordered := make([]*passiveRecallAggregate, 0, len(orderedKeys))
	for _, key := range orderedKeys {
		if aggregate, ok := aggregated[key]; ok {
			ordered = append(ordered, aggregate)
		}
	}

	sort.SliceStable(ordered, func(i, j int) bool {
		leftKeywords := len(ordered[i].MatchedKeywords)
		rightKeywords := len(ordered[j].MatchedKeywords)
		if leftKeywords != rightKeywords {
			return leftKeywords > rightKeywords
		}
		return ordered[i].FirstIndex < ordered[j].FirstIndex
	})

	truncated := len(ordered) > passiveRecallHintLimit
	if truncated {
		ordered = ordered[:passiveRecallHintLimit]
	}

	keywordHitCounts := buildPassiveRecallKeywordHitCounts(ordered)
	hints := make([]passiveRecallHint, 0, len(ordered))
	for _, aggregate := range ordered {
		if aggregate == nil || strings.TrimSpace(aggregate.ID) == "" {
			continue
		}
		hints = append(hints, passiveRecallHint{
			ID:     strings.TrimSpace(aggregate.ID),
			RootID: strings.TrimSpace(aggregate.RootID),
			Kind:   strings.TrimSpace(aggregate.Kind),
		})
	}
	return hints, keywordHitCounts, truncated, nil
}

func passiveRecallMatchedKeywords(queryTokens []string, content string) []string {
	content = strings.TrimSpace(content)
	if len(queryTokens) == 0 || content == "" {
		return []string{}
	}

	contentTokenSet := map[string]struct{}{}
	for _, token := range cutNoteKeywordTokens(content) {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		contentTokenSet[token] = struct{}{}
	}

	matched := make([]string, 0, len(queryTokens))
	seen := map[string]struct{}{}
	for _, token := range queryTokens {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		if _, ok := seen[token]; ok {
			continue
		}
		if _, ok := contentTokenSet[token]; ok || strings.Contains(content, token) {
			seen[token] = struct{}{}
			matched = append(matched, token)
		}
	}
	if len(matched) > 0 {
		return matched
	}

	fallbackLimit := len(queryTokens)
	if fallbackLimit > 3 {
		fallbackLimit = 3
	}
	fallback := make([]string, 0, fallbackLimit)
	for _, token := range queryTokens[:fallbackLimit] {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		if _, ok := seen[token]; ok {
			continue
		}
		seen[token] = struct{}{}
		fallback = append(fallback, token)
	}
	return fallback
}

func mergePassiveRecallKeywords(dst map[string]struct{}, keywords []string) {
	if dst == nil {
		return
	}
	for _, keyword := range keywords {
		keyword = strings.TrimSpace(keyword)
		if keyword == "" {
			continue
		}
		dst[keyword] = struct{}{}
	}
}

func buildPassiveRecallKeywordHitCounts(aggregates []*passiveRecallAggregate) map[string]int {
	if len(aggregates) == 0 {
		return nil
	}

	counts := map[string]int{}
	for _, aggregate := range aggregates {
		if aggregate == nil || len(aggregate.MatchedKeywords) == 0 {
			continue
		}
		for keyword := range aggregate.MatchedKeywords {
			keyword = strings.TrimSpace(keyword)
			if keyword == "" {
				continue
			}
			counts[keyword]++
		}
	}
	if len(counts) == 0 {
		return nil
	}
	return counts
}

func resolveTaggedAncestorForPassiveRecall(
	block *model.Block,
	matcher func(map[string]string) (string, bool),
) (anchorID string, rootID string, kind string) {
	if block == nil || matcher == nil {
		return "", "", ""
	}

	currentID := strings.TrimSpace(block.ID)
	currentParentID := strings.TrimSpace(block.ParentID)
	currentRootID := strings.TrimSpace(block.RootID)
	for depth := 0; depth < passiveRecallMaxAncestors && currentID != ""; depth++ {
		if matchedKind, ok := matcher(passiveRecallGetBlockAttrs(currentID)); ok {
			if currentRootID == "" {
				if sqlBlock := passiveRecallLoadBlock(currentID); sqlBlock != nil {
					currentRootID = strings.TrimSpace(sqlBlock.RootID)
				}
			}
			if currentRootID == "" {
				currentRootID = strings.TrimSpace(block.RootID)
			}
			return currentID, currentRootID, matchedKind
		}

		if currentParentID == "" {
			sqlBlock := passiveRecallLoadBlock(currentID)
			if sqlBlock == nil {
				break
			}
			currentParentID = strings.TrimSpace(sqlBlock.ParentID)
			if currentRootID == "" {
				currentRootID = strings.TrimSpace(sqlBlock.RootID)
			}
		}
		currentID = currentParentID
		currentParentID = ""
	}
	return "", "", ""
}

func matchDowntimeRecallBlock(attrs map[string]string) (string, bool) {
	if len(attrs) == 0 {
		return "", false
	}
	kind := strings.TrimSpace(attrs[magiMemoryKindAttr])
	toolName := strings.TrimSpace(attrs[magiToolNameAttr])
	if kind == config.WannaSleepMergedRecordName || kind == config.WannaRestMergedRecordName ||
		toolName == config.WannaSleepMergedRecordName || toolName == config.WannaRestMergedRecordName {
		return "sleep-note", true
	}
	if config.IsWannaSleepOrRestToolName(kind) || config.IsWannaSleepOrRestToolName(toolName) {
		return "sleep-note", true
	}
	if strings.TrimSpace(attrs[magiSleepAtAttr]) != "" && strings.TrimSpace(attrs[magiMemoryBlockAttr]) == "true" {
		return "sleep-note", true
	}
	if strings.TrimSpace(attrs[magiRestAtAttr]) != "" && strings.TrimSpace(attrs[magiMemoryBlockAttr]) == "true" {
		return "sleep-note", true
	}
	return "", false
}

func matchActiveRecordRecallBlock(attrs map[string]string) (string, bool) {
	if len(attrs) == 0 {
		return "", false
	}
	if strings.TrimSpace(attrs[magiDiaryBlockAttr]) == "true" {
		return "active-record", true
	}
	if strings.TrimSpace(attrs[magiMemoryKindAttr]) == "diary" {
		return "active-record", true
	}
	if strings.TrimSpace(attrs[magiToolNameAttr]) == config.WriteDiaryToolName {
		return "active-record", true
	}
	return "", false
}
