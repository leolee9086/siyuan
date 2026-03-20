package coordinator

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"unicode"
	"unicode/utf8"

	"github.com/go-ego/gse"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
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
	queryTokens := buildQueryTokens(query)
	lexicalQuery := buildLexicalQuery(query, queryTokens)

	blocks, matchedBlockCount, matchedRootCount, pageCount, docMode := runNoteKeywordFullTextSearch(lexicalQuery, limit)
	rerankBlocksByCommonTokens(blocks, queryTokens)
	if len(blocks) > limit {
		blocks = blocks[:limit]
	}

	payload := map[string]interface{}{
		"blocks":            blocks,
		"matchedBlockCount": matchedBlockCount,
		"matchedRootCount":  matchedRootCount,
		"pageCount":         pageCount,
		"docMode":           docMode,
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
