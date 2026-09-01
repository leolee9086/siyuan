// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/gin-gonic/gin"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

type agentQueuedInputReq struct {
	InputID              string                     `json:"inputID"`
	SessionID            string                     `json:"sessionID"`
	UserEntryID          string                     `json:"userEntryID"`
	Message              string                     `json:"message"`
	BlockHTML            string                     `json:"blockHTML,omitempty"`
	Language             string                     `json:"language"`
	References           []agent.Reference          `json:"references"`
	EditorContext        agent.EditorContext        `json:"editorContext"`
	PluginActions        []agent.PluginAction       `json:"pluginActions"`
	FrontendCapabilities []agent.FrontendCapability `json:"frontendCapabilities"`
	Model                string                     `json:"model,omitempty"`
	ReasoningEffort      string                     `json:"reasoningEffort,omitempty"`
	Regenerate           bool                       `json:"regenerate,omitempty"`
	ContentRevision      int64                      `json:"contentRevision,omitempty"`
}

type agentSteerReq struct {
	InputID        string              `json:"inputID"`
	SessionID      string              `json:"sessionID"`
	ExpectedTurnID string              `json:"expectedTurnID"`
	UserEntryID    string              `json:"userEntryID"`
	Message        string              `json:"message"`
	BlockHTML      string              `json:"blockHTML,omitempty"`
	References     []agent.Reference   `json:"references"`
	EditorContext  agent.EditorContext `json:"editorContext"`
}

type agentQueueMutationReq struct {
	agentQueuedInputReq
	QueueVersion int64 `json:"queueVersion"`
}

type agentQueueIdentityReq struct {
	SessionID    string `json:"sessionID"`
	InputID      string `json:"inputID"`
	QueueVersion int64  `json:"queueVersion"`
}

type agentQueuePromoteReq struct {
	agentQueueIdentityReq
	ExpectedTurnID string `json:"expectedTurnID"`
}

type agentInterruptReq struct {
	SessionID      string `json:"sessionID"`
	ExpectedTurnID string `json:"expectedTurnID"`
	PreserveQueue  *bool  `json:"preserveQueue,omitempty"`
}

func agentTurn(c *gin.Context) {
	req := &agentQueuedInputReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	ownerAuth, _, ok := requireAgentControlSessionAccess(c, req.SessionID)
	if !ok {
		return
	}
	input, params, err := buildAgentSessionEventInput(*req, ownerAuth, agentqueue.SemanticsUserMessage)
	if err != nil {
		writeAgentControlError(c, err, 0)
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	input.Metadata = map[string]any{turnParamsKey: params}
	result, err := executor.admitUserTurn(input)
	if err != nil {
		writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
		return
	}
	writeAgentControlSuccess(c, http.StatusAccepted, gin.H{
		"inputID": input.ID, "userEntryID": params.UserEntryID, "admittedSeq": result.Seq,
		"queueVersion": result.QueueVersion, "duplicated": result.Duplicated,
	})
}

func agentSteer(c *gin.Context) {
	req := &agentSteerReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	if req.ExpectedTurnID == "" || (req.Message == "" && req.BlockHTML == "") {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_input", "expectedTurnID and message are required", 0)
		return
	}
	if _, _, ok := requireAgentControlSessionAccess(c, req.SessionID); !ok {
		return
	}
	if req.InputID == "" {
		req.InputID = ast.NewNodeID()
	}
	if req.UserEntryID == "" {
		req.UserEntryID = ast.NewNodeID()
	}
	payload, err := json.Marshal(agentSteerPayload{
		UserEntryID: req.UserEntryID, BlockHTML: req.BlockHTML,
		References: req.References, EditorContext: req.EditorContext,
	})
	if err != nil {
		writeAgentControlError(c, err, 0)
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	result, err := executor.turn.AdmitSteer(&agentqueue.Input{
		ID: req.InputID, SessionID: req.SessionID, Semantics: agentqueue.SemanticsSteer,
		ExpectedTurnID: req.ExpectedTurnID, Content: req.Message, Payload: payload,
	})
	if err != nil {
		writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
		return
	}
	writeAgentControlSuccess(c, http.StatusAccepted, gin.H{
		"inputID": req.InputID, "acceptedTurnID": req.ExpectedTurnID, "admittedSeq": result.Seq,
		"queueVersion": result.QueueVersion, "duplicated": result.Duplicated,
	})
}

func agentQueue(c *gin.Context) {
	req := &agentQueuedInputReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	ownerAuth, _, ok := requireAgentControlSessionAccess(c, req.SessionID)
	if !ok {
		return
	}
	input, params, err := buildQueuedAgentInput(*req, ownerAuth)
	if err != nil {
		writeAgentControlError(c, err, 0)
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	input.Metadata = map[string]any{turnParamsKey: params}
	result, err := executor.manager.Submit(input)
	if err != nil {
		writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
		return
	}
	writeAgentControlSuccess(c, http.StatusAccepted, gin.H{
		"inputID": input.ID, "userEntryID": params.UserEntryID, "admittedSeq": result.Seq,
		"queueVersion": result.QueueVersion, "duplicated": result.Duplicated,
	})
}

func getAgentQueue(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Query("sessionID"))
	if _, _, ok := requireAgentControlSessionAccess(c, sessionID); !ok {
		return
	}
	executor, ok := requireAgentControlExecutor(c, sessionID)
	if !ok {
		return
	}
	writeAgentControlSuccess(c, http.StatusOK, executor.manager.SnapshotVersioned(sessionID))
}

func updateAgentQueue(c *gin.Context) {
	req := &agentQueueMutationReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	if req.InputID == "" {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_input", "inputID is required", 0)
		return
	}
	ownerAuth, _, ok := requireAgentControlSessionAccess(c, req.SessionID)
	if !ok {
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	if err := preserveQueuedUserEntryID(executor.manager.SnapshotVersioned(req.SessionID), req); err != nil {
		writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
		return
	}
	replacement, params, err := buildQueuedAgentInput(req.agentQueuedInputReq, ownerAuth)
	if err != nil {
		writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
		return
	}
	replacement.Metadata = map[string]any{turnParamsKey: params}
	version, err := executor.manager.UpdatePendingBySemantics(req.SessionID, req.InputID, req.QueueVersion, agentqueue.SemanticsQueue, replacement)
	if err != nil {
		writeAgentControlError(c, err, version)
		return
	}
	writeAgentControlSuccess(c, http.StatusOK, gin.H{"inputID": req.InputID, "queueVersion": version})
}

func cancelAgentQueue(c *gin.Context) {
	req := &agentQueueIdentityReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	if req.InputID == "" {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_input", "inputID is required", 0)
		return
	}
	if _, _, ok := requireAgentControlSessionAccess(c, req.SessionID); !ok {
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	version, err := executor.manager.CancelPendingBySemantics(req.SessionID, req.InputID, req.QueueVersion, agentqueue.SemanticsQueue)
	if err != nil {
		writeAgentControlError(c, err, version)
		return
	}
	writeAgentControlSuccess(c, http.StatusOK, gin.H{"inputID": req.InputID, "queueVersion": version})
}

func promoteAgentQueue(c *gin.Context) {
	req := &agentQueuePromoteReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	if req.InputID == "" || req.ExpectedTurnID == "" {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_input", "inputID and expectedTurnID are required", 0)
		return
	}
	if _, _, ok := requireAgentControlSessionAccess(c, req.SessionID); !ok {
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	promoted, version, err := executor.turn.PromoteQueuedInput(req.InputID, req.ExpectedTurnID, req.QueueVersion)
	if err != nil {
		writeAgentControlError(c, err, version)
		return
	}
	seq := inputSequence(executor.manager.SnapshotVersioned(req.SessionID), promoted.ID)
	writeAgentControlSuccess(c, http.StatusAccepted, gin.H{
		"inputID": promoted.ID, "acceptedTurnID": req.ExpectedTurnID, "admittedSeq": seq, "queueVersion": version,
	})
}

func interruptAgentTurn(c *gin.Context) {
	req := &agentInterruptReq{}
	if !bindAgentControlJSON(c, req) {
		return
	}
	if req.ExpectedTurnID == "" {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_input", "expectedTurnID is required", 0)
		return
	}
	if _, _, ok := requireAgentControlSessionAccess(c, req.SessionID); !ok {
		return
	}
	executor, ok := requireAgentControlExecutor(c, req.SessionID)
	if !ok {
		return
	}
	if err := executor.interruptTurn(req.ExpectedTurnID); err != nil {
		writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
		return
	}
	preserveQueue := req.PreserveQueue == nil || *req.PreserveQueue
	if !preserveQueue {
		if _, _, err := executor.manager.CancelPendingSemantics(req.SessionID, agentqueue.SemanticsQueue); err != nil {
			writeAgentControlError(c, err, executor.manager.SnapshotVersioned(req.SessionID).QueueVersion)
			return
		}
	}
	writeAgentControlSuccess(c, http.StatusAccepted, gin.H{
		"turnID": req.ExpectedTurnID, "preserveQueue": preserveQueue,
		"queueVersion": executor.manager.SnapshotVersioned(req.SessionID).QueueVersion,
	})
}

func agentEvents(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Query("sessionID"))
	if _, _, ok := requireAgentControlSessionAccess(c, sessionID); !ok {
		return
	}
	after, err := parseAgentEventCursor(c)
	if err != nil {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_event_cursor", err.Error(), 0)
		return
	}
	executor, ok := requireAgentControlExecutor(c, sessionID)
	if !ok {
		return
	}
	events, unsubscribe, err := executor.subscribeEvents(c.Request.Context(), after)
	if err != nil {
		writeAgentControlError(c, err, 0)
		return
	}
	defer unsubscribe()
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return
	}
	for event := range events {
		if err = writeAgentSessionSSE(c, event); err != nil {
			return
		}
		flusher.Flush()
	}
}

func buildQueuedAgentInput(req agentQueuedInputReq, ownerAuth *agentOwnerAuthorization) (*agentqueue.Input, *agentChatTurnParams, error) {
	return buildAgentSessionEventInput(req, ownerAuth, agentqueue.SemanticsQueue)
}

func buildAgentSessionEventInput(req agentQueuedInputReq, ownerAuth *agentOwnerAuthorization, semantics agentqueue.InputSemantics) (*agentqueue.Input, *agentChatTurnParams, error) {
	if req.Message == "" && req.BlockHTML == "" {
		return nil, nil, errors.New("agent message is empty")
	}
	if req.InputID == "" {
		req.InputID = ast.NewNodeID()
	}
	if req.UserEntryID == "" {
		req.UserEntryID = ast.NewNodeID()
	}
	contentRevision := int64(-1)
	if req.Regenerate {
		contentRevision = req.ContentRevision
	}
	params, err := buildAgentTurnParams(agentTurnRequestOptions{
		ModelID: req.Model, UserEntryID: req.UserEntryID, BlockHTML: &req.BlockHTML, ContentRevision: contentRevision,
		Language: req.Language, References: req.References, EditorContext: req.EditorContext,
		PluginActions: req.PluginActions, FrontendCapabilities: req.FrontendCapabilities,
		Regenerate: req.Regenerate, ReasoningEffort: req.ReasoningEffort,
	}, ownerAuth)
	if err != nil {
		return nil, nil, err
	}
	params.AppendUserEntry = true
	payload, err := encodeAgentTurnParams(params)
	if err != nil {
		return nil, nil, err
	}
	return &agentqueue.Input{
		ID: req.InputID, SessionID: req.SessionID, Semantics: semantics,
		Content: req.Message, Payload: payload,
	}, params, nil
}

func bindAgentControlJSON(c *gin.Context, target any) bool {
	if err := c.ShouldBindJSON(target); err != nil {
		writeAgentControlFailure(c, http.StatusBadRequest, "invalid_request", "invalid request: "+err.Error(), 0)
		return false
	}
	return true
}

// preserveQueuedUserEntryID keeps the canonical EntryID stable while a pending
// queue item is edited. The subsequent version-checked mutation remains the
// linearization point if a promotion races this read.
func preserveQueuedUserEntryID(snapshot agentqueue.QueueSnapshot, req *agentQueueMutationReq) error {
	for _, item := range snapshot.Items {
		if item.Input == nil || item.Input.ID != req.InputID {
			continue
		}
		if item.Input.Semantics != agentqueue.SemanticsQueue {
			return agentqueue.ErrSemanticsMismatch
		}
		if item.State != agentqueue.StatusPending {
			return agentqueue.ErrNotPending
		}
		params, err := decodeAgentTurnParams(item.Input)
		if err != nil {
			return err
		}
		if params.UserEntryID != "" {
			req.UserEntryID = params.UserEntryID
		}
		return nil
	}
	return agentqueue.ErrInputNotFound
}

func requireAgentControlSessionAccess(c *gin.Context, sessionID string) (*agentOwnerAuthorization, *agent.TaskDirectoryBinding, bool) {
	if sessionID == "" {
		writeAgentControlFailure(c, http.StatusNotFound, "session_not_found", "agent session not found", 0)
		return nil, nil, false
	}
	ownerAuth, binding, ok := requireAgentSessionAccess(c, sessionID)
	if !ok {
		return nil, binding, false
	}
	if !agent.SessionExists(sessionID) {
		writeAgentControlFailure(c, http.StatusNotFound, "session_not_found", "agent session not found", 0)
		return nil, binding, false
	}
	return ownerAuth, binding, true
}

func requireAgentControlExecutor(c *gin.Context, sessionID string) (*agentSessionExecutor, bool) {
	executor := getAgentExecutor(sessionID)
	if executor.initErr != nil {
		writeAgentControlError(c, executor.initErr, 0)
		return nil, false
	}
	return executor, true
}

func writeAgentControlSuccess(c *gin.Context, status int, data any) {
	ret := gulu.Ret.NewResult()
	ret.Data = data
	c.JSON(status, ret)
}

func writeAgentControlFailure(c *gin.Context, status int, reason, message string, queueVersion int64) {
	ret := gulu.Ret.NewResult()
	ret.Code = -1
	ret.Msg = message
	ret.Data = gin.H{"reason": reason, "queueVersion": queueVersion}
	c.JSON(status, ret)
}

func writeAgentControlError(c *gin.Context, err error, queueVersion int64) {
	status := http.StatusInternalServerError
	reason := "internal_error"
	switch {
	case errors.Is(err, errAgentModelUnavailable):
		status, reason = http.StatusConflict, "model_unavailable"
	case errors.Is(err, ErrAgentNoActiveTurn):
		status, reason = http.StatusConflict, "no_active_turn"
	case errors.Is(err, ErrAgentTurnAlreadyActive):
		status, reason = http.StatusConflict, "turn_active"
	case errors.Is(err, ErrAgentTurnMismatch):
		status, reason = http.StatusConflict, "turn_mismatch"
	case errors.Is(err, ErrAgentTurnNotSteerable):
		status, reason = http.StatusConflict, "turn_not_steerable"
	case errors.Is(err, agentqueue.ErrInputIDConflict):
		status, reason = http.StatusConflict, "input_id_conflict"
	case errors.Is(err, agentqueue.ErrQueueFull):
		status, reason = http.StatusConflict, "queue_full"
	case errors.Is(err, agentqueue.ErrQueueVersionConflict):
		status, reason = http.StatusConflict, "queue_version_conflict"
	case errors.Is(err, agentqueue.ErrNotPending), errors.Is(err, agentqueue.ErrSemanticsMismatch):
		status, reason = http.StatusConflict, "input_already_promoted"
	case errors.Is(err, agent.ErrSessionConflict):
		// 会话修订冲突（多面板同会话并发保存/提交）：以 409 结构化返回，前端据此刷新权威修订并重试。
		status, reason = http.StatusConflict, "session_revision_conflict"
	case errors.Is(err, agentqueue.ErrInputNotFound):
		status, reason = http.StatusNotFound, "input_not_found"
	case errors.Is(err, agentqueue.ErrExpectedTurnIDRequired), errors.Is(err, agentqueue.ErrExpectedTurnIDForbidden),
		errors.Is(err, agentqueue.ErrInvalidPayload), errors.Is(err, agentqueue.ErrUnsupportedPayloadVersion):
		status, reason = http.StatusBadRequest, "invalid_input"
	}
	message := err.Error()
	if errors.Is(err, errAgentModelUnavailable) {
		message = model.Conf.Language(193)
	}
	writeAgentControlFailure(c, status, reason, message, queueVersion)
}

func inputSequence(snapshot agentqueue.QueueSnapshot, inputID string) int64 {
	for _, item := range snapshot.Items {
		if item.Input != nil && item.Input.ID == inputID {
			return item.Seq
		}
	}
	return 0
}

func parseAgentEventCursor(c *gin.Context) (int64, error) {
	raw := strings.TrimSpace(c.Query("after"))
	if raw == "" {
		raw = strings.TrimSpace(c.GetHeader("Last-Event-ID"))
	}
	if raw == "" {
		return 0, nil
	}
	after, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || after < 0 {
		return 0, errors.New("event cursor must be a non-negative integer")
	}
	return after, nil
}
