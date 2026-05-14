package coordinator

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/sql"
)

var (
	getBlock            = model.GetBlock
	getChildBlocks      = model.GetChildBlocks
	getBlockKramdown    = model.GetBlockKramdown
	queryRefsByDefID    = sql.QueryRefsByDefID
	queryDefsByBlockID  = sql.QueryDefsByBlockID
	sqlGetBlock         = sql.GetBlock
)

const (
	defaultNoteByIDReadChildLimit = 200
	maxNoteByIDReadChildLimit     = 500
	maxNoteByIDReadLinkItems     = 50
)

type noteByIDReadToolArgs struct {
	ID     string `json:"id"`
	Start  int    `json:"start,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Format string `json:"format,omitempty"`
}

// noteByIDReadChildBlock 描述子块信息，与 model.ChildBlock 基本一致但仅包含序列化字段。
type noteByIDReadLinkItem struct {
	BlockID    string `json:"blockID"`
	RootID     string `json:"rootID,omitempty"`
	AnchorText string `json:"anchorText,omitempty"`
	Type       string `json:"type,omitempty"`
	Restricted bool   `json:"restricted,omitempty"`
}

type noteByIDReadChildBlock struct {
	ID       string `json:"id"`
	Type     string `json:"type,omitempty"`
	SubType  string `json:"subType,omitempty"`
	Content  string `json:"content,omitempty"`
	Markdown string `json:"markdown,omitempty"`
}

type noteByIDReadPayload struct {
	ID                 string                   `json:"id"`
	RootID             string                   `json:"rootID,omitempty"`
	Format             string                   `json:"format,omitempty"`
	RenderedContent    string                   `json:"renderedContent,omitempty"`
	Type               string                   `json:"type,omitempty"`
	Content            string                   `json:"content,omitempty"`
	Markdown           string                   `json:"markdown,omitempty"`
	Children           []noteByIDReadChildBlock `json:"children,omitempty"`
	ChildStart         int                      `json:"childStart,omitempty"`
	ChildLimit         int                      `json:"childLimit,omitempty"`
	TotalChildren      int                      `json:"totalChildren,omitempty"`
	ReturnedChildren   int                      `json:"returnedChildren,omitempty"`
	HasMoreChildren    bool                     `json:"hasMoreChildren,omitempty"`
	NextChildStart     int                      `json:"nextChildStart,omitempty"`
	Refs               []noteByIDReadLinkItem   `json:"refs,omitempty"`
	Defs               []noteByIDReadLinkItem   `json:"defs,omitempty"`
	Scope              map[string]interface{}   `json:"scope,omitempty"`
	PermissionHint     string                   `json:"permissionHint,omitempty"`
	RestrictedDocument string                   `json:"restrictedDocument,omitempty"`
}

type noteByIDReadToolResultExecutor struct{}

func newNoteByIDReadToolResultExecutor() *noteByIDReadToolResultExecutor {
	return &noteByIDReadToolResultExecutor{}
}

func (e *noteByIDReadToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.NoteByIDReadToolName {
		return "", false, nil
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.NoteByIDReadToolName)
	}

	result, err = executeNoteByIDRead(rawArgs)
	if err != nil {
		return "", true, err
	}
	return result, true, nil
}

func executeNoteByIDRead(rawArgs string) (string, error) {
	var args noteByIDReadToolArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", fmt.Errorf("%s 参数解析失败: %w", config.NoteByIDReadToolName, err)
	}

	blockID := strings.TrimSpace(args.ID)
	if blockID == "" {
		return "", fmt.Errorf("%s 的 id 不能为空", config.NoteByIDReadToolName)
	}

	format := normalizeNoteByIDReadFormat(args.Format)

	accessScope, accessErr := resolveWorkspaceAIMainNotebookAccessScope()
	if accessErr != nil {
		payload := noteByIDReadPayload{
			ID:             blockID,
			Format:         format,
			Scope:          buildNoteByIDReadScopePayload(accessScope, accessErr),
			PermissionHint: buildNoteByIDReadScopeMessage(accessScope, accessErr),
		}
		return marshalNoteByIDReadPayload(payload)
	}

	block, err := getBlock(blockID, nil)
	if err != nil {
		payload := noteByIDReadPayload{
			ID:     blockID,
			Format: format,
			Scope:  buildNoteByIDReadScopePayload(accessScope, nil),
		}
		return marshalNoteByIDReadPayload(payload)
	}
	if block == nil {
		payload := noteByIDReadPayload{
			ID:     blockID,
			Format: format,
			Scope:  buildNoteByIDReadScopePayload(accessScope, nil),
		}
		return marshalNoteByIDReadPayload(payload)
	}

	rootID := resolveNoteByIDReadRootID(block)
	accessibleRootIDs := resolveAccessibleRootIDs(accessScope)

	if _, accessible := accessibleRootIDs[rootID]; !accessible {
		payload := noteByIDReadPayload{
			ID:                 blockID,
			Format:             format,
			RestrictedDocument: rootID,
			Scope:              buildNoteByIDReadScopePayload(accessScope, nil),
			PermissionHint:     "目标内容超出当前 AI 主笔记本的直接读取范围。若需要详情，请先向用户请求阅读权限。",
		}
		return marshalNoteByIDReadPayload(payload)
	}

	refs := buildNoteByIDReadRefs(blockID, accessibleRootIDs)
	defs := buildNoteByIDReadDefs(blockID, accessibleRootIDs)

	// 对于 markdown/kramdown 格式，使用 GetBlockKramdown 渲染内容并直接返回
	if format == "markdown" || format == "kramdown" {
		kramdownMode := "md"
		if format == "kramdown" {
			kramdownMode = ""
		}
		rendered := getBlockKramdown(blockID, kramdownMode)
		payload := noteByIDReadPayload{
			ID:              block.ID,
			RootID:          block.RootID,
			Format:          format,
			RenderedContent: rendered,
			Refs:            refs,
			Defs:            defs,
			Scope:           buildNoteByIDReadScopePayload(accessScope, nil),
		}
		return marshalNoteByIDReadPayload(payload)
	}

	// tree 格式（默认）：读取子块并返回结构化信息
	childStart := normalizeNoteByIDReadChildStart(args.Start)
	childLimit := normalizeNoteByIDReadChildLimit(args.Limit)

	allChildren := getChildBlocks(blockID)
	totalChildren := len(allChildren)
	returnedChildren := 0
	var selectedChildren []*model.ChildBlock

	if childStart > 0 && childStart <= totalChildren {
		end := childStart + childLimit - 1
		if end > totalChildren {
			end = totalChildren
		}
		selectedChildren = allChildren[childStart-1 : end]
		returnedChildren = len(selectedChildren)
	} else if childStart <= 0 || childStart > totalChildren {
		selectedChildren = nil
		returnedChildren = 0
	} else {
		selectedChildren = allChildren
		returnedChildren = len(selectedChildren)
	}

	children := make([]noteByIDReadChildBlock, 0, returnedChildren)
	for _, c := range selectedChildren {
		if c == nil {
			continue
		}
		children = append(children, noteByIDReadChildBlock{
			ID:       c.ID,
			Type:     c.Type,
			SubType:  c.SubType,
			Content:  c.Content,
			Markdown: c.Markdown,
		})
	}

	hasMore := childStart > 0 && childLimit > 0 && (childStart+childLimit-1) < totalChildren
	nextChildStart := 0
	if hasMore {
		nextChildStart = childStart + childLimit
	}

	payload := noteByIDReadPayload{
		ID:               block.ID,
		RootID:           block.RootID,
		Type:             block.Type,
		Content:          block.Content,
		Markdown:         block.Markdown,
		Format:           "tree",
		Children:         children,
		ChildStart:       childStart,
		ChildLimit:       childLimit,
		TotalChildren:    totalChildren,
		ReturnedChildren: returnedChildren,
		HasMoreChildren:  hasMore,
		NextChildStart:   nextChildStart,
		Refs:             refs,
		Defs:             defs,
		Scope:            buildNoteByIDReadScopePayload(accessScope, nil),
	}
	return marshalNoteByIDReadPayload(payload)
}

// normalizeNoteByIDReadFormat 归一化 format 参数，空值或无效值默认返回 "markdown"。
func normalizeNoteByIDReadFormat(format string) string {
	format = strings.TrimSpace(strings.ToLower(format))
	switch format {
	case "tree", "markdown", "kramdown":
		return format
	default:
		return "markdown"
	}
}

func resolveNoteByIDReadRootID(block *model.Block) string {
	if block == nil {
		return ""
	}
	rootID := strings.TrimSpace(block.RootID)
	if rootID != "" {
		return rootID
	}
	return strings.TrimSpace(block.ID)
}

func resolveAccessibleRootIDs(accessScope *model.WorkspaceAIMainNotebookAccessScope) map[string]struct{} {
	if accessScope != nil && accessScope.AccessibleRootIDs != nil {
		return accessScope.AccessibleRootIDs
	}
	return map[string]struct{}{}
}

func normalizeNoteByIDReadChildStart(start int) int {
	if start <= 0 {
		return 1
	}
	return start
}

func normalizeNoteByIDReadChildLimit(limit int) int {
	if limit <= 0 {
		return defaultNoteByIDReadChildLimit
	}
	if limit > maxNoteByIDReadChildLimit {
		return maxNoteByIDReadChildLimit
	}
	return limit
}

func buildNoteByIDReadScopePayload(
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
		payload["message"] = buildNoteByIDReadScopeMessage(accessScope, scopeErr)
	}
	return payload
}

func buildNoteByIDReadScopeMessage(
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
		return "当前工作空间有多个AI主笔记本同时处于打开状态。请先选择一个保留打开，其余关闭后再继续读取。"
	case model.WorkspaceAIMainNotebookStatusInactive:
		return "当前工作空间存在多个AI主笔记本，但没有唯一的活动主笔记本。请先打开一个作为当前AI主笔记本。"
	default:
		return "当前工作空间还没有AI主笔记本，无法直接读取笔记。请先创建AI主笔记本。"
	}
}

func buildNoteByIDReadRefs(blockID string, accessibleRootIDs map[string]struct{}) []noteByIDReadLinkItem {
	refs := queryRefsByDefID(blockID, false)
	if len(refs) == 0 {
		return nil
	}

	items := make([]noteByIDReadLinkItem, 0, min(len(refs), maxNoteByIDReadLinkItems))
	for _, ref := range refs {
		if len(items) >= maxNoteByIDReadLinkItems {
			break
		}
		if ref == nil {
			continue
		}
		linkedRootID := strings.TrimSpace(ref.RootID)
		if _, accessible := accessibleRootIDs[linkedRootID]; accessible {
			items = append(items, noteByIDReadLinkItem{
				BlockID:    ref.BlockID,
				RootID:     linkedRootID,
				AnchorText: ref.Content,
				Type:       ref.Type,
			})
		} else {
			items = append(items, noteByIDReadLinkItem{
				BlockID:    ref.BlockID,
				RootID:     linkedRootID,
				Restricted: true,
			})
		}
	}
	if len(items) == 0 {
		return nil
	}
	return items
}

func buildNoteByIDReadDefs(blockID string, accessibleRootIDs map[string]struct{}) []noteByIDReadLinkItem {
	defs := queryDefsByBlockID(blockID)
	if len(defs) == 0 {
		return nil
	}

	items := make([]noteByIDReadLinkItem, 0, min(len(defs), maxNoteByIDReadLinkItems))
	for _, def := range defs {
		if len(items) >= maxNoteByIDReadLinkItems {
			break
		}
		if def == nil {
			continue
		}
		linkedRootID := strings.TrimSpace(def.DefBlockRootID)
		blockType := ""
		if sqlBlock := sqlGetBlock(def.DefBlockID); sqlBlock != nil {
			blockType = sqlBlock.Type
		}
		if _, accessible := accessibleRootIDs[linkedRootID]; accessible {
			items = append(items, noteByIDReadLinkItem{
				BlockID:    def.DefBlockID,
				RootID:     linkedRootID,
				AnchorText: def.Content,
				Type:       blockType,
			})
		} else {
			items = append(items, noteByIDReadLinkItem{
				BlockID:    def.DefBlockID,
				RootID:     linkedRootID,
				Restricted: true,
			})
		}
	}
	if len(items) == 0 {
		return nil
	}
	return items
}

func marshalNoteByIDReadPayload(payload noteByIDReadPayload) (string, error) {
	resultBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("%s 结果序列化失败: %w", config.NoteByIDReadToolName, err)
	}
	return string(resultBytes), nil
}
