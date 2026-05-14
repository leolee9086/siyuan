package coordinator

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"github.com/88250/lute/ast"
	"github.com/88250/lute/parse"
	"github.com/go-ego/gse"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/treenode"
)

const (
	defaultNoteKeywordSearchLimit   = 10
	maxNoteKeywordSearchLimit       = 50
	maxNoteKeywordQueryTokenCount   = 32
	minNoteKeywordTokenRuneLength   = 2
	fullTextSearchMethodQuerySyntax = 1
	fullTextSearchOrderByBlockType  = 0
	fullTextSearchGroupByNone       = 0
)

var (
	noteKeywordSegmenter     gse.Segmenter
	noteKeywordSegmenterOnce sync.Once
	noteKeywordSegmenterErr  error
)

var runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
	return model.FullTextSearchBlock(
		query,
		nil,
		nil,
		defaultNoteKeywordSearchTypes(),
		fullTextSearchMethodQuerySyntax,
		fullTextSearchOrderByBlockType,
		fullTextSearchGroupByNone,
		1,
		limit,
	)
}

var resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
	return model.ResolveWorkspaceAIMainNotebookAccessScope()
}

// ── 增强搜索结果相关类型和函数变量 ──

type breadcrumbItem struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type enrichedBlockResult struct {
	ID        string           `json:"id"`
	Type      string           `json:"type"`
	SubType   string           `json:"subType,omitempty"`
	Content   string           `json:"content"`
	Notebook  *breadcrumbItem  `json:"notebook"`
	Path      []*breadcrumbItem `json:"path"`
	Headings  []*breadcrumbItem `json:"headings"`
	LeafIndex int              `json:"leafIndex"`
}

var loadTreeByIDForSearch = model.LoadTreeByBlockID

var getTreeRootByHPathForSearch = treenode.GetBlockTreeRootByHPath

var getConfBoxForSearch = func(boxID string) *model.Box {
	return model.Conf.Box(boxID)
}

var buildBreadcrumbForSearch = model.BuildBlockBreadcrumb

type noteKeywordSearchToolArgs struct {
	Query string `json:"query"`
	Limit int    `json:"limit,omitempty"`
}

type noteKeywordToolResultExecutor struct {
	cache map[string]string
}

func newNoteKeywordToolResultExecutor() *noteKeywordToolResultExecutor {
	return &noteKeywordToolResultExecutor{
		cache: make(map[string]string),
	}
}

func (e *noteKeywordToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.NoteKeywordSearchToolName {
		return "", false, nil
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.NoteKeywordSearchToolName)
	}

	if cached, ok := e.cache[rawArgs]; ok {
		return cached, true, nil
	}

	result, err = executeNoteKeywordSearch(rawArgs)
	if err != nil {
		return "", true, err
	}
	e.cache[rawArgs] = result
	return result, true, nil
}

func executeNoteKeywordSearch(rawArgs string) (string, error) {
	var args noteKeywordSearchToolArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", config.NoteKeywordSearchToolName, err)
	}

	query := strings.TrimSpace(args.Query)
	if query == "" {
		return "", fmt.Errorf("%s 的 query 不能为空", config.NoteKeywordSearchToolName)
	}

	limit := normalizeNoteKeywordSearchLimit(args.Limit)
	accessScope, accessErr := resolveWorkspaceAIMainNotebookAccessScope()
	if accessErr != nil {
		payload := map[string]interface{}{
			"blocks":                []interface{}{},
			"restrictedDocumentIDs": []string{},
			"matchedBlockCount":     0,
			"matchedRootCount":      0,
			"pageCount":             0,
			"docMode":               false,
			"scope":                 buildNoteKeywordScopePayload(accessScope, accessErr),
			"permissionHint":        buildNoteKeywordScopeMessage(accessScope, accessErr),
		}
		resultBytes, err := json.Marshal(payload)
		if err != nil {
			return "", fmt.Errorf("%s 结果序列化失败: %w", config.NoteKeywordSearchToolName, err)
		}
		return string(resultBytes), nil
	}

	queryTokens := buildQueryTokens(query)
	lexicalQuery := buildLexicalQuery(query, queryTokens)

	blocks, matchedBlockCount, matchedRootCount, pageCount, docMode := runNoteKeywordFullTextSearch(lexicalQuery, limit)
	rerankBlocksByCommonTokens(blocks, queryTokens)
	if len(blocks) > limit {
		blocks = blocks[:limit]
	}
	visibleBlocks, restrictedDocumentIDs := filterNoteKeywordBlocksByAIMainAccess(blocks, accessScope)

	enrichedBlocks, err := enrichSearchBlocks(visibleBlocks)
	if err != nil {
		return "", err
	}

	payload := map[string]interface{}{
		"blocks":                enrichedBlocks,
		"restrictedDocumentIDs": restrictedDocumentIDs,
		"matchedBlockCount":     matchedBlockCount,
		"matchedRootCount":      matchedRootCount,
		"pageCount":             pageCount,
		"docMode":               docMode,
		"scope":                 buildNoteKeywordScopePayload(accessScope, nil),
	}
	if len(restrictedDocumentIDs) > 0 {
		payload["permissionHint"] = "部分命中超出当前AI主笔记本的直接读取范围，结果中已仅保留文档ID。若需要详情，请先向用户请求阅读权限。"
	}
	resultBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("%s 结果序列化失败: %w", config.NoteKeywordSearchToolName, err)
	}
	return string(resultBytes), nil
}

func normalizeNoteKeywordSearchLimit(limit int) int {
	if limit <= 0 {
		return defaultNoteKeywordSearchLimit
	}
	if limit > maxNoteKeywordSearchLimit {
		return maxNoteKeywordSearchLimit
	}
	return limit
}

func filterNoteKeywordBlocksByAIMainAccess(
	blocks []*model.Block,
	accessScope *model.WorkspaceAIMainNotebookAccessScope,
) ([]*model.Block, []string) {
	if len(blocks) == 0 {
		return []*model.Block{}, []string{}
	}
	accessibleRootIDs := map[string]struct{}{}
	if accessScope != nil && accessScope.AccessibleRootIDs != nil {
		accessibleRootIDs = accessScope.AccessibleRootIDs
	}

	visibleBlocks := make([]*model.Block, 0, len(blocks))
	restrictedDocumentIDs := make([]string, 0)
	restrictedSeen := map[string]struct{}{}
	for _, block := range blocks {
		if block == nil {
			continue
		}
		rootID := resolveNoteKeywordBlockRootID(block)
		if _, ok := accessibleRootIDs[rootID]; ok {
			visibleBlocks = append(visibleBlocks, block)
			continue
		}
		if rootID == "" {
			continue
		}
		if _, ok := restrictedSeen[rootID]; ok {
			continue
		}
		restrictedSeen[rootID] = struct{}{}
		restrictedDocumentIDs = append(restrictedDocumentIDs, rootID)
	}
	return visibleBlocks, restrictedDocumentIDs
}

func resolveNoteKeywordBlockRootID(block *model.Block) string {
	if block == nil {
		return ""
	}
	rootID := strings.TrimSpace(block.RootID)
	if rootID != "" {
		return rootID
	}
	return strings.TrimSpace(block.ID)
}

func buildNoteKeywordScopePayload(
	accessScope *model.WorkspaceAIMainNotebookAccessScope,
	scopeErr error,
) map[string]interface{} {
	status := model.WorkspaceAIMainNotebookStatusMissing
	payload := map[string]interface{}{}
	if accessScope != nil && accessScope.State != nil && strings.TrimSpace(accessScope.State.Status) != "" {
		status = accessScope.State.Status
	}
	payload["status"] = status
	if accessScope != nil && accessScope.ActiveNotebook != nil {
		payload["activeNotebook"] = map[string]interface{}{
			"id":     accessScope.ActiveNotebook.ID,
			"name":   accessScope.ActiveNotebook.Name,
			"closed": accessScope.ActiveNotebook.Closed,
		}
	}
	if accessScope != nil && accessScope.State != nil {
		payload["aiMainNotebookIDs"] = noteKeywordNotebookIDs(accessScope.State.Notebooks)
		payload["openAIMainNotebookIDs"] = noteKeywordNotebookIDs(accessScope.State.OpenNotebooks)
	}
	if scopeErr != nil {
		payload["message"] = buildNoteKeywordScopeMessage(accessScope, scopeErr)
	}
	return payload
}

func noteKeywordNotebookIDs(notebooks []*model.Box) []string {
	ret := make([]string, 0, len(notebooks))
	for _, notebook := range notebooks {
		if notebook == nil {
			continue
		}
		ret = append(ret, notebook.ID)
	}
	return ret
}

func buildNoteKeywordScopeMessage(
	accessScope *model.WorkspaceAIMainNotebookAccessScope,
	scopeErr error,
) string {
	if scopeErr == nil {
		return ""
	}
	status := model.WorkspaceAIMainNotebookStatusMissing
	if accessScope != nil && accessScope.State != nil && strings.TrimSpace(accessScope.State.Status) != "" {
		status = accessScope.State.Status
	}
	switch status {
	case model.WorkspaceAIMainNotebookStatusConflict:
		return "当前工作空间有多个AI主笔记本同时处于打开状态。请先选择一个保留打开，其余关闭后再继续查询。"
	case model.WorkspaceAIMainNotebookStatusInactive:
		return "当前工作空间存在多个AI主笔记本，但没有唯一的活动主笔记本。请先打开一个作为当前AI主笔记本。"
	default:
		return "当前工作空间还没有AI主笔记本，无法直接查询笔记。请先创建AI主笔记本。"
	}
}

func buildQueryTokens(query string) []string {
	candidates := cutNoteKeywordTokens(query)
	if len(candidates) == 0 {
		return []string{query}
	}

	seen := make(map[string]struct{}, len(candidates))
	tokens := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		token := strings.TrimSpace(candidate)
		if token == "" {
			continue
		}
		if utf8.RuneCountInString(token) < minNoteKeywordTokenRuneLength {
			continue
		}
		if !containsMeaningfulRune(token) {
			continue
		}
		if _, ok := seen[token]; ok {
			continue
		}
		seen[token] = struct{}{}
		tokens = append(tokens, token)
		if len(tokens) >= maxNoteKeywordQueryTokenCount {
			break
		}
	}
	if len(tokens) == 0 {
		return []string{query}
	}
	return tokens
}

func buildLexicalQuery(rawQuery string, tokens []string) string {
	if len(tokens) == 0 {
		return quoteLexicalTerm(rawQuery)
	}

	parts := make([]string, 0, len(tokens))
	for _, token := range tokens {
		parts = append(parts, quoteLexicalTerm(token))
	}
	return strings.Join(parts, " OR ")
}

func quoteLexicalTerm(term string) string {
	escaped := strings.ReplaceAll(term, `"`, `""`)
	escaped = strings.ReplaceAll(escaped, `'`, `''`)
	return `"` + escaped + `"`
}

func rerankBlocksByCommonTokens(blocks []*model.Block, queryTokens []string) {
	if len(blocks) < 2 || len(queryTokens) == 0 {
		return
	}

	queryTokenSet := make(map[string]struct{}, len(queryTokens))
	for _, token := range queryTokens {
		queryTokenSet[token] = struct{}{}
	}

	type scoredBlock struct {
		block *model.Block
		score int
		index int
	}
	scored := make([]scoredBlock, 0, len(blocks))
	for idx, block := range blocks {
		score := 0
		if block != nil {
			for _, token := range cutNoteKeywordTokens(block.Content) {
				token = strings.TrimSpace(token)
				if token == "" {
					continue
				}
				if _, ok := queryTokenSet[token]; ok {
					score++
				}
			}
		}
		scored = append(scored, scoredBlock{
			block: block,
			score: score,
			index: idx,
		})
	}

	sort.SliceStable(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})
	for i := range scored {
		blocks[i] = scored[i].block
	}
}

func cutNoteKeywordTokens(text string) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}

	noteKeywordSegmenterOnce.Do(func() {
		noteKeywordSegmenterErr = noteKeywordSegmenter.LoadDict()
	})

	if noteKeywordSegmenterErr != nil {
		return fallbackCutNoteKeywordTokens(text)
	}
	return noteKeywordSegmenter.Cut(text, true)
}

func fallbackCutNoteKeywordTokens(text string) []string {
	var tokens []string
	var current strings.Builder
	flush := func() {
		if current.Len() == 0 {
			return
		}
		tokens = append(tokens, current.String())
		current.Reset()
	}

	for _, r := range text {
		if unicode.IsSpace(r) || unicode.IsPunct(r) {
			flush()
			continue
		}
		current.WriteRune(r)
	}
	flush()
	return tokens
}

func containsMeaningfulRune(token string) bool {
	for _, r := range token {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			return true
		}
	}
	return false
}

func defaultNoteKeywordSearchTypes() map[string]bool {
	return map[string]bool{
		"document":   true,
		"heading":    true,
		"list":       false,
		"listItem":   false,
		"codeBlock":  true,
		"htmlBlock":  true,
		"mathBlock":  true,
		"table":      true,
		"blockquote": true,
		"superBlock": true,
		"paragraph":  true,
		"embedBlock": false,
	}
}

// ── 搜索结果增强 ──

func enrichSearchBlocks(blocks []*model.Block) ([]*enrichedBlockResult, error) {
	if len(blocks) == 0 {
		return []*enrichedBlockResult{}, nil
	}

	rootGroups := map[string][]*model.Block{}
	rootOrder := make([]string, 0, len(blocks))
	for _, b := range blocks {
		if _, ok := rootGroups[b.RootID]; !ok {
			rootOrder = append(rootOrder, b.RootID)
		}
		rootGroups[b.RootID] = append(rootGroups[b.RootID], b)
	}

	type docCache struct {
		boxID   string
		boxName string
		pathBC  []*breadcrumbItem
		leafSeq map[string]int
	}
	cache := map[string]*docCache{}

	for _, rootID := range rootOrder {
		tree, err := loadTreeByIDForSearch(rootID)
		if err != nil {
			return nil, fmt.Errorf("加载文档树失败 [%s]: %w", rootID, err)
		}

		box := getConfBoxForSearch(tree.Box)
		boxName := ""
		if box != nil {
			boxName = box.Name
		}

		cache[rootID] = &docCache{
			boxID:   tree.Box,
			boxName: boxName,
			pathBC:  buildPathBreadcrumbs(tree.Box, tree.HPath, tree.Root.ID),
			leafSeq: computeLeafBlockSequence(tree),
		}
	}

	results := make([]*enrichedBlockResult, 0, len(blocks))
	for _, b := range blocks {
		dc := cache[b.RootID]

		headingBC := buildHeadingBreadcrumbs(b.ID)

		leafIdx := -1
		if idx, ok := dc.leafSeq[b.ID]; ok {
			leafIdx = idx
		}

		results = append(results, &enrichedBlockResult{
			ID:      b.ID,
			Type:    b.Type,
			SubType: b.SubType,
			Content: b.Content,
			Notebook: &breadcrumbItem{
				ID:   dc.boxID,
				Name: dc.boxName,
			},
			Path:      dc.pathBC,
			Headings:  headingBC,
			LeafIndex: leafIdx,
		})
	}
	return results, nil
}

func buildPathBreadcrumbs(boxID, hPath, rootID string) []*breadcrumbItem {
	trimmed := strings.TrimPrefix(hPath, "/")
	if trimmed == "" {
		return nil
	}
	segments := strings.Split(trimmed, "/")
	items := make([]*breadcrumbItem, 0, len(segments))
	var accumulated string
	for i, seg := range segments {
		accumulated += "/" + seg
		var id string
		if i == len(segments)-1 {
			id = rootID
		} else {
			bt := getTreeRootByHPathForSearch(boxID, accumulated)
			if bt != nil {
				id = bt.ID
			}
		}
		items = append(items, &breadcrumbItem{ID: id, Name: seg})
	}
	return items
}

func buildHeadingBreadcrumbs(blockID string) []*breadcrumbItem {
	bps, err := buildBreadcrumbForSearch(blockID, nil)
	if err != nil || len(bps) == 0 {
		return nil
	}
	headings := make([]*breadcrumbItem, 0)
	for _, bp := range bps {
		if bp.Type == "NodeHeading" && bp.Name != "" {
			headings = append(headings, &breadcrumbItem{
				ID:   bp.ID,
				Name: bp.Name,
			})
		}
	}
	return headings
}

func computeLeafBlockSequence(tree *parse.Tree) map[string]int {
	seq := map[string]int{}
	index := 0
	ast.Walk(tree.Root, func(n *ast.Node, entering bool) ast.WalkStatus {
		if !entering {
			return ast.WalkContinue
		}
		if !n.IsBlock() {
			return ast.WalkContinue
		}
		switch n.Type {
		case ast.NodeDocument, ast.NodeBlockquote, ast.NodeList, ast.NodeListItem, ast.NodeSuperBlock, ast.NodeCallout:
			return ast.WalkContinue
		}
		index++
		seq[n.ID] = index
		return ast.WalkContinue
	})
	return seq
}
