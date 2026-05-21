package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/88250/lute/ast"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/sages"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	kernelsql "github.com/siyuan-note/siyuan/kernel/sql"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	_pendingAttrKey          = "custom-magi-pending"
	_pendingAttrTimeKey      = "custom-magi-pending-time"
	_pendingAttrOriginalKey  = "custom-magi-pending-original"
	_pendingAttrExpiresKey   = "custom-magi-pending-expires"
	_pendingDefaultExpireDays = 7
)

type noteEditToolResultExecutor struct{}

func newNoteEditToolResultExecutor() *noteEditToolResultExecutor {
	return &noteEditToolResultExecutor{}
}

func (e *noteEditToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (string, bool, error) {
	name := strings.TrimSpace(toolCall.Function.Name)
	switch name {
	case config.CreateNoteDocumentToolName:
		return e.executeCreateDocument(toolCall)
	case config.AppendNoteBlocksToolName:
		return e.executeAppendBlocks(toolCall)
	case config.ModifyNoteBlockToolName:
		return e.executeModifyBlock(toolCall)
	case config.RevertNoteBlockToolName:
		return e.executeRevertBlock(toolCall)
	default:
		return "", false, nil
	}
}

type createDocumentArgs struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Path    string `json:"path,omitempty"`
}

func (e *noteEditToolResultExecutor) executeCreateDocument(toolCall types.ToolCall) (string, bool, error) {
	var args createDocumentArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err)), true, nil
	}
	args.Title = strings.TrimSpace(args.Title)
	args.Content = strings.TrimSpace(args.Content)
	if args.Title == "" {
		return marshalNoteEditError("TITLE_REQUIRED", "title 不能为空"), true, nil
	}

	if links, valid := validateNoteToolContent(config.CreateNoteDocumentToolName, toolCall.Function.Arguments); !valid {
		return marshalLinkInsufficientResult(config.CreateNoteDocumentToolName, links), true, nil
	}

	if _, err := resolveAIMainNotebookBox(); err != nil {
		return marshalNoteEditError("NOTEBOOK_NOT_FOUND", err.Error()), true, nil
	}

	payload := map[string]interface{}{
		"ok":    true,
		"state": "pending_governance",
		"title": args.Title,
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

type appendBlocksArgs struct {
	ParentID string `json:"parent_id"`
	Content  string `json:"content"`
	AfterID  string `json:"after_id,omitempty"`
}

func (e *noteEditToolResultExecutor) executeAppendBlocks(toolCall types.ToolCall) (string, bool, error) {
	var args appendBlocksArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err)), true, nil
	}
	args.ParentID = strings.TrimSpace(args.ParentID)
	args.Content = strings.TrimSpace(args.Content)
	if args.ParentID == "" || args.Content == "" {
		return marshalNoteEditError("PARENT_OR_CONTENT_REQUIRED", "parent_id 和 content 不能为空"), true, nil
	}

	if links, valid := validateNoteToolContent(config.AppendNoteBlocksToolName, toolCall.Function.Arguments); !valid {
		return marshalLinkInsufficientResult(config.AppendNoteBlocksToolName, links), true, nil
	}

	if err := ensureAIMainNotebookScope(args.ParentID); err != nil {
		return marshalNoteEditError("NOTEBOOK_SCOPE", err.Error()), true, nil
	}

	parent, err := model.GetBlock(args.ParentID, nil)
	if err != nil {
		return marshalNoteEditError("PARENT_NOT_FOUND", fmt.Sprintf("父块不存在: %v", err)), true, nil
	}
	children := model.GetChildBlocks(parent.ID)
	if len(children) > 0 && parent.Type != "NodeDocument" && parent.Type != "NodeBlockquote" && parent.Type != "NodeListItem" && parent.Type != "NodeSuperBlock" {
		return marshalNoteEditError("PARENT_NOT_CONTAINER", "父块不是容器块，无法追加子块"), true, nil
	}

	afterID := strings.TrimSpace(args.AfterID)
	if afterID != "" {
		if err := ensureBlockIsDescendantOf(afterID, args.ParentID); err != nil {
			return marshalNoteEditError("AFTER_ID_NOT_DESCENDANT", err.Error()), true, nil
		}
	}

	payload := map[string]interface{}{
		"ok":        true,
		"state":     "pending_governance",
		"parent_id": args.ParentID,
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

type modifyBlockArgs struct {
	BlockID string            `json:"block_id"`
	Content string            `json:"content"`
	Attrs   map[string]string `json:"attrs,omitempty"`
}

func (e *noteEditToolResultExecutor) executeModifyBlock(toolCall types.ToolCall) (string, bool, error) {
	var args modifyBlockArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err)), true, nil
	}
	args.BlockID = strings.TrimSpace(args.BlockID)
	args.Content = strings.TrimSpace(args.Content)
	if args.BlockID == "" || args.Content == "" {
		return marshalNoteEditError("BLOCK_ID_OR_CONTENT_REQUIRED", "block_id 和 content 不能为空"), true, nil
	}

	if links, valid := validateNoteToolContent(config.ModifyNoteBlockToolName, toolCall.Function.Arguments); !valid {
		return marshalLinkInsufficientResult(config.ModifyNoteBlockToolName, links), true, nil
	}

	if err := ensureAIMainNotebookScope(args.BlockID); err != nil {
		return marshalNoteEditError("NOTEBOOK_SCOPE", err.Error()), true, nil
	}

	block, err := model.GetBlock(args.BlockID, nil)
	if err != nil {
		return marshalNoteEditError("BLOCK_NOT_FOUND", fmt.Sprintf("块不存在: %v", err)), true, nil
	}
	if !isLeafBlock(block) {
		return marshalNoteEditError("BLOCK_NOT_LEAF", "目标不是叶子块，不可修改"), true, nil
	}

	attrs := block.IAL
	if attrs == nil {
		attrs = kernelsql.GetBlockAttrs(args.BlockID)
	}
	if attrs != nil {
		if pending, ok := attrs[_pendingAttrKey]; ok && pending == "true" {
			if expiresStr, hasExpires := attrs[_pendingAttrExpiresKey]; hasExpires {
				expiresAt, parseErr := parseInt64(expiresStr)
				if parseErr == nil && time.Now().UnixMilli() < expiresAt {
					return marshalNoteEditError("BLOCK_ALREADY_PENDING", "该块已有未接受的 MAGI 修改，请先在前端接受后再试"), true, nil
				}
			} else {
				return marshalNoteEditError("BLOCK_ALREADY_PENDING", "该块已有未接受的 MAGI 修改，请先在前端接受后再试"), true, nil
			}
		}
	}

	payload := map[string]interface{}{
		"ok":       true,
		"state":    "pending_governance",
		"block_id": args.BlockID,
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

type revertBlockArgs struct {
	BlockID string `json:"block_id"`
}

func (e *noteEditToolResultExecutor) executeRevertBlock(toolCall types.ToolCall) (string, bool, error) {
	var args revertBlockArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err)), true, nil
	}
	args.BlockID = strings.TrimSpace(args.BlockID)
	if args.BlockID == "" {
		return marshalNoteEditError("BLOCK_ID_REQUIRED", "block_id 不能为空"), true, nil
	}

	attrs := kernelsql.GetBlockAttrs(args.BlockID)
	if attrs == nil || attrs[_pendingAttrKey] != "true" {
		return marshalNoteEditError("BLOCK_NOT_PENDING", "该块没有 pending 修改"), true, nil
	}

	payload := map[string]interface{}{
		"ok":       true,
		"state":    "pending_governance",
		"block_id": args.BlockID,
	}
	raw, _ := json.Marshal(payload)
	return string(raw), true, nil
}

func (e *noteEditToolResultExecutor) MaterializeResult(ctx context.Context, sessionID, roundID string, sage *sages.Sage, assistantContent string, toolCall types.ToolCall, detailedResult string) string {
	return materializeNoteEditResult(ctx, sessionID, roundID, sage, assistantContent, toolCall, detailedResult)
}

func materializeNoteEditResult(
	ctx context.Context,
	sessionID, roundID string,
	sage *sages.Sage,
	assistantContent string,
	toolCall types.ToolCall,
	detailedResult string,
) string {
	toolName := strings.TrimSpace(toolCall.Function.Name)

	payload := map[string]interface{}{}
	if trimmed := strings.TrimSpace(detailedResult); trimmed != "" {
		_ = json.Unmarshal([]byte(trimmed), &payload)
	}
	if len(payload) == 0 {
		payload["ok"] = true
		payload["state"] = "pending_governance"
	}

	outcome, governed, voteErr := dominantActionToolGovernance.EvaluateActionVote(
		ctx, sessionID, roundID, sage, assistantContent, toolCall,
	)
	if voteErr != nil {
		return marshalNoteEditError("GOVERNANCE_ERROR", voteErr.Error())
	}
	if governed && outcome != nil && outcome.Rejected {
		resultPayload := map[string]interface{}{
			"ok":         false,
			"state":      "rejected",
			"toolName":   toolName,
			"motivation": extractGovernedActionMotivation(toolCall),
		}
		if outcome.LostDominance {
			resultPayload["state"] = "dominance_revoked"
		}
		if len(outcome.RejectionReasons) > 0 {
			resultPayload["rejectionReasons"] = outcome.RejectionReasons
			var summaries []string
			for _, r := range outcome.RejectionReasons {
				summaries = append(summaries, r.Reason)
			}
			resultPayload["reviewSummary"] = strings.Join(summaries, "; ")
		}
		raw, _ := json.Marshal(resultPayload)
		return string(raw)
	}

	switch toolName {
	case config.CreateNoteDocumentToolName:
		return executeCreateDocumentAfterGovernance(toolCall)
	case config.AppendNoteBlocksToolName:
		return executeAppendBlocksAfterGovernance(toolCall)
	case config.ModifyNoteBlockToolName:
		return executeModifyBlockAfterGovernance(toolCall)
	case config.RevertNoteBlockToolName:
		return executeRevertBlockAfterGovernance(toolCall)
	}

	raw, _ := json.Marshal(payload)
	return string(raw)
}

func extractGovernedActionMotivation(toolCall types.ToolCall) string {
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return ""
	}
	motivation, _ := args["motivation"].(string)
	if motivation == "" {
		description, _ := args["description"].(string)
		return description
	}
	return motivation
}

func executeCreateDocumentAfterGovernance(toolCall types.ToolCall) string {
	var args createDocumentArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err))
	}
	args.Title = strings.TrimSpace(args.Title)
	args.Content = strings.TrimSpace(args.Content)

	boxID, err := resolveAIMainNotebookBox()
	if err != nil {
		return marshalNoteEditError("NOTEBOOK_NOT_FOUND", err.Error())
	}

	hPath := "/" + args.Title
	if p := strings.TrimSpace(args.Path); p != "" {
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		p = strings.TrimSuffix(p, "/")
		hPath = p + "/" + args.Title
	}

	id := ast.NewNodeID()
	docID, createErr := model.CreateWithMarkdown("", boxID, hPath, args.Content, "", id, false, "", nil)
	if createErr != nil {
		return marshalNoteEditError("CREATE_FAILED", fmt.Sprintf("创建文档失败: %v", createErr))
	}

	resultPayload := map[string]interface{}{
		"ok":          true,
		"document_id": docID,
	}
	raw, _ := json.Marshal(resultPayload)
	return string(raw)
}

func executeAppendBlocksAfterGovernance(toolCall types.ToolCall) string {
	var args appendBlocksArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err))
	}
	args.ParentID = strings.TrimSpace(args.ParentID)
	args.Content = strings.TrimSpace(args.Content)
	if args.ParentID == "" || args.Content == "" {
		return marshalNoteEditError("PARENT_OR_CONTENT_REQUIRED", "parent_id 和 content 不能为空")
	}

	blockIDs, err := appendBlocks(args.ParentID, args.Content)
	if err != nil {
		return marshalNoteEditError("APPEND_FAILED", fmt.Sprintf("追加块失败: %v", err))
	}

	resultPayload := map[string]interface{}{
		"ok":        true,
		"block_ids": blockIDs,
	}
	raw, _ := json.Marshal(resultPayload)
	return string(raw)
}

func executeModifyBlockAfterGovernance(toolCall types.ToolCall) string {
	var args modifyBlockArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err))
	}
	args.BlockID = strings.TrimSpace(args.BlockID)
	args.Content = strings.TrimSpace(args.Content)
	if args.BlockID == "" || args.Content == "" {
		return marshalNoteEditError("BLOCK_ID_OR_CONTENT_REQUIRED", "block_id 和 content 不能为空")
	}

	if err := ensureAIMainNotebookScope(args.BlockID); err != nil {
		return marshalNoteEditError("NOTEBOOK_SCOPE", err.Error())
	}

	block, err := model.GetBlock(args.BlockID, nil)
	if err != nil {
		return marshalNoteEditError("BLOCK_NOT_FOUND", fmt.Sprintf("块不存在: %v", err))
	}
	if !isLeafBlock(block) {
		return marshalNoteEditError("BLOCK_NOT_LEAF", "目标不是叶子块，不可修改")
	}

	attrs := block.IAL
	if attrs == nil {
		attrs = kernelsql.GetBlockAttrs(args.BlockID)
	}
	if attrs != nil {
		if pending, ok := attrs[_pendingAttrKey]; ok && pending == "true" {
			if expiresStr, hasExpires := attrs[_pendingAttrExpiresKey]; hasExpires {
				expiresAt, parseErr := parseInt64(expiresStr)
				if parseErr == nil && time.Now().UnixMilli() < expiresAt {
					return marshalNoteEditError("BLOCK_ALREADY_PENDING", "该块已有未接受的 MAGI 修改，请先在前端接受后再试")
				}
			} else {
				return marshalNoteEditError("BLOCK_ALREADY_PENDING", "该块已有未接受的 MAGI 修改，请先在前端接受后再试")
			}
		}
	}

	originalContent := model.GetBlockKramdown(args.BlockID, "markdown")

	if err := updateBlockContent(args.BlockID, args.Content); err != nil {
		return marshalNoteEditError("UPDATE_FAILED", fmt.Sprintf("更新块内容失败: %v", err))
	}

	now := time.Now()
	expiresAt := now.AddDate(0, 0, _pendingDefaultExpireDays)
	pendingAttrs := map[string]string{
		_pendingAttrKey:         "true",
		_pendingAttrTimeKey:     fmt.Sprintf("%d", now.UnixMilli()),
		_pendingAttrExpiresKey:  fmt.Sprintf("%d", expiresAt.UnixMilli()),
	}
	if strings.TrimSpace(originalContent) != "" {
		pendingAttrs[_pendingAttrOriginalKey] = originalContent
	}
	if args.Attrs != nil {
		for k, v := range args.Attrs {
			pendingAttrs[k] = v
		}
	}
	if err := model.SetBlockAttrs(args.BlockID, pendingAttrs); err != nil {
		return marshalNoteEditError("ATTRS_FAILED", fmt.Sprintf("设置 pending 属性失败: %v", err))
	}

	resultPayload := map[string]interface{}{
		"ok":         true,
		"block_id":   args.BlockID,
		"pending":    true,
		"expires_at": expiresAt.UnixMilli(),
	}
	raw, _ := json.Marshal(resultPayload)
	return string(raw)
}

func executeRevertBlockAfterGovernance(toolCall types.ToolCall) string {
	var args revertBlockArgs
	if err := json.Unmarshal([]byte(toolCall.Function.Arguments), &args); err != nil {
		return marshalNoteEditError("INVALID_ARGS", fmt.Sprintf("参数解析失败: %v", err))
	}
	args.BlockID = strings.TrimSpace(args.BlockID)
	if args.BlockID == "" {
		return marshalNoteEditError("BLOCK_ID_REQUIRED", "block_id 不能为空")
	}

	attrs := kernelsql.GetBlockAttrs(args.BlockID)
	if attrs == nil || attrs[_pendingAttrKey] != "true" {
		return marshalNoteEditError("BLOCK_NOT_PENDING", "该块没有 pending 修改")
	}

	if originalContent, hasOriginal := attrs[_pendingAttrOriginalKey]; hasOriginal && strings.TrimSpace(originalContent) != "" {
		if err := updateBlockContent(args.BlockID, originalContent); err != nil {
			return marshalNoteEditError("REVERT_FAILED", fmt.Sprintf("回滚内容失败: %v", err))
		}
	}

	clearAttrs := map[string]string{
		_pendingAttrKey:         "",
		_pendingAttrTimeKey:     "",
		_pendingAttrOriginalKey: "",
		_pendingAttrExpiresKey:  "",
	}
	if err := model.SetBlockAttrs(args.BlockID, clearAttrs); err != nil {
		return marshalNoteEditError("ATTRS_FAILED", fmt.Sprintf("清除 pending 属性失败: %v", err))
	}

	resultPayload := map[string]interface{}{
		"ok":       true,
		"block_id": args.BlockID,
	}
	raw, _ := json.Marshal(resultPayload)
	return string(raw)
}

func appendBlocks(parentID, markdown string) ([]string, error) {
	blockID, err := appendMarkdownBlock(parentID, markdown)
	if err != nil {
		return nil, err
	}
	return []string{blockID}, nil
}

func updateBlockContent(blockID, content string) error {
	luteEngine := util.NewLute()
	dom := luteEngine.Md2BlockDOM(content, false)
	transactions := []*model.Transaction{
		{
			DoOperations: []*model.Operation{
				{
					Action: "update",
					ID:     blockID,
					Data:   dom,
				},
			},
		},
	}
	model.PerformTransactions(&transactions)
	model.FlushTxQueue()
	return nil
}

func resolveAIMainNotebookBox() (string, error) {
	scope, err := model.ResolveWorkspaceAIMainNotebookAccessScope()
	if err != nil {
		return "", fmt.Errorf("AI 主笔记本未配置: %v", err)
	}
	if scope == nil || scope.ActiveNotebook == nil || strings.TrimSpace(scope.ActiveNotebook.ID) == "" {
		return "", fmt.Errorf("AI 主笔记本未配置")
	}
	return scope.ActiveNotebook.ID, nil
}

func ensureAIMainNotebookScope(blockID string) error {
	scope, err := model.ResolveWorkspaceAIMainNotebookAccessScope()
	if err != nil {
		return fmt.Errorf("AI 主笔记本未配置: %v", err)
	}
	if scope == nil || scope.ActiveNotebook == nil || strings.TrimSpace(scope.ActiveNotebook.ID) == "" {
		return fmt.Errorf("AI 主笔记本未配置")
	}
	block, err := model.GetBlock(blockID, nil)
	if err != nil {
		return fmt.Errorf("块不存在: %v", err)
	}
	if block.Box != scope.ActiveNotebook.ID {
		return fmt.Errorf("块不在 AI 主笔记本中")
	}
	return nil
}

func ensureBlockIsDescendantOf(childID, parentID string) error {
	if childID == parentID {
		return fmt.Errorf("after_id 不能等于 parent_id")
	}
	for currentID := childID; currentID != ""; {
		if currentID == parentID {
			return nil
		}
		block, err := model.GetBlock(currentID, nil)
		if err != nil {
			return fmt.Errorf("块不存在: %v", err)
		}
		if block.ParentID == "" {
			break
		}
		currentID = block.ParentID
	}
	return fmt.Errorf("after_id 不是 parent_id 的后代")
}

func isLeafBlock(block *model.Block) bool {
	if block == nil {
		return false
	}
	children := model.GetChildBlocks(block.ID)
	return len(children) == 0
}

func marshalNoteEditError(code, message string) string {
	payload := map[string]interface{}{
		"ok":    false,
		"error": message,
		"code":  code,
	}
	raw, _ := json.Marshal(payload)
	return string(raw)
}

func parseInt64(s string) (int64, error) {
	var v int64
	_, err := fmt.Sscanf(s, "%d", &v)
	return v, err
}
