package coordinator

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/model"
)

func TestNormalizeNoteKeywordSearchLimit(t *testing.T) {
	if got := normalizeNoteKeywordSearchLimit(0); got != defaultNoteKeywordSearchLimit {
		t.Fatalf("期望默认limit=%d，实际=%d", defaultNoteKeywordSearchLimit, got)
	}
	if got := normalizeNoteKeywordSearchLimit(999); got != maxNoteKeywordSearchLimit {
		t.Fatalf("期望最大limit=%d，实际=%d", maxNoteKeywordSearchLimit, got)
	}
	if got := normalizeNoteKeywordSearchLimit(7); got != 7 {
		t.Fatalf("期望保留原limit=7，实际=%d", got)
	}
}

func TestBuildLexicalQuery(t *testing.T) {
	query := buildLexicalQuery("alpha beta", []string{"alpha", "beta"})
	if !strings.Contains(query, `"alpha"`) || !strings.Contains(query, `"beta"`) {
		t.Fatalf("期望词项被双引号包裹，实际=%s", query)
	}
	if !strings.Contains(query, " OR ") {
		t.Fatalf("期望为OR查询，实际=%s", query)
	}
}

func TestExecuteNoteKeywordSearch_ReRankAndLimitClamp(t *testing.T) {
	originalSearchFn := runNoteKeywordFullTextSearch
	defer func() {
		runNoteKeywordFullTextSearch = originalSearchFn
	}()

	var gotQuery string
	var gotLimit int
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		gotQuery = query
		gotLimit = limit
		return []*model.Block{
			{ID: "b1", Content: "alpha"},
			{ID: "b2", Content: "alpha beta beta"},
			{ID: "b3", Content: "gamma"},
		}, 3, 2, 1, false
	}

	result, err := executeNoteKeywordSearch(`{"query":"alpha beta","limit":999}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	if gotLimit != maxNoteKeywordSearchLimit {
		t.Fatalf("期望limit被限制为%d，实际=%d", maxNoteKeywordSearchLimit, gotLimit)
	}
	if !strings.Contains(gotQuery, `"alpha"`) || !strings.Contains(gotQuery, `"beta"`) {
		t.Fatalf("期望查询语句包含分词项，实际=%s", gotQuery)
	}

	var payload struct {
		Blocks []struct {
			ID string `json:"id"`
		} `json:"blocks"`
		MatchedBlockCount int `json:"matchedBlockCount"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}

	if payload.MatchedBlockCount != 3 {
		t.Fatalf("期望 matchedBlockCount=3，实际=%d", payload.MatchedBlockCount)
	}
	if len(payload.Blocks) < 2 {
		t.Fatalf("期望至少返回2条结果，实际=%d", len(payload.Blocks))
	}
	if payload.Blocks[0].ID != "b2" {
		t.Fatalf("期望重排后首条为b2，实际=%s", payload.Blocks[0].ID)
	}
}

func TestExecuteNoteKeywordSearch_InvalidArgs(t *testing.T) {
	if _, err := executeNoteKeywordSearch(`{invalid`); err == nil {
		t.Fatal("期望非法JSON报错，实际成功")
	}
	if _, err := executeNoteKeywordSearch(`{"query":"   "}`); err == nil {
		t.Fatal("期望空query报错，实际成功")
	}
}
