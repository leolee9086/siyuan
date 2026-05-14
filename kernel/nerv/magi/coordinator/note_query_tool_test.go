package coordinator

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/88250/lute/ast"
	"github.com/88250/lute/parse"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/treenode"
)

func setupEnrichmentMocks(t *testing.T) func() {
	origLoadTree := loadTreeByIDForSearch
	origGetHPath := getTreeRootByHPathForSearch
	origGetBox := getConfBoxForSearch
	origBreadcrumb := buildBreadcrumbForSearch

	loadTreeByIDForSearch = func(rootID string) (*parse.Tree, error) {
		return &parse.Tree{
			Box:   "ai-box",
			Path:  "/2020/" + rootID + ".sy",
			HPath: "/" + rootID,
			Root:  &ast.Node{Type: ast.NodeDocument, ID: rootID},
		}, nil
	}
	getTreeRootByHPathForSearch = func(boxID, hPath string) *treenode.BlockTree {
		return nil
	}
	getConfBoxForSearch = func(boxID string) *model.Box {
		return &model.Box{ID: "ai-box", Name: "AI主笔记本"}
	}
	buildBreadcrumbForSearch = func(id string, excludeTypes []string) ([]*model.BlockPath, error) {
		return nil, nil
	}

	return func() {
		loadTreeByIDForSearch = origLoadTree
		getTreeRootByHPathForSearch = origGetHPath
		getConfBoxForSearch = origGetBox
		buildBreadcrumbForSearch = origBreadcrumb
	}
}

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
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() {
		runNoteKeywordFullTextSearch = originalSearchFn
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
	}()
	defer setupEnrichmentMocks(t)()

	var gotQuery string
	var gotLimit int
	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{
				"r1": {},
				"r2": {},
				"r3": {},
			},
			ReferencedRootIDs: map[string]struct{}{},
		}, nil
	}
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		gotQuery = query
		gotLimit = limit
		return []*model.Block{
			{ID: "b1", RootID: "r1", Content: "alpha"},
			{ID: "b2", RootID: "r2", Content: "alpha beta beta"},
			{ID: "b3", RootID: "r3", Content: "gamma"},
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

func TestExecuteNoteKeywordSearch_FiltersRestrictedDocsToIDs(t *testing.T) {
	originalSearchFn := runNoteKeywordFullTextSearch
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() {
		runNoteKeywordFullTextSearch = originalSearchFn
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
	}()
	defer setupEnrichmentMocks(t)()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{
				"doc-visible": {},
			},
			ReferencedRootIDs: map[string]struct{}{},
		}, nil
	}
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "b1", RootID: "doc-hidden", Content: "outside"},
			{ID: "b2", RootID: "doc-visible", Content: "inside"},
			{ID: "b3", RootID: "doc-hidden", Content: "outside again"},
		}, 3, 2, 1, false
	}

	result, err := executeNoteKeywordSearch(`{"query":"inside","limit":10}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		Blocks []struct {
			ID string `json:"id"`
		} `json:"blocks"`
		RestrictedDocumentIDs []string `json:"restrictedDocumentIDs"`
		PermissionHint        string   `json:"permissionHint"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}

	if len(payload.Blocks) != 1 || payload.Blocks[0].ID != "b2" {
		t.Fatalf("期望仅保留可直接读取块 b2，实际=%+v", payload.Blocks)
	}
	if len(payload.RestrictedDocumentIDs) != 1 || payload.RestrictedDocumentIDs[0] != "doc-hidden" {
		t.Fatalf("期望仅返回受限文档ID doc-hidden，实际=%v", payload.RestrictedDocumentIDs)
	}
	if payload.PermissionHint == "" {
		t.Fatal("期望存在阅读权限提示")
	}
}

func TestExecuteNoteKeywordSearch_ReturnsScopeMessageWhenConflict(t *testing.T) {
	originalSearchFn := runNoteKeywordFullTextSearch
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() {
		runNoteKeywordFullTextSearch = originalSearchFn
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
	}()

	searchCalled := false
	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status: model.WorkspaceAIMainNotebookStatusConflict,
				Notebooks: []*model.Box{
					{ID: "ai-1", Name: "AI-1"},
					{ID: "ai-2", Name: "AI-2"},
				},
				OpenNotebooks: []*model.Box{
					{ID: "ai-1", Name: "AI-1"},
					{ID: "ai-2", Name: "AI-2"},
				},
			},
		}, model.ErrWorkspaceAIMainNotebookConflict
	}
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		searchCalled = true
		return nil, 0, 0, 0, false
	}

	result, err := executeNoteKeywordSearch(`{"query":"inside","limit":10}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}
	if searchCalled {
		t.Fatal("冲突状态下不应执行全文检索")
	}

	var payload struct {
		Blocks         []struct{} `json:"blocks"`
		PermissionHint string     `json:"permissionHint"`
		Scope          struct {
			Status string `json:"status"`
		} `json:"scope"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Scope.Status != model.WorkspaceAIMainNotebookStatusConflict {
		t.Fatalf("期望scope.status=%s，实际=%s", model.WorkspaceAIMainNotebookStatusConflict, payload.Scope.Status)
	}
	if payload.PermissionHint == "" {
		t.Fatal("期望冲突状态下返回操作提示")
	}
	if len(payload.Blocks) != 0 {
		t.Fatalf("冲突状态下不应返回块结果，实际=%d", len(payload.Blocks))
	}
}

func TestExecuteNoteKeywordSearch_EnrichedStructure(t *testing.T) {
	originalSearchFn := runNoteKeywordFullTextSearch
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() {
		runNoteKeywordFullTextSearch = originalSearchFn
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
	}()
	defer setupEnrichmentMocks(t)()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{
				"root-doc": {},
			},
			ReferencedRootIDs: map[string]struct{}{},
		}, nil
	}
	runNoteKeywordFullTextSearch = func(query string, limit int) ([]*model.Block, int, int, int, bool) {
		return []*model.Block{
			{ID: "b1", RootID: "root-doc", Type: "NodeParagraph", SubType: "", Content: "some content"},
		}, 1, 1, 1, false
	}

	result, err := executeNoteKeywordSearch(`{"query":"content"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		Blocks []struct {
			ID        string `json:"id"`
			Type      string `json:"type"`
			Content   string `json:"content"`
			Notebook  struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"notebook"`
			Path      []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"path"`
			Headings  []struct {
				ID   string `json:"id"`
				Name string `json:"name"`
			} `json:"headings"`
			LeafIndex int `json:"leafIndex"`
		} `json:"blocks"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}

	if len(payload.Blocks) != 1 {
		t.Fatalf("期望1条结果，实际=%d", len(payload.Blocks))
	}
	b := payload.Blocks[0]
	if b.ID != "b1" {
		t.Fatalf("期望ID=b1，实际=%s", b.ID)
	}
	if b.Type != "NodeParagraph" {
		t.Fatalf("期望Type=NodeParagraph，实际=%s", b.Type)
	}
	if b.Content != "some content" {
		t.Fatalf("期望Content=some content，实际=%s", b.Content)
	}
	if b.Notebook.ID != "ai-box" {
		t.Fatalf("期望Notebook.ID=ai-box，实际=%s", b.Notebook.ID)
	}
	if b.Notebook.Name != "AI主笔记本" {
		t.Fatalf("期望Notebook.Name=AI主笔记本，实际=%s", b.Notebook.Name)
	}
	if len(b.Path) != 1 {
		t.Fatalf("期望Path有1段，实际=%d", len(b.Path))
	}
	if b.Path[0].ID != "root-doc" {
		t.Fatalf("期望Path[0].ID=root-doc，实际=%s", b.Path[0].ID)
	}
	if b.Path[0].Name != "root-doc" {
		t.Fatalf("期望Path[0].Name=root-doc，实际=%s", b.Path[0].Name)
	}
	if b.LeafIndex != -1 {
		t.Fatalf("期望LeafIndex=-1（文档根容器），实际=%d", b.LeafIndex)
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
