package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/88250/lute/parse"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/sql"
)

func TestNormalizeNoteByIDReadChildStart(t *testing.T) {
	if got := normalizeNoteByIDReadChildStart(0); got != 1 {
		t.Fatalf("期望 start=0 时返回 1，实际=%d", got)
	}
	if got := normalizeNoteByIDReadChildStart(-5); got != 1 {
		t.Fatalf("期望 start=-5 时返回 1，实际=%d", got)
	}
	if got := normalizeNoteByIDReadChildStart(3); got != 3 {
		t.Fatalf("期望 start=3 时返回 3，实际=%d", got)
	}
}

func TestNormalizeNoteByIDReadChildLimit(t *testing.T) {
	if got := normalizeNoteByIDReadChildLimit(0); got != defaultNoteByIDReadChildLimit {
		t.Fatalf("期望 limit=0 时返回默认值 %d，实际=%d", defaultNoteByIDReadChildLimit, got)
	}
	if got := normalizeNoteByIDReadChildLimit(-1); got != defaultNoteByIDReadChildLimit {
		t.Fatalf("期望 limit=-1 时返回默认值 %d，实际=%d", defaultNoteByIDReadChildLimit, got)
	}
	if got := normalizeNoteByIDReadChildLimit(maxNoteByIDReadChildLimit + 100); got != maxNoteByIDReadChildLimit {
		t.Fatalf("期望 limit 超过最大值时被截断为 %d，实际=%d", maxNoteByIDReadChildLimit, got)
	}
	if got := normalizeNoteByIDReadChildLimit(42); got != 42 {
		t.Fatalf("期望 limit=42 时保留原值，实际=%d", got)
	}
}

func TestResolveNoteByIDReadRootID(t *testing.T) {
	if got := resolveNoteByIDReadRootID(nil); got != "" {
		t.Fatalf("期望 nil block 返回空字符串，实际=%s", got)
	}
	if got := resolveNoteByIDReadRootID(&model.Block{ID: "b1", RootID: "root1"}); got != "root1" {
		t.Fatalf("期望返回 RootID=root1，实际=%s", got)
	}
	if got := resolveNoteByIDReadRootID(&model.Block{ID: "b1", RootID: "  root1  "}); got != "root1" {
		t.Fatalf("期望 trim 后返回 root1，实际=%s", got)
	}
	if got := resolveNoteByIDReadRootID(&model.Block{ID: "b1"}); got != "b1" {
		t.Fatalf("期望 RootID 为空时返回 block.ID=b1，实际=%s", got)
	}
}

func TestExecuteNoteByIDRead_InvalidArgs(t *testing.T) {
	if _, err := executeNoteByIDRead(`{invalid`); err == nil {
		t.Fatal("期望非法JSON报错，实际成功")
	}
	if _, err := executeNoteByIDRead(`{"id":"   "}`); err == nil {
		t.Fatal("期望空id报错，实际成功")
	}
}

func TestExecuteNoteByIDRead_ScopeConflict(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() { resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn }()

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

	result, err := executeNoteByIDRead(`{"id":"block-1"}`)
	if err != nil {
		t.Fatalf("期望冲突状态下执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID             string `json:"id"`
		PermissionHint string `json:"permissionHint"`
		Scope          struct {
			Status string `json:"status"`
		} `json:"scope"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Scope.Status != model.WorkspaceAIMainNotebookStatusConflict {
		t.Fatalf("期望 scope.status=%s，实际=%s", model.WorkspaceAIMainNotebookStatusConflict, payload.Scope.Status)
	}
	if payload.PermissionHint == "" {
		t.Fatal("期望冲突状态下返回操作提示")
	}
}

func TestExecuteNoteByIDRead_ScopeInactive(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() { resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn }()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status: model.WorkspaceAIMainNotebookStatusInactive,
				Notebooks: []*model.Box{
					{ID: "ai-1", Name: "AI-1"},
					{ID: "ai-2", Name: "AI-2"},
				},
				OpenNotebooks: []*model.Box{},
			},
		}, model.ErrWorkspaceAIMainNotebookInactive
	}

	result, err := executeNoteByIDRead(`{"id":"block-1"}`)
	if err != nil {
		t.Fatalf("期望非活动状态下执行成功，实际错误: %v", err)
	}

	var payload struct {
		PermissionHint string `json:"permissionHint"`
		Scope          struct {
			Status string `json:"status"`
		} `json:"scope"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Scope.Status != model.WorkspaceAIMainNotebookStatusInactive {
		t.Fatalf("期望 scope.status=%s，实际=%s", model.WorkspaceAIMainNotebookStatusInactive, payload.Scope.Status)
	}
	if payload.PermissionHint == "" {
		t.Fatal("期望非活动状态下返回操作提示")
	}
}

func TestExecuteNoteByIDRead_GetBlockError(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}
	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return nil, fmt.Errorf("数据库错误")
	}

	result, err := executeNoteByIDRead(`{"id":"block-err"}`)
	if err != nil {
		t.Fatalf("期望 GetBlock 错误时仍返回 payload，实际错误: %v", err)
	}
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ID != "block-err" {
		t.Fatalf("期望 ID=block-err，实际=%s", payload.ID)
	}
}

func TestExecuteNoteByIDRead_BlockNotFound(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}
	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return nil, nil
	}

	result, err := executeNoteByIDRead(`{"id":"block-missing"}`)
	if err != nil {
		t.Fatalf("期望 block 为 nil 时仍返回 payload，实际错误: %v", err)
	}
	var payload struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ID != "block-missing" {
		t.Fatalf("期望 ID=block-missing，实际=%s", payload.ID)
	}
}

func TestExecuteNoteByIDRead_RestrictedDocument(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}
	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "block-hidden", RootID: "doc-hidden", Type: "p", Content: "secret"}, nil
	}

	result, err := executeNoteByIDRead(`{"id":"block-hidden"}`)
	if err != nil {
		t.Fatalf("期望受限文档仍返回 payload，实际错误: %v", err)
	}

	var payload struct {
		ID                 string `json:"id"`
		RestrictedDocument string `json:"restrictedDocument"`
		PermissionHint     string `json:"permissionHint"`
		Scope              struct {
			Status string `json:"status"`
		} `json:"scope"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.RestrictedDocument != "doc-hidden" {
		t.Fatalf("期望 restrictedDocument=doc-hidden，实际=%s", payload.RestrictedDocument)
	}
	if payload.PermissionHint == "" {
		t.Fatal("期望受限文档返回权限提示")
	}
	if payload.ID != "block-hidden" {
		t.Fatalf("期望 ID=block-hidden，实际=%s", payload.ID)
	}
}

func TestExecuteNoteByIDRead_Success(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetChildBlocks := getChildBlocks
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getChildBlocks = originalGetChildBlocks
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{
			ID:      "block-main",
			RootID:  "doc-visible",
			Type:    "h",
			Content: "标题内容",
		}, nil
	}

	getChildBlocks = func(id string) []*model.ChildBlock {
		return []*model.ChildBlock{
			{ID: "child-1", Type: "p", Content: "段落1正文"},
			{ID: "child-2", Type: "p", Content: "段落2正文"},
		}
	}

	result, err := executeNoteByIDRead(`{"id":"block-main","format":"tree"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID               string `json:"id"`
		RootID           string `json:"rootID"`
		Format           string `json:"format"`
		Type             string `json:"type"`
		Content          string `json:"content"`
		TotalChildren    int    `json:"totalChildren"`
		ReturnedChildren int    `json:"returnedChildren"`
		Children         []struct {
			ID string `json:"id"`
		} `json:"children"`
		HasMoreChildren bool `json:"hasMoreChildren"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ID != "block-main" {
		t.Fatalf("期望 ID=block-main，实际=%s", payload.ID)
	}
	if payload.RootID != "doc-visible" {
		t.Fatalf("期望 RootID=doc-visible，实际=%s", payload.RootID)
	}
	if payload.TotalChildren != 2 {
		t.Fatalf("期望 TotalChildren=2，实际=%d", payload.TotalChildren)
	}
	if payload.ReturnedChildren != 2 {
		t.Fatalf("期望 ReturnedChildren=2，实际=%d", payload.ReturnedChildren)
	}
	if len(payload.Children) != 2 {
		t.Fatalf("期望 Children 长度为2，实际=%d", len(payload.Children))
	}
	if payload.Children[0].ID != "child-1" {
		t.Fatalf("期望 children[0].ID=child-1，实际=%s", payload.Children[0].ID)
	}
	if payload.HasMoreChildren {
		t.Fatal("期望 HasMoreChildren=false，实际=true")
	}
	if payload.Format != "tree" {
		t.Fatalf("期望 Format=tree，实际=%s", payload.Format)
	}
}

func TestExecuteNoteByIDRead_PartialChildren(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetChildBlocks := getChildBlocks
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getChildBlocks = originalGetChildBlocks
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{
			ID:      "block-main",
			RootID:  "doc-visible",
			Type:    "h",
			Content: "标题",
		}, nil
	}

	getChildBlocks = func(id string) []*model.ChildBlock {
		children := make([]*model.ChildBlock, 10)
		for i := 0; i < 10; i++ {
			children[i] = &model.ChildBlock{
				ID:      fmt.Sprintf("child-%d", i+1),
				Type:    "p",
				Content: "内容",
			}
		}
		return children
	}

	result, err := executeNoteByIDRead(`{"id":"block-main","format":"tree","start":3,"limit":3}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID               string `json:"id"`
		TotalChildren    int    `json:"totalChildren"`
		ReturnedChildren int    `json:"returnedChildren"`
		ChildStart       int    `json:"childStart"`
		ChildLimit       int    `json:"childLimit"`
		HasMoreChildren  bool   `json:"hasMoreChildren"`
		NextChildStart   int    `json:"nextChildStart"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ChildStart != 3 {
		t.Fatalf("期望 ChildStart=3，实际=%d", payload.ChildStart)
	}
	if payload.ChildLimit != 3 {
		t.Fatalf("期望 ChildLimit=3，实际=%d", payload.ChildLimit)
	}
	if payload.ReturnedChildren != 3 {
		t.Fatalf("期望 ReturnedChildren=3，实际=%d", payload.ReturnedChildren)
	}
	if payload.TotalChildren != 10 {
		t.Fatalf("期望 TotalChildren=10，实际=%d", payload.TotalChildren)
	}
	if !payload.HasMoreChildren {
		t.Fatal("期望 HasMoreChildren=true，实际=false")
	}
	if payload.NextChildStart != 6 {
		t.Fatalf("期望 NextChildStart=6，实际=%d", payload.NextChildStart)
	}
}

func TestExecuteNoteByIDRead_StartBeyondTotal(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetChildBlocks := getChildBlocks
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getChildBlocks = originalGetChildBlocks
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "b", RootID: "doc-visible", Type: "p", Content: "x"}, nil
	}

	getChildBlocks = func(id string) []*model.ChildBlock {
		return []*model.ChildBlock{
			{ID: "c1", Type: "p", Content: "a"},
			{ID: "c2", Type: "p", Content: "b"},
		}
	}

	result, err := executeNoteByIDRead(`{"id":"b","start":10,"limit":5}`)
	if err != nil {
		t.Fatalf("期望 start 超出范围时仍返回 payload，实际错误: %v", err)
	}

	var payload struct {
		ReturnedChildren int  `json:"returnedChildren"`
		HasMoreChildren  bool `json:"hasMoreChildren"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ReturnedChildren != 0 {
		t.Fatalf("期望 start 超出范围时返回 0 个子块，实际=%d", payload.ReturnedChildren)
	}
	if payload.HasMoreChildren {
		t.Fatal("期望 HasMoreChildren=false，实际=true")
	}
}

func TestNoteByIDReadToolResultExecutor_HandlesOnlyOwnTool(t *testing.T) {
	executor := newNoteByIDReadToolResultExecutor()

	result, handled, err := executor.ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.NoteKeywordSearchToolName,
			Arguments: `{"query":"test"}`,
		},
	})
	if handled {
		t.Fatalf("期望不处理其他工具，实际 handled=true，result=%s", result)
	}
	if err != nil {
		t.Fatalf("期望不处理时无错误，实际: %v", err)
	}
}

func TestNoteByIDReadToolResultExecutor_EmptyArgs(t *testing.T) {
	executor := newNoteByIDReadToolResultExecutor()

	_, handled, err := executor.ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.NoteByIDReadToolName,
			Arguments: "",
		},
	})
	if !handled {
		t.Fatal("期望处理空参数，实际 handled=false")
	}
	if err == nil {
		t.Fatal("期望空参数报错，实际成功")
	}
}

func TestBuildNoteByIDReadScopeMessage(t *testing.T) {
	msg := buildNoteByIDReadScopeMessage(nil, fmt.Errorf("test error"))
	if msg == "" {
		t.Fatal("期望 scope 错误时返回非空消息")
	}
	if !strings.Contains(msg, "AI主笔记本") {
		t.Fatalf("期望消息包含 AI主笔记本，实际=%s", msg)
	}

	scope := &model.WorkspaceAIMainNotebookAccessScope{
		State: &model.WorkspaceAIMainNotebookState{
			Status: model.WorkspaceAIMainNotebookStatusConflict,
		},
	}
	msg = buildNoteByIDReadScopeMessage(scope, fmt.Errorf("test error"))
	if !strings.Contains(msg, "多个AI主笔记本") {
		t.Fatalf("期望冲突消息包含'多个AI主笔记本'，实际=%s", msg)
	}

	scope = &model.WorkspaceAIMainNotebookAccessScope{
		State: &model.WorkspaceAIMainNotebookState{
			Status: model.WorkspaceAIMainNotebookStatusInactive,
		},
	}
	msg = buildNoteByIDReadScopeMessage(scope, fmt.Errorf("test error"))
	if !strings.Contains(msg, "多个AI主笔记本") {
		t.Fatalf("期望非活跃消息包含'多个AI主笔记本'，实际=%s", msg)
	}

	scope = &model.WorkspaceAIMainNotebookAccessScope{
		State: &model.WorkspaceAIMainNotebookState{
			Status: model.WorkspaceAIMainNotebookStatusMissing,
		},
	}
	msg = buildNoteByIDReadScopeMessage(scope, fmt.Errorf("test error"))
	if !strings.Contains(msg, "还没有AI主笔记本") {
		t.Fatalf("期望缺失消息包含'还没有AI主笔记本'，实际=%s", msg)
	}
}

func TestBuildNoteByIDReadScopePayload_IncludesNotebookIDs(t *testing.T) {
	scope := &model.WorkspaceAIMainNotebookAccessScope{
		State: &model.WorkspaceAIMainNotebookState{
			Status: model.WorkspaceAIMainNotebookStatusReady,
			Notebooks: []*model.Box{
				{ID: "nb-1", Name: "NB1"},
				{ID: "nb-2", Name: "NB2"},
			},
			OpenNotebooks: []*model.Box{
				{ID: "nb-1", Name: "NB1"},
			},
		},
		ActiveNotebook: &model.Box{ID: "nb-1", Name: "NB1"},
	}

	payload := buildNoteByIDReadScopePayload(scope, nil)
	if payload == nil {
		t.Fatal("期望 payload 非 nil")
	}
	status, ok := payload["status"].(string)
	if !ok || status != model.WorkspaceAIMainNotebookStatusReady {
		t.Fatalf("期望 status=%s，实际=%v", model.WorkspaceAIMainNotebookStatusReady, payload["status"])
	}
	if payload["message"] != nil {
		t.Fatal("期望无错误时不包含 message")
	}
}

func TestNormalizeNoteByIDReadFormat(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", "markdown"},
		{"  ", "markdown"},
		{"tree", "tree"},
		{"TREE", "tree"},
		{"Tree", "tree"},
		{"markdown", "markdown"},
		{"MARKDOWN", "markdown"},
		{"kramdown", "kramdown"},
		{"KRAMDOWN", "kramdown"},
		{"invalid", "markdown"},
		{"html", "markdown"},
	}
	for _, tt := range tests {
		if got := normalizeNoteByIDReadFormat(tt.input); got != tt.expected {
			t.Fatalf("normalizeNoteByIDReadFormat(%q) = %q，期望 %q", tt.input, got, tt.expected)
		}
	}
}

func TestExecuteNoteByIDRead_MarkdownFormat(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetBlockKramdown := getBlockKramdown
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getBlockKramdown = originalGetBlockKramdown
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{
			ID:      "block-main",
			RootID:  "doc-visible",
			Type:    "h",
			Content: "标题内容",
		}, nil
	}

	getBlockKramdown = func(id, mode string) string {
		if mode != "md" {
			t.Fatalf("markdown 格式期望 mode='md'，实际=%q", mode)
		}
		if id != "block-main" {
			t.Fatalf("期望 id='block-main'，实际=%q", id)
		}
		return "# 标题内容\n\n这是 markdown 渲染后的内容。"
	}

	result, err := executeNoteByIDRead(`{"id":"block-main","format":"markdown"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID              string `json:"id"`
		RootID          string `json:"rootID"`
		Format          string `json:"format"`
		RenderedContent string `json:"renderedContent"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ID != "block-main" {
		t.Fatalf("期望 ID=block-main，实际=%s", payload.ID)
	}
	if payload.RootID != "doc-visible" {
		t.Fatalf("期望 RootID=doc-visible，实际=%s", payload.RootID)
	}
	if payload.Format != "markdown" {
		t.Fatalf("期望 Format=markdown，实际=%s", payload.Format)
	}
	if payload.RenderedContent != "# 标题内容\n\n这是 markdown 渲染后的内容。" {
		t.Fatalf("期望 RenderedContent 正确，实际=%q", payload.RenderedContent)
	}
}

func TestExecuteNoteByIDRead_KramdownFormat(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetBlockKramdown := getBlockKramdown
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getBlockKramdown = originalGetBlockKramdown
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{
			ID:      "block-main",
			RootID:  "doc-visible",
			Type:    "h",
			Content: "标题内容",
		}, nil
	}

	getBlockKramdown = func(id, mode string) string {
		if mode != "" {
			t.Fatalf("kramdown 格式期望 mode=''，实际=%q", mode)
		}
		if id != "block-main" {
			t.Fatalf("期望 id='block-main'，实际=%q", id)
		}
		return "{: id=\"block-main\"}\n# 标题内容\n\n{: id=\"child-1\"}\n这是 kramdown 渲染后的内容。"
	}

	result, err := executeNoteByIDRead(`{"id":"block-main","format":"kramdown"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID              string `json:"id"`
		RootID          string `json:"rootID"`
		Format          string `json:"format"`
		RenderedContent string `json:"renderedContent"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.ID != "block-main" {
		t.Fatalf("期望 ID=block-main，实际=%s", payload.ID)
	}
	if payload.RootID != "doc-visible" {
		t.Fatalf("期望 RootID=doc-visible，实际=%s", payload.RootID)
	}
	if payload.Format != "kramdown" {
		t.Fatalf("期望 Format=kramdown，实际=%s", payload.Format)
	}
	if payload.RenderedContent == "" {
		t.Fatal("期望 RenderedContent 非空")
	}
	if !strings.Contains(payload.RenderedContent, "kramdown") {
		t.Fatalf("期望 RenderedContent 包含 'kramdown'，实际=%q", payload.RenderedContent)
	}
}

func TestExecuteNoteByIDRead_MarkdownFormatWithScopeConflict(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	defer func() { resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn }()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status: model.WorkspaceAIMainNotebookStatusConflict,
				Notebooks: []*model.Box{
					{ID: "ai-1", Name: "AI-1"},
				},
				OpenNotebooks: []*model.Box{
					{ID: "ai-1", Name: "AI-1"},
				},
			},
		}, model.ErrWorkspaceAIMainNotebookConflict
	}

	result, err := executeNoteByIDRead(`{"id":"block-1","format":"markdown"}`)
	if err != nil {
		t.Fatalf("期望冲突状态下执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID     string `json:"id"`
		Format string `json:"format"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Format != "markdown" {
		t.Fatalf("期望 Format=markdown，实际=%s", payload.Format)
	}
}

func TestExecuteNoteByIDRead_MarkdownFormatRestricted(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "block-hidden", RootID: "doc-hidden", Type: "p", Content: "secret"}, nil
	}

	result, err := executeNoteByIDRead(`{"id":"block-hidden","format":"markdown"}`)
	if err != nil {
		t.Fatalf("期望受限文档仍返回 payload，实际错误: %v", err)
	}

	var payload struct {
		ID                 string `json:"id"`
		Format             string `json:"format"`
		RestrictedDocument string `json:"restrictedDocument"`
		RenderedContent    string `json:"renderedContent"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Format != "markdown" {
		t.Fatalf("期望 Format=markdown，实际=%s", payload.Format)
	}
	if payload.RestrictedDocument != "doc-hidden" {
		t.Fatalf("期望 restrictedDocument=doc-hidden，实际=%s", payload.RestrictedDocument)
	}
	if payload.RenderedContent != "" {
		t.Fatal("期望受限文档不返回 renderedContent")
	}
}

func TestExecuteNoteByIDRead_DefaultFormatIsMarkdown(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetBlockKramdown := getBlockKramdown
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getBlockKramdown = originalGetBlockKramdown
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "b1", RootID: "doc-visible", Type: "p", Content: "x"}, nil
	}

	getBlockKramdown = func(id, mode string) string {
		return "rendered markdown content"
	}

	result, err := executeNoteByIDRead(`{"id":"b1"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID              string `json:"id"`
		Format          string `json:"format"`
		RenderedContent string `json:"renderedContent"`
		TotalChildren   int    `json:"totalChildren"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Format != "markdown" {
		t.Fatalf("默认 format 应为 markdown，实际=%s", payload.Format)
	}
	if payload.RenderedContent == "" {
		t.Fatal("markdown 格式应返回 renderedContent")
	}
	if payload.TotalChildren != 0 {
		t.Fatalf("期望 TotalChildren=0，实际=%d", payload.TotalChildren)
	}
}

func TestExecuteNoteByIDRead_ExplicitTreeFormat(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetChildBlocks := getChildBlocks
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getChildBlocks = originalGetChildBlocks
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "b1", RootID: "doc-visible", Type: "p", Content: "x"}, nil
	}

	getChildBlocks = func(id string) []*model.ChildBlock {
		return []*model.ChildBlock{
			{ID: "c1", Type: "p", Content: "a"},
		}
	}

	result, err := executeNoteByIDRead(`{"id":"b1","format":"tree"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		ID              string `json:"id"`
		Format          string `json:"format"`
		RenderedContent string `json:"renderedContent"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Format != "tree" {
		t.Fatalf("期望 Format=tree，实际=%s", payload.Format)
	}
	if payload.RenderedContent != "" {
		t.Fatal("tree 格式不应返回 renderedContent")
	}
}

func TestExecuteNoteByIDRead_MarkdownFormatGetBlockError(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return nil, fmt.Errorf("数据库错误")
	}

	result, err := executeNoteByIDRead(`{"id":"block-err","format":"markdown"}`)
	if err != nil {
		t.Fatalf("期望错误时仍返回 payload，实际错误: %v", err)
	}

	var payload struct {
		ID     string `json:"id"`
		Format string `json:"format"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}
	if payload.Format != "markdown" {
		t.Fatalf("期望 Format=markdown，实际=%s", payload.Format)
	}
}

func TestBuildNoteByIDReadRefs_Accessible(t *testing.T) {
	originalQueryRefs := queryRefsByDefID
	defer func() { queryRefsByDefID = originalQueryRefs }()

	queryRefsByDefID = func(defBlockID string, containChildren bool) []*sql.Ref {
		return []*sql.Ref{
			{BlockID: "ref-block-1", RootID: "doc-visible", Content: "锚文本1", Type: "p"},
			{BlockID: "ref-block-2", RootID: "doc-visible", Content: "锚文本2", Type: "h"},
		}
	}

	accessibleRootIDs := map[string]struct{}{"doc-visible": {}}
	items := buildNoteByIDReadRefs("block-main", accessibleRootIDs)

	if len(items) != 2 {
		t.Fatalf("期望 2 个 refs，实际=%d", len(items))
	}
	if items[0].BlockID != "ref-block-1" {
		t.Fatalf("期望 items[0].BlockID=ref-block-1，实际=%s", items[0].BlockID)
	}
	if items[0].AnchorText != "锚文本1" {
		t.Fatalf("期望 items[0].AnchorText=锚文本1，实际=%s", items[0].AnchorText)
	}
	if items[0].Restricted {
		t.Fatal("期望 items[0] 非 restricted")
	}
	if items[1].BlockID != "ref-block-2" {
		t.Fatalf("期望 items[1].BlockID=ref-block-2，实际=%s", items[1].BlockID)
	}
}

func TestBuildNoteByIDReadRefs_Restricted(t *testing.T) {
	originalQueryRefs := queryRefsByDefID
	defer func() { queryRefsByDefID = originalQueryRefs }()

	queryRefsByDefID = func(defBlockID string, containChildren bool) []*sql.Ref {
		return []*sql.Ref{
			{BlockID: "ref-hidden", RootID: "doc-restricted", Content: "secret", Type: "p"},
		}
	}

	accessibleRootIDs := map[string]struct{}{"doc-visible": {}}
	items := buildNoteByIDReadRefs("block-main", accessibleRootIDs)

	if len(items) != 1 {
		t.Fatalf("期望 1 个 ref，实际=%d", len(items))
	}
	if items[0].BlockID != "ref-hidden" {
		t.Fatalf("期望 items[0].BlockID=ref-hidden，实际=%s", items[0].BlockID)
	}
	if items[0].RootID != "doc-restricted" {
		t.Fatalf("期望 items[0].RootID=doc-restricted，实际=%s", items[0].RootID)
	}
	if !items[0].Restricted {
		t.Fatal("期望 items[0] 标记为 restricted")
	}
	if items[0].AnchorText != "" {
		t.Fatalf("期望 restricted 项 AnchorText 为空，实际=%s", items[0].AnchorText)
	}
}

func TestBuildNoteByIDReadRefs_NilRef(t *testing.T) {
	originalQueryRefs := queryRefsByDefID
	defer func() { queryRefsByDefID = originalQueryRefs }()

	queryRefsByDefID = func(defBlockID string, containChildren bool) []*sql.Ref {
		return []*sql.Ref{nil, {BlockID: "ref-1", RootID: "doc-visible", Content: "ok", Type: "p"}}
	}

	accessibleRootIDs := map[string]struct{}{"doc-visible": {}}
	items := buildNoteByIDReadRefs("block-main", accessibleRootIDs)

	if len(items) != 1 {
		t.Fatalf("期望 1 个 ref（跳过 nil），实际=%d", len(items))
	}
	if items[0].BlockID != "ref-1" {
		t.Fatalf("期望 items[0].BlockID=ref-1，实际=%s", items[0].BlockID)
	}
}

func TestBuildNoteByIDReadRefs_Empty(t *testing.T) {
	originalQueryRefs := queryRefsByDefID
	defer func() { queryRefsByDefID = originalQueryRefs }()

	queryRefsByDefID = func(defBlockID string, containChildren bool) []*sql.Ref {
		return nil
	}

	items := buildNoteByIDReadRefs("block-main", map[string]struct{}{})
	if items != nil {
		t.Fatal("期望无 refs 时返回 nil")
	}
}

func TestBuildNoteByIDReadDefs_Accessible(t *testing.T) {
	originalQueryDefs := queryDefsByBlockID
	originalSQLGetBlock := sqlGetBlock
	defer func() {
		queryDefsByBlockID = originalQueryDefs
		sqlGetBlock = originalSQLGetBlock
	}()

	queryDefsByBlockID = func(blockID string) []*sql.Ref {
		return []*sql.Ref{
			{DefBlockID: "def-block-1", DefBlockRootID: "doc-visible", Content: "锚文本1"},
			{DefBlockID: "def-block-2", DefBlockRootID: "doc-visible", Content: "锚文本2"},
		}
	}

	sqlGetBlock = func(id string) *sql.Block {
		switch id {
		case "def-block-1":
			return &sql.Block{ID: "def-block-1", RootID: "doc-visible", Type: "d"}
		case "def-block-2":
			return &sql.Block{ID: "def-block-2", RootID: "doc-visible", Type: "h"}
		}
		return nil
	}

	accessibleRootIDs := map[string]struct{}{"doc-visible": {}}
	items := buildNoteByIDReadDefs("block-main", accessibleRootIDs)

	if len(items) != 2 {
		t.Fatalf("期望 2 个 defs，实际=%d", len(items))
	}
	if items[0].BlockID != "def-block-1" {
		t.Fatalf("期望 items[0].BlockID=def-block-1，实际=%s", items[0].BlockID)
	}
	if items[0].AnchorText != "锚文本1" {
		t.Fatalf("期望 items[0].AnchorText=锚文本1，实际=%s", items[0].AnchorText)
	}
	if items[0].Type != "d" {
		t.Fatalf("期望 items[0].Type=d，实际=%s", items[0].Type)
	}
	if items[0].Restricted {
		t.Fatal("期望 items[0] 非 restricted")
	}
	if items[1].Type != "h" {
		t.Fatalf("期望 items[1].Type=h，实际=%s", items[1].Type)
	}
}

func TestBuildNoteByIDReadDefs_Restricted(t *testing.T) {
	originalQueryDefs := queryDefsByBlockID
	defer func() { queryDefsByBlockID = originalQueryDefs }()

	queryDefsByBlockID = func(blockID string) []*sql.Ref {
		return []*sql.Ref{
			{DefBlockID: "def-hidden", DefBlockRootID: "doc-restricted", Content: "secret"},
		}
	}

	accessibleRootIDs := map[string]struct{}{"doc-visible": {}}
	items := buildNoteByIDReadDefs("block-main", accessibleRootIDs)

	if len(items) != 1 {
		t.Fatalf("期望 1 个 def，实际=%d", len(items))
	}
	if items[0].BlockID != "def-hidden" {
		t.Fatalf("期望 items[0].BlockID=def-hidden，实际=%s", items[0].BlockID)
	}
	if !items[0].Restricted {
		t.Fatal("期望 items[0] 标记为 restricted")
	}
	if items[0].AnchorText != "" {
		t.Fatalf("期望 restricted 项 AnchorText 为空，实际=%s", items[0].AnchorText)
	}
}

func TestBuildNoteByIDReadDefs_Empty(t *testing.T) {
	originalQueryDefs := queryDefsByBlockID
	defer func() { queryDefsByBlockID = originalQueryDefs }()

	queryDefsByBlockID = func(blockID string) []*sql.Ref {
		return nil
	}

	items := buildNoteByIDReadDefs("block-main", map[string]struct{}{})
	if items != nil {
		t.Fatal("期望无 defs 时返回 nil")
	}
}

func TestExecuteNoteByIDRead_RefsDefsInTreeFormat(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetChildBlocks := getChildBlocks
	originalQueryRefs := queryRefsByDefID
	originalQueryDefs := queryDefsByBlockID
	originalSQLGetBlock := sqlGetBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getChildBlocks = originalGetChildBlocks
		queryRefsByDefID = originalQueryRefs
		queryDefsByBlockID = originalQueryDefs
		sqlGetBlock = originalSQLGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "block-main", RootID: "doc-visible", Type: "p", Content: "正文"}, nil
	}

	getChildBlocks = func(id string) []*model.ChildBlock {
		return []*model.ChildBlock{{ID: "child-1", Type: "p", Content: "子块"}}
	}

	queryRefsByDefID = func(defBlockID string, containChildren bool) []*sql.Ref {
		return []*sql.Ref{
			{BlockID: "ref-1", RootID: "doc-visible", Content: "引用了此块", Type: "p"},
		}
	}

	queryDefsByBlockID = func(blockID string) []*sql.Ref {
		return []*sql.Ref{
			{DefBlockID: "def-1", DefBlockRootID: "doc-visible", Content: "被此块引用"},
		}
	}

	sqlGetBlock = func(id string) *sql.Block {
		return &sql.Block{ID: "def-1", RootID: "doc-visible", Type: "h"}
	}

	result, err := executeNoteByIDRead(`{"id":"block-main","format":"tree"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		Refs []struct {
			BlockID    string `json:"blockID"`
			RootID     string `json:"rootID"`
			AnchorText string `json:"anchorText"`
			Type       string `json:"type"`
			Restricted bool   `json:"restricted"`
		} `json:"refs"`
		Defs []struct {
			BlockID    string `json:"blockID"`
			RootID     string `json:"rootID"`
			AnchorText string `json:"anchorText"`
			Type       string `json:"type"`
			Restricted bool   `json:"restricted"`
		} `json:"defs"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}

	if len(payload.Refs) != 1 {
		t.Fatalf("期望 1 个 ref，实际=%d", len(payload.Refs))
	}
	if payload.Refs[0].BlockID != "ref-1" {
		t.Fatalf("期望 refs[0].BlockID=ref-1，实际=%s", payload.Refs[0].BlockID)
	}
	if payload.Refs[0].AnchorText != "引用了此块" {
		t.Fatalf("期望 refs[0].AnchorText=引用了此块，实际=%s", payload.Refs[0].AnchorText)
	}
	if payload.Refs[0].Restricted {
		t.Fatal("期望 refs[0] 非 restricted")
	}

	if len(payload.Defs) != 1 {
		t.Fatalf("期望 1 个 def，实际=%d", len(payload.Defs))
	}
	if payload.Defs[0].BlockID != "def-1" {
		t.Fatalf("期望 defs[0].BlockID=def-1，实际=%s", payload.Defs[0].BlockID)
	}
	if payload.Defs[0].AnchorText != "被此块引用" {
		t.Fatalf("期望 defs[0].AnchorText=被此块引用，实际=%s", payload.Defs[0].AnchorText)
	}
	if payload.Defs[0].Type != "h" {
		t.Fatalf("期望 defs[0].Type=h，实际=%s", payload.Defs[0].Type)
	}
	if payload.Defs[0].Restricted {
		t.Fatal("期望 defs[0] 非 restricted")
	}
}

func TestExecuteNoteByIDRead_RefsDefsInMarkdownFormat(t *testing.T) {
	originalAccessFn := resolveWorkspaceAIMainNotebookAccessScope
	originalGetBlock := getBlock
	originalGetBlockKramdown := getBlockKramdown
	originalQueryRefs := queryRefsByDefID
	originalQueryDefs := queryDefsByBlockID
	originalSQLGetBlock := sqlGetBlock
	defer func() {
		resolveWorkspaceAIMainNotebookAccessScope = originalAccessFn
		getBlock = originalGetBlock
		getBlockKramdown = originalGetBlockKramdown
		queryRefsByDefID = originalQueryRefs
		queryDefsByBlockID = originalQueryDefs
		sqlGetBlock = originalSQLGetBlock
	}()

	resolveWorkspaceAIMainNotebookAccessScope = func() (*model.WorkspaceAIMainNotebookAccessScope, error) {
		return &model.WorkspaceAIMainNotebookAccessScope{
			State: &model.WorkspaceAIMainNotebookState{
				Status:         model.WorkspaceAIMainNotebookStatusReady,
				ActiveNotebook: &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			},
			ActiveNotebook:    &model.Box{ID: "ai-box", Name: "AI主笔记本"},
			AccessibleRootIDs: map[string]struct{}{"doc-visible": {}},
		}, nil
	}

	getBlock = func(id string, tree *parse.Tree) (*model.Block, error) {
		return &model.Block{ID: "block-main", RootID: "doc-visible", Type: "p", Content: "正文"}, nil
	}

	getBlockKramdown = func(id, mode string) string {
		return "# 正文\n\n这是 markdown 内容。"
	}

	queryRefsByDefID = func(defBlockID string, containChildren bool) []*sql.Ref {
		return []*sql.Ref{{BlockID: "ref-1", RootID: "doc-visible", Content: "引用", Type: "p"}}
	}

	queryDefsByBlockID = func(blockID string) []*sql.Ref {
		return []*sql.Ref{{DefBlockID: "def-1", DefBlockRootID: "doc-visible", Content: "被引用"}}
	}

	sqlGetBlock = func(id string) *sql.Block {
		return &sql.Block{ID: "def-1", RootID: "doc-visible", Type: "h"}
	}

	result, err := executeNoteByIDRead(`{"id":"block-main","format":"markdown"}`)
	if err != nil {
		t.Fatalf("期望执行成功，实际错误: %v", err)
	}

	var payload struct {
		Refs []struct {
			BlockID string `json:"blockID"`
		} `json:"refs"`
		Defs []struct {
			BlockID string `json:"blockID"`
		} `json:"defs"`
	}
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("解析结果JSON失败: %v", err)
	}

	if len(payload.Refs) != 1 {
		t.Fatalf("期望 markdown 格式也返回 refs，实际=%d", len(payload.Refs))
	}
	if payload.Refs[0].BlockID != "ref-1" {
		t.Fatalf("期望 refs[0].BlockID=ref-1，实际=%s", payload.Refs[0].BlockID)
	}
	if len(payload.Defs) != 1 {
		t.Fatalf("期望 markdown 格式也返回 defs，实际=%d", len(payload.Defs))
	}
	if payload.Defs[0].BlockID != "def-1" {
		t.Fatalf("期望 defs[0].BlockID=def-1，实际=%s", payload.Defs[0].BlockID)
	}
}
