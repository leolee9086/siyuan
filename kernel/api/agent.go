// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package api

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/88250/lute/ast"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/mcp/tools"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

const agentOwnerTokenHeader = "X-SiYuan-Agent-Owner-Token"

var resolveAgentUploadNotebook = model.ResolveActiveWorkspaceAIMainNotebook
var getAgentKernelDeviceIPs = agentKernelDeviceIPs
var broadcastAgentSessionEvent = util.BroadcastByTypeAndExcludeApp

type agentOwnerAuthorization struct {
	IdentityID string
	ExpiresAt  int64
}

func optionalAgentOwnerAuthorization(c *gin.Context) (*agentOwnerAuthorization, *magiSourceAuthError) {
	rawToken := strings.TrimSpace(c.GetHeader(agentOwnerTokenHeader))
	if rawToken == "" {
		return nil, nil
	}
	if !isAgentOwnerTransportSecure(c) {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "agent_owner_secure_transport_required",
			Message:    "verified owner access requires HTTPS or a local desktop connection",
		}
	}
	claims, authErr := verifyMagiArmorToken(rawToken)
	if authErr != nil {
		return nil, authErr
	}
	if claims.Chn != magiRequestChannelMainUI || claims.Rtc != magiRouteClassGuardian {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "agent_owner_guardian_required",
			Message:    "a guardian identity verified for magi-main-ui is required",
		}
	}
	identity, authErr := ensureMagiArmorIdentityConsistency(claims)
	if authErr != nil {
		return nil, authErr
	}
	if identity.RouteClass != magiRouteClassGuardian {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "agent_owner_guardian_required",
			Message:    "a guardian identity is required",
		}
	}
	return &agentOwnerAuthorization{IdentityID: claims.Sub, ExpiresAt: claims.Exp}, nil
}

func isAgentOwnerTransportSecure(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	if c.Request.TLS != nil {
		return true
	}
	return isAgentKernelDeviceRequest(c)
}

// isAgentKernelDeviceRequest 只使用真实连接来源判断 WebUI 是否与 Kernel 位于同一设备。
func isAgentKernelDeviceRequest(c *gin.Context) bool {
	if c == nil || c.Request == nil {
		return false
	}
	remoteIP := parseAgentRemoteIP(c.Request.RemoteAddr)
	if remoteIP == nil {
		return false
	}
	if remoteIP.IsLoopback() {
		return true
	}
	for _, localIP := range getAgentKernelDeviceIPs() {
		if localIP != nil && remoteIP.Equal(localIP) {
			return true
		}
	}
	return false
}

func parseAgentRemoteIP(remoteAddr string) net.IP {
	remoteAddr = strings.TrimSpace(remoteAddr)
	if remoteAddr == "" {
		return nil
	}
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	if zoneIndex := strings.LastIndex(host, "%"); zoneIndex >= 0 {
		host = host[:zoneIndex]
	}
	return net.ParseIP(strings.Trim(host, "[]"))
}

func agentKernelDeviceIPs() []net.IP {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}
	ret := []net.IP{}
	for _, networkInterface := range interfaces {
		if networkInterface.Flags&net.FlagUp == 0 {
			continue
		}
		addresses, addrErr := networkInterface.Addrs()
		if addrErr != nil {
			continue
		}
		for _, address := range addresses {
			if ip, _, parseErr := net.ParseCIDR(address.String()); parseErr == nil {
				ret = append(ret, ip)
			}
		}
	}
	return ret
}

type agentSessionAccessFailure struct {
	StatusCode int
	Reason     string
	Message    string
	SourceAuth *magiSourceAuthError
}

func inspectAgentSessionAccess(c *gin.Context, sessionID string) (*agentOwnerAuthorization, *agent.TaskDirectoryBinding, *agentSessionAccessFailure) {
	binding, err := agent.GetTaskDirectoryBinding(sessionID)
	if err != nil {
		return nil, nil, &agentSessionAccessFailure{
			StatusCode: http.StatusInternalServerError,
			Reason:     "session_access_inspection_failed",
			Message:    "failed to inspect agent session",
		}
	}
	ownerAuth, authErr := optionalAgentOwnerAuthorization(c)
	if authErr != nil {
		statusCode := authErr.StatusCode
		if statusCode == 0 {
			statusCode = http.StatusUnauthorized
		}
		return nil, binding, &agentSessionAccessFailure{
			StatusCode: statusCode,
			Reason:     authErr.Code,
			Message:    authErr.Message,
			SourceAuth: authErr,
		}
	}
	if binding == nil {
		return ownerAuth, nil, nil
	}
	if ownerAuth == nil || !subtleConstantTimeStringEqual(binding.OwnerIdentityID, ownerAuth.IdentityID) {
		return nil, binding, &agentSessionAccessFailure{
			StatusCode: http.StatusForbidden,
			Reason:     "owner_access_required",
			Message:    "verified device owner access is required",
		}
	}
	return ownerAuth, binding, nil

}

func requireAgentSessionAccess(c *gin.Context, sessionID string) (*agentOwnerAuthorization, *agent.TaskDirectoryBinding, bool) {
	ownerAuth, binding, failure := inspectAgentSessionAccess(c, sessionID)
	if failure == nil {
		return ownerAuth, binding, true
	}
	if failure.SourceAuth != nil {
		writeMagiSourceAuthError(c, failure.SourceAuth)
	} else {
		c.JSON(failure.StatusCode, gin.H{"code": -1, "msg": failure.Message})
	}
	return nil, binding, false
}

func subtleConstantTimeStringEqual(left, right string) bool {
	if len(left) != len(right) || left == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}

func requireRunningAgentAccess(c *gin.Context, sessionID string) bool {
	ownerAuth, binding, failure := inspectAgentSessionAccess(c, sessionID)
	if failure != nil {
		writeAgentInteractionFailure(c, failure.StatusCode, failure.Reason, "error", failure.Message)
		return false
	}
	activity := readAgentExecutorActivity(sessionID)
	if !activity.Active {
		writeAgentInteractionFailure(c, http.StatusConflict, "session_not_running", "expired",
			"agent session is not running")
		return false
	}
	if binding != nil && (ownerAuth == nil || !subtleConstantTimeStringEqual(activity.OwnerIdentityID, ownerAuth.IdentityID)) {
		writeAgentInteractionFailure(c, http.StatusForbidden, "owner_access_required", "error",
			"verified device owner access is required")
		return false
	}
	return true
}

type agentChatReq struct {
	SessionID            string                     `json:"sessionID"`
	UserEntryID          string                     `json:"userEntryID"`
	ContentRevision      *int64                     `json:"contentRevision"`
	Message              string                     `json:"message"`
	BlockHTML            *string                    `json:"blockHTML"`
	Language             string                     `json:"language"`
	References           []agent.Reference          `json:"references"`
	EditorContext        agent.EditorContext        `json:"editorContext"`
	PluginActions        []agent.PluginAction       `json:"pluginActions"`
	FrontendCapabilities []agent.FrontendCapability `json:"frontendCapabilities"`
	Model                string                     `json:"model,omitempty"`
	Regenerate           bool                       `json:"regenerate"`
	ReasoningEffort      string                     `json:"reasoningEffort,omitempty"`
}

func isAgentSessionRunning(sessionID string) bool {
	return isAgentExecutorSessionActive(sessionID)
}

func agentChat(c *gin.Context) {
	if !model.Conf.AI.HasAnyProvider() {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = model.Conf.Language(193)
		c.JSON(http.StatusOK, ret)
		return
	}

	req := &agentChatReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}

	ownerAuth, taskDirectory, authorized := requireAgentSessionAccess(c, req.SessionID)
	if !authorized {
		return
	}

	app := c.GetHeader("X-SiYuan-App-ID")
	contentRevision := int64(-1)
	if req.ContentRevision != nil {
		contentRevision = *req.ContentRevision
	}
	turnParams, err := buildAgentTurnParams(agentTurnRequestOptions{
		ModelID: req.Model, UserEntryID: req.UserEntryID, BlockHTML: req.BlockHTML, ContentRevision: contentRevision,
		Language: req.Language, References: req.References, EditorContext: req.EditorContext,
		PluginActions: req.PluginActions, FrontendCapabilities: req.FrontendCapabilities,
		Regenerate: req.Regenerate, ReasoningEffort: req.ReasoningEffort,
	}, ownerAuth)
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = model.Conf.Language(193)
		c.JSON(http.StatusOK, ret)
		return
	}
	payload, err := encodeAgentTurnParams(turnParams)
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "encode agent turn parameters failed: " + err.Error()
		c.JSON(http.StatusInternalServerError, ret)
		return
	}
	ctx, cancel := context.WithCancel(c.Request.Context())
	input := &agentqueue.Input{
		ID:        ast.NewNodeID(),
		SessionID: req.SessionID,
		Semantics: agentqueue.SemanticsUserMessage,
		Content:   req.Message,
		Payload:   payload,
		Metadata: map[string]any{
			turnParamsKey: turnParams,
		},
	}
	executor := getAgentExecutor(req.SessionID)
	sub, _, admissionErr := executor.admitLegacyTurn(ctx, agentLegacySubscriptionMetadata{
		App: app, OwnerIdentityID: turnParams.OwnerIdentityID,
	}, input)
	if admissionErr != nil {
		cancel()
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		if errors.Is(admissionErr, ErrAgentSessionBusy) {
			ret.Msg = "session is busy in another instance"
		} else {
			ret.Msg = "session queue rejected the message: " + admissionErr.Error()
		}
		c.JSON(http.StatusConflict, ret)
		return
	}
	subCh := sub.ch
	defer cancel()
	streamClosed := false
	defer func() {
		if streamClosed {
			return
		}
		go func() {
			for range subCh {
			}
			executor.unsubscribe(sub)
		}()
	}()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return
	}

	deadlineTimer, deadline := newAgentSessionDeadline(model.Conf.AI.Agent.SessionTimeout)
	if deadlineTimer != nil {
		defer deadlineTimer.Stop()
	}
	var ownerAuthorizationDeadline <-chan time.Time
	if taskDirectory != nil {
		remaining := time.Until(time.Unix(turnParams.OwnerExpiresAt, 0))
		if remaining <= 0 {
			writeSSEError(c, "verified device owner authorization expired")
			return
		}
		ownerAuthorizationDeadline = time.After(remaining)
	}

	// 通知其他实例：该会话的流已开始，镜像端可显示“对话进行中”占位。
	executor.startLegacyStream(sub)

	for {
		select {
		case event, ok := <-subCh:
			if !ok {
				streamClosed = true
				executor.unsubscribe(sub)
				return
			}
			if err := writeSSE(c, event); err != nil {
				return
			}
			flusher.Flush()
		case <-c.Request.Context().Done():
			return
		case <-deadline:
			writeSSEInterrupted(c, model.Conf.Language(24))
			flusher.Flush()
			return
		case <-ownerAuthorizationDeadline:
			writeSSEError(c, "verified device owner authorization expired")
			flusher.Flush()
			return
		}
	}
}

func newAgentSessionDeadline(timeoutSeconds int) (*time.Timer, <-chan time.Time) {
	if timeoutSeconds <= 0 {
		return nil, nil
	}
	if timeoutSeconds > 3600 {
		timeoutSeconds = 3600
	}
	timer := time.NewTimer(time.Duration(timeoutSeconds) * time.Second)
	return timer, timer.C
}

type agentConfirmReq struct {
	SessionID string `json:"sessionID"`
	ConfirmID string `json:"confirmID"`
	Approved  bool   `json:"approved"`
	Always    bool   `json:"always"`
}

func writeAgentInteractionFailure(c *gin.Context, statusCode int, reason, status, message string) {
	ret := gulu.Ret.NewResult()
	ret.Code = -1
	ret.Msg = message
	ret.Data = gin.H{"reason": reason, "status": status}
	c.JSON(statusCode, ret)
}

func writeAgentInteractionAccepted(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	ret.Data = gin.H{"reason": "accepted", "status": "accepted"}
	c.JSON(http.StatusOK, ret)
}

func agentChatConfirm(c *gin.Context) {
	req := &agentConfirmReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		writeAgentInteractionFailure(c, http.StatusBadRequest, "invalid_request", "error",
			"invalid request: "+err.Error())
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	if !agent.ConfirmSession(req.SessionID, req.ConfirmID, req.Approved, req.Always) {
		writeAgentInteractionFailure(c, http.StatusConflict, "interaction_expired", "expired",
			"agent confirmation expired")
		return
	}
	writeAgentInteractionAccepted(c)
}

// 上游新增的 setPermission 端点：切换会话权限模式并广播 permission 变更。
// 本分叉保留上游响应契约，仅按本地安全模型补充 requireAgentSessionAccess 会话级访问校验。
type agentPermissionReq struct {
	SessionID      string `json:"sessionID"`
	PermissionMode string `json:"permissionMode"`
}

func setAgentSessionPermission(c *gin.Context) {
	req := &agentPermissionReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}
	ret := gulu.Ret.NewResult()
	if err := agent.SetSessionPermissionMode(req.SessionID, req.PermissionMode); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	ret.Data = map[string]string{"permissionMode": req.PermissionMode}
	c.JSON(http.StatusOK, ret)
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), req.SessionID, "permission")
}

type agentQuestionReq struct {
	SessionID  string   `json:"sessionID"`
	QuestionID string   `json:"questionID"`
	Answers    []string `json:"answers"`
}

func agentChatQuestion(c *gin.Context) {
	req := &agentQuestionReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		writeAgentInteractionFailure(c, http.StatusBadRequest, "invalid_request", "error",
			"invalid request: "+err.Error())
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	if !agent.AnswerQuestion(req.SessionID, req.QuestionID, req.Answers) {
		writeAgentInteractionFailure(c, http.StatusConflict, "interaction_expired", "expired",
			"agent question expired")
		return
	}
	writeAgentInteractionAccepted(c)
}

type agentFrontendResultReq struct {
	SessionID string `json:"sessionID"`
	CallID    string `json:"callID"`
	Result    string `json:"result"`
	IsError   bool   `json:"isError"`
}

func agentChatFrontendResult(c *gin.Context) {
	req := &agentFrontendResultReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		writeAgentInteractionFailure(c, http.StatusBadRequest, "invalid_request", "error",
			"invalid request: "+err.Error())
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	if !agent.FrontendToolResult(req.SessionID, req.CallID, req.Result, req.IsError) {
		writeAgentInteractionFailure(c, http.StatusConflict, "interaction_expired", "expired",
			"agent frontend tool call expired")
		return
	}
	writeAgentInteractionAccepted(c)
}

// 上游新增的 browserCapabilityResult 端点：接收浏览器能力调用的执行结果。
// 请求先经过本地会话访问校验，再按不可预测的 callID 投递到当前等待者。
type agentBrowserCapabilityResultReq struct {
	SessionID            string `json:"sessionID"`
	CallID               string `json:"callID"`
	Result               string `json:"result"`
	StructuredContent    any    `json:"structuredContent"`
	StructuredContentSet bool   `json:"structuredContentSet"`
	IsError              bool   `json:"isError"`
}

func agentChatBrowserCapabilityResult(c *gin.Context) {
	req := &agentBrowserCapabilityResultReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		writeAgentInteractionFailure(c, http.StatusBadRequest, "invalid_request", "error",
			"invalid request: "+err.Error())
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	if !agent.BrowserCapabilityResult(req.CallID, req.Result, req.StructuredContent,
		req.StructuredContentSet, req.IsError) {
		writeAgentInteractionFailure(c, http.StatusConflict, "interaction_expired", "expired",
			"agent browser capability call expired")
		return
	}
	writeAgentInteractionAccepted(c)
}

func lsCapabilities(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	ret.Data = tools.ListCapabilityManifests()
	c.JSON(http.StatusOK, ret)
}

type agentTitleReq struct {
	SessionID string `json:"sessionID"`
	Message   string `json:"message"`
	Model     string `json:"model"`
	Language  string `json:"language"`
}

func agentChatTitle(c *gin.Context) {
	req := &agentTitleReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}

	modelID := req.Model
	var selectedProvider *conf.Provider
	var selectedModel *conf.Model
	if modelID != "" {
		selectedProvider, selectedModel = model.Conf.AI.GetModel(modelID)
	} else {
		selectedProvider, selectedModel = model.Conf.AI.GetAgentModel()
	}
	if nil == selectedProvider || nil == selectedModel {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "no AI provider configured"
		c.JSON(http.StatusOK, ret)
		return
	}
	client := util.NewOpenAIClientWithModel(selectedProvider.APIKey, selectedProvider.BaseURL, selectedModel.Name, model.Conf.AI.EffectiveAPIProxy(model.Conf.System))

	title := agent.GenerateTitle(client, selectedModel.Name, req.Message, req.Language)
	ret := gulu.Ret.NewResult()
	ret.Data = title
	c.JSON(http.StatusOK, ret)
}

type agentSessionsReq struct {
	Page       int    `json:"page"`
	PageSize   int    `json:"pageSize"`
	Keyword    string `json:"keyword"`
	TargetKind string `json:"targetKind"`
}

func lsSessions(c *gin.Context) {
	req := &agentSessionsReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}

	ownerIdentityID := ""
	if ownerAuth, authErr := optionalAgentOwnerAuthorization(c); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	} else if ownerAuth != nil {
		ownerIdentityID = ownerAuth.IdentityID
	}
	result, err := agent.ListSessions(req.Page, req.PageSize, req.Keyword, ownerIdentityID, req.TargetKind)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "msg": "failed to inspect protected agent sessions"})
		return
	}
	ret := gulu.Ret.NewResult()
	ret.Data = agent.RedactSessionList(result)
	c.JSON(http.StatusOK, ret)
}

type agentSessionGetReq struct {
	ID string `json:"id"`
}

func listAgentTaskDirectories(c *gin.Context) {
	req := &agentSessionGetReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	_, binding, ok := requireAgentSessionAccess(c, req.ID)
	if !ok {
		return
	}
	ret := gulu.Ret.NewResult()
	if binding != nil {
		ret.Data = binding.Redacted()
	} else {
		ret.Data = &agent.TaskDirectoryBinding{Directories: []*agent.TaskDirectoryGrant{}}
	}
	c.JSON(http.StatusOK, ret)
}

func getAgentTaskDirectoryCapabilities(c *gin.Context) {
	ownerAuth, authErr := optionalAgentOwnerAuthorization(c)
	if authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}
	ret := gulu.Ret.NewResult()
	ret.Data = map[string]bool{"canBindTaskDirectories": ownerAuth != nil && isAgentKernelDeviceRequest(c)}
	c.JSON(http.StatusOK, ret)
}

type agentPromptSourceStateReq struct {
	SessionID string `json:"sessionID"`
}

type agentPromptSourceMutationReq struct {
	SessionID        string `json:"sessionID"`
	ExpectedRevision int64  `json:"expectedRevision"`
	DocumentID       string `json:"documentID,omitempty"`
	NotebookID       string `json:"notebookID,omitempty"`
}

type agentPromptSourceDocumentResult struct {
	ID         string `json:"id"`
	NotebookID string `json:"notebookId"`
	Title      string `json:"title"`
	HPath      string `json:"hPath"`
}

// readAgentPromptSourceDocument is the sole path that converts a SiYuan
// document into an Agent prompt source. The browser only supplies identifiers;
// content, normalization, bounds and fingerprints remain Kernel-owned.
func readAgentPromptSourceDocument(documentID, notebookID string) (agent.PromptSource, error) {
	documentID = strings.TrimSpace(documentID)
	notebookID = strings.TrimSpace(notebookID)
	if documentID == "" || notebookID == "" {
		return agent.PromptSource{}, errors.New("document id and notebook id are required")
	}
	info, err := model.GetDocInfoInBox(documentID, notebookID)
	if err != nil {
		return agent.PromptSource{}, fmt.Errorf("read prompt source document: %w", err)
	}
	if info == nil || info.ID != documentID || info.RootID != documentID {
		return agent.PromptSource{}, errors.New("prompt source must be a document root")
	}
	markdown := model.GetBlockKramdownInBox(documentID, "md", notebookID)
	source, err := agent.NewDocumentPromptSource(documentID, notebookID, info.Name, markdown, time.Now().UnixMilli())
	if err != nil {
		return agent.PromptSource{}, err
	}
	return source, nil
}

func writeAgentPromptSourceError(c *gin.Context, err error) {
	ret := gulu.Ret.NewResult()
	ret.Code = -1
	ret.Msg = err.Error()
	if errors.Is(err, agent.ErrSessionConflict) || errors.Is(err, agent.ErrPromptSourceLocked) ||
		errors.Is(err, agent.ErrPromptSourceUnsupportedTarget) {
		c.JSON(http.StatusConflict, ret)
		return
	}
	c.JSON(http.StatusBadRequest, ret)
}

func getAgentPromptSourceState(c *gin.Context) {
	var req agentPromptSourceStateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}
	state, err := agent.GetPromptSourceState(req.SessionID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	if state.Source.Kind == agent.PromptSourceKindDocument && state.State != agent.PromptBindingStateLocked {
		current, readErr := readAgentPromptSourceDocument(state.Source.DocumentID, state.Source.NotebookID)
		if readErr != nil {
			writeAgentPromptSourceError(c, readErr)
			return
		}
		if current.SourceVersion != state.Source.SourceVersion && current.SourceVersion != state.Source.KeptVersion {
			state.State = agent.PromptBindingStateSourceChanged
			state.CurrentVersion = current.SourceVersion
			logging.LogInfof("agent prompt source changed: session [%s] document [%s] stored %s kept %s current %s",
				req.SessionID, state.Source.DocumentID,
				agent.ShortPromptSourceVersion(state.Source.SourceVersion),
				agent.ShortPromptSourceVersion(state.Source.KeptVersion),
				agent.ShortPromptSourceVersion(current.SourceVersion))
		}
	}
	ret := gulu.Ret.NewResult()
	ret.Data = state
	c.JSON(http.StatusOK, ret)
}

func bindAgentPromptSourceDocument(c *gin.Context) {
	var req agentPromptSourceMutationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}
	if isAgentSessionRunning(req.SessionID) {
		writeAgentPromptSourceError(c, agent.ErrPromptSourceLocked)
		return
	}
	source, err := readAgentPromptSourceDocument(req.DocumentID, req.NotebookID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	state, err := agent.BindDocumentPromptSource(req.SessionID, req.ExpectedRevision, source)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), req.SessionID, "update")
	ret := gulu.Ret.NewResult()
	ret.Data = state
	c.JSON(http.StatusOK, ret)
}

func refreshAgentPromptSourceDocument(c *gin.Context) {
	var req agentPromptSourceMutationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}
	if isAgentSessionRunning(req.SessionID) {
		writeAgentPromptSourceError(c, agent.ErrPromptSourceLocked)
		return
	}
	bound, err := agent.GetPromptSource(req.SessionID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	if bound.Kind != agent.PromptSourceKindDocument {
		writeAgentPromptSourceError(c, errors.New("no document prompt source is bound"))
		return
	}
	source, err := readAgentPromptSourceDocument(bound.DocumentID, bound.NotebookID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	state, err := agent.RefreshDocumentPromptSource(req.SessionID, req.ExpectedRevision, source)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), req.SessionID, "update")
	ret := gulu.Ret.NewResult()
	ret.Data = state
	c.JSON(http.StatusOK, ret)
}

func keepAgentPromptSourceDocument(c *gin.Context) {
	var req agentPromptSourceMutationReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}
	if isAgentSessionRunning(req.SessionID) {
		writeAgentPromptSourceError(c, agent.ErrPromptSourceLocked)
		return
	}
	bound, err := agent.GetPromptSource(req.SessionID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	if bound.Kind != agent.PromptSourceKindDocument {
		writeAgentPromptSourceError(c, errors.New("no document prompt source is bound"))
		return
	}
	current, err := readAgentPromptSourceDocument(bound.DocumentID, bound.NotebookID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	state, err := agent.KeepDocumentPromptSource(req.SessionID, req.ExpectedRevision, current.SourceVersion)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), req.SessionID, "update")
	ret := gulu.Ret.NewResult()
	ret.Data = state
	c.JSON(http.StatusOK, ret)
}

func createAgentPromptSourceDocument(c *gin.Context) {
	var req agentPromptSourceStateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, req.SessionID); !ok {
		return
	}
	source, err := agent.GetPromptSource(req.SessionID)
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	if source.Kind != agent.PromptSourceKindDocument {
		writeAgentPromptSourceError(c, errors.New("no document prompt source is bound"))
		return
	}
	notebook, _, err := resolveAgentUploadNotebook()
	if err != nil || notebook == nil || strings.TrimSpace(notebook.ID) == "" {
		if err == nil {
			err = errors.New("AI main notebook is not ready")
		}
		writeAgentPromptSourceError(c, err)
		return
	}
	title := strings.NewReplacer("/", "-", "\\", "-", "\r", " ", "\n", " ").Replace(source.TitleSnapshot)
	title = strings.TrimSpace(title)
	if title == "" {
		title = "Agent System Prompt"
	}
	path := "/Agent System Prompts/" + title + " " + time.Now().Format("20060102-150405")
	documentID, err := model.CreateWithMarkdown("", notebook.ID, path, source.PromptSnapshot, "", "", false, "", map[string]any{
		"app": c.GetHeader("X-SiYuan-App-ID"),
	})
	if err != nil {
		writeAgentPromptSourceError(c, err)
		return
	}
	ret := gulu.Ret.NewResult()
	ret.Data = agentPromptSourceDocumentResult{
		ID:         documentID,
		NotebookID: notebook.ID,
		Title:      title,
		HPath:      path,
	}
	c.JSON(http.StatusOK, ret)
}

func uploadAgentFiles(c *gin.Context) {
	notebook, _, err := resolveAgentUploadNotebook()
	if err != nil || notebook == nil || strings.TrimSpace(notebook.ID) == "" {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "AI main notebook is not ready"
		if err != nil {
			ret.Msg = err.Error()
		}
		c.JSON(http.StatusOK, ret)
		return
	}
	model.UploadToNotebook(c, notebook.ID)
}

func sanitizeSessionForResponse(session map[string]interface{}) map[string]interface{} {
	if session == nil {
		return nil
	}
	// promptSource carries the Kernel-owned prompt snapshot. The UI obtains only
	// redacted metadata from getPromptSource, so an ordinary session response can
	// never leak or overwrite the effective system prompt body.
	delete(session, "promptSource")
	if _, ok := session["taskDirectory"].(map[string]interface{}); !ok {
		return session
	}
	session["taskDirectory"] = sanitizeTaskDirectoryResponseValue(session["taskDirectory"])
	return session
}

// sanitizeTaskDirectoryResponseValue removes sensitive fields at every nested
// level because the client-owned session payload may contain main/directories
// grant objects even though the authoritative capability store is separate.
func sanitizeTaskDirectoryResponseValue(value interface{}) interface{} {
	switch typed := value.(type) {
	case map[string]interface{}:
		redacted := make(map[string]interface{}, len(typed))
		for key, nested := range typed {
			if key == "path" || key == "ownerIdentityId" {
				continue
			}
			redacted[key] = sanitizeTaskDirectoryResponseValue(nested)
		}
		return redacted
	case []interface{}:
		redacted := make([]interface{}, len(typed))
		for index, nested := range typed {
			redacted[index] = sanitizeTaskDirectoryResponseValue(nested)
		}
		return redacted
	default:
		return value
	}
}

func getSession(c *gin.Context) {
	req := &agentSessionGetReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}

	if _, _, ok := requireAgentSessionAccess(c, req.ID); !ok {
		return
	}
	admission := agentSessionAdmissionLock(req.ID)
	admission.Lock()
	executor := lookupAgentExecutor(req.ID)
	running := executor != nil && executor.activity().Active
	if !running {
		if err := agent.FinalizeOrphanedTurn(req.ID); err != nil {
			admission.Unlock()
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = err.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
	}
	session, err := agent.GetSessionState(req.ID, !running)
	admission.Unlock()
	// 执行器可能在首次判定后进入 starting。此时重新读取 canonical 会话，避免把活动
	// runtime 投影与随后从最新 commit 开始的事件 replay 同时返回给新面板。
	if err == nil && !running && isAgentExecutorSessionActive(req.ID) {
		session, err = agent.GetSessionState(req.ID, false)
		running = err == nil
	}
	if err == nil && running {
		session["agentRunning"] = true
	}
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}

	ret := gulu.Ret.NewResult()
	ret.Data = sanitizeSessionForResponse(session)
	c.JSON(http.StatusOK, ret)
}

type agentSessionDeleteReq struct {
	ID string `json:"id"`
}

func removeSession(c *gin.Context) {
	req := &agentSessionDeleteReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}

	_, binding, ok := requireAgentSessionAccess(c, req.ID)
	if !ok {
		return
	}
	if isAgentSessionRunning(req.ID) {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "session is running"
		c.JSON(http.StatusConflict, ret)
		return
	}
	admission := agentSessionAdmissionLock(req.ID)
	admission.Lock()
	defer admission.Unlock()
	if executor := lookupAgentExecutor(req.ID); executor != nil && executor.activity().Active {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "session is running"
		c.JSON(http.StatusConflict, ret)
		return
	}
	err := agent.DeleteSession(req.ID)
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = err.Error()
		c.JSON(http.StatusInternalServerError, ret)
		return
	}
	// 会话删除后停止其常驻执行器（阻塞在 WaitNext 上的 goroutine）并清理队列。
	stopAgentExecutor(req.ID)
	// 外部会话删除后 capability 已移除，不能再通过通用广播函数判断敏感性。
	if binding == nil {
		broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), req.ID, "delete")
	}
	ret := gulu.Ret.NewResult()
	c.JSON(http.StatusOK, ret)
}

func saveSession(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "failed to read body: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	var meta sessionMeta
	if gulu.JSON.UnmarshalJSON(body, &meta) != nil || meta.ID == "" {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid session data"
		c.JSON(http.StatusBadRequest, ret)
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, meta.ID); !ok {
		return
	}
	admission := agentSessionAdmissionLock(meta.ID)
	admission.Lock()
	defer admission.Unlock()
	executor := lookupAgentExecutor(meta.ID)
	activity := agentExecutorActivity{}
	if executor != nil {
		activity = executor.activity()
	}
	if activity.LegacyActive && activity.LegacyApp != c.GetHeader("X-SiYuan-App-ID") {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "session is running in another instance"
		c.JSON(http.StatusConflict, ret)
		return
	}
	commitTurnID := meta.CommitTurnID
	if commitTurnID == "" {
		commitTurnID = meta.RecoveryTurnID
	}
	if activity.LegacyActive && commitTurnID == "" && c.GetHeader("X-SiYuan-Agent-Checkpoint") != "2" &&
		activity.LegacyTerminal && activity.LegacyTurnID != "" {
		body, err = setAgentCommitTurnID(body, activity.LegacyTurnID)
		if err != nil {
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = err.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
		commitTurnID = activity.LegacyTurnID
	}
	executorActive := activity.Active
	if !executorActive {
		runtimeErr := agent.FinalizeOrphanedTurn(meta.ID)
		if runtimeErr != nil {
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = runtimeErr.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
		// 旧前端没有 commitTurnID。流已真正结束后，从终止检查点补出提交标识；SaveSession 仍会
		// 用 runtime 重建权威内容，因此不会信任旧前端可能不完整的流式快照。
		if !executorActive && commitTurnID == "" && c.GetHeader("X-SiYuan-Agent-Checkpoint") != "2" {
			recoverableTurnID, runtimeErr := agent.RecoverableTurnID(meta.ID)
			if runtimeErr != nil {
				ret := gulu.Ret.NewResult()
				ret.Code = -1
				ret.Msg = runtimeErr.Error()
				c.JSON(http.StatusInternalServerError, ret)
				return
			}
			if recoverableTurnID != "" {
				body, err = setAgentCommitTurnID(body, recoverableTurnID)
				if err != nil {
					ret := gulu.Ret.NewResult()
					ret.Code = -1
					ret.Msg = err.Error()
					c.JSON(http.StatusInternalServerError, ret)
					return
				}
				commitTurnID = recoverableTurnID
			}
		}
	}
	// 已占用会话但尚未收到本轮 turn 事件，通常表示 Agent 初始化失败。此时若磁盘上仍有旧的
	// 未提交 turn，不能让无 commitTurnID 的普通保存绕过恢复协议并覆盖它。
	if commitTurnID == "" && !executorActive {
		uncommitted, runtimeErr := agent.HasUncommittedTurn(meta.ID)
		if runtimeErr != nil {
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = runtimeErr.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
		if uncommitted {
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = "session has an uncommitted turn"
			c.JSON(http.StatusConflict, ret)
			return
		}
	}

	revision, canonicalSession, err := agent.SaveSessionState(body)
	if commitTurnID == "" {
		canonicalSession = nil
	}
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = err.Error()
		if errors.Is(err, agent.ErrSessionConflict) || errors.Is(err, agent.ErrRuntimeNotFinalized) {
			ret.Data = map[string]int64{"revision": revision}
			c.JSON(http.StatusConflict, ret)
			return
		}
		c.JSON(http.StatusInternalServerError, ret)
		return
	}
	if commitTurnID != "" && executor != nil {
		executor.markLegacyCommitted(commitTurnID)
		if commitErr := executor.commitTurn(commitTurnID); commitErr != nil {
			logging.LogErrorf("commit agent executor turn failed (session %s turn %s): %s", meta.ID, commitTurnID, commitErr)
		}
	}
	// 从 body 解出 sessionID 用于广播。update 仅触发其他实例刷新会话列表元数据，
	// 不触发当前视图重绘（重绘由 streamEnd 负责），回避流式中途半截数据的时序问题。
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), meta.ID, "update")
	ret := gulu.Ret.NewResult()
	data := map[string]any{"revision": revision}
	if canonicalSession != nil {
		data["session"] = canonicalSession
	}
	ret.Data = data
	c.JSON(http.StatusOK, ret)
}

func setAgentCommitTurnID(body []byte, turnID string) ([]byte, error) {
	var payload map[string]any
	if err := gulu.JSON.UnmarshalJSON(body, &payload); err != nil {
		return nil, err
	}
	payload["commitTurnID"] = turnID
	return gulu.JSON.MarshalJSON(payload)
}

// broadcastAgentSessionChanged 向除发起者 app 外、所有打开了 agentChat dock 的实例推送会话变更通知；
// action 取 streamStart / streamEnd / update / permission / delete。只广播普通会话：外部目录会话的
// ID、活动状态和时序都不能进入未携带 owner capability 的全局 WebSocket 通道；发起者 app 自身已被
// 排除，它已通过 SSE 自渲染或在本地持有最新状态。
func broadcastAgentSessionChanged(app, sessionID, action string) {
	if "" == app || "" == sessionID {
		return
	}
	binding, err := agent.GetTaskDirectoryBinding(sessionID)
	if err != nil {
		logging.LogErrorf("inspect agent session before broadcast failed: %s", err)
		return
	}
	if binding != nil {
		return
	}
	data := map[string]string{"sessionID": sessionID, "action": action}
	broadcastAgentSessionEvent(app, "agentChat", "agentSessionChanged", 0, "", data)
}

// sessionMeta 用于从 saveSession 的 body 中解析出会话 ID，agent 包内也有同名字段，此处独立定义避免循环依赖。
type sessionMeta struct {
	ID             string `json:"id"`
	CommitTurnID   string `json:"commitTurnID"`
	RecoveryTurnID string `json:"recoveryTurnID"`
}

type agentTaskDirectoryReq struct {
	SessionID   string `json:"sessionID"`
	Path        string `json:"path"`
	Permission  string `json:"permission,omitempty"`
	DirectoryID string `json:"directoryID,omitempty"`
}

func bindAgentTaskDirectory(c *gin.Context) {
	bindAgentTaskDirectoryGrant(c, true)
}

func addAgentTaskDirectory(c *gin.Context) {
	bindAgentTaskDirectoryGrant(c, false)
}

func bindAgentTaskDirectoryGrant(c *gin.Context, main bool) {
	var req agentTaskDirectoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	if !isAgentKernelDeviceRequest(c) {
		c.JSON(http.StatusForbidden, gin.H{"code": -1, "msg": "new task-directory bindings require WebUI and Kernel on the same device"})
		return
	}
	ownerAuth, _, ok := requireAgentSessionAccess(c, req.SessionID)
	if !ok {
		return
	}
	if ownerAuth == nil {
		c.JSON(http.StatusForbidden, gin.H{"code": -1, "msg": "verified guardian identity is required"})
		return
	}
	if isAgentSessionRunning(req.SessionID) {
		c.JSON(http.StatusConflict, gin.H{"code": -1, "msg": "task directory cannot be changed while the agent session is running"})
		return
	}
	var binding *agent.TaskDirectoryBinding
	var err error
	if main {
		binding, err = agent.BindTaskDirectory(req.SessionID, req.Path, ownerAuth.IdentityID)
	} else {
		binding, err = agent.AddTaskDirectory(req.SessionID, req.Path, agent.TaskDirectoryPermission(req.Permission), ownerAuth.IdentityID)
	}
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), req.SessionID, "update")
	ret := gulu.Ret.NewResult()
	ret.Data = binding.Redacted()
	c.JSON(http.StatusOK, ret)
}

func unbindAgentTaskDirectory(c *gin.Context) {
	var req agentTaskDirectoryReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid request"})
		return
	}
	_, binding, ok := requireAgentSessionAccess(c, req.SessionID)
	if !ok {
		return
	}
	if binding == nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "task directory is not bound"})
		return
	}
	if binding.Grant(req.DirectoryID) == nil {
		c.JSON(http.StatusNotFound, gin.H{"code": -1, "msg": "task directory grant is not bound"})
		return
	}
	if isAgentSessionRunning(req.SessionID) {
		c.JSON(http.StatusConflict, gin.H{"code": -1, "msg": "task directory cannot be changed while the agent session is running"})
		return
	}
	if err := agent.UnbindTaskDirectory(req.SessionID, req.DirectoryID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": err.Error()})
		return
	}
	// 解除前属于敏感会话，不广播其 ID。
	ret := gulu.Ret.NewResult()
	c.JSON(http.StatusOK, ret)
}

func writeSSE(c *gin.Context, event agent.AgentEvent) error {
	eventType, data := agentEventPayload(event)
	if eventType == "" {
		return nil
	}
	// 旧 /chat SSE 继续使用原有事件体，不添加 session/eventSeq 等新字段。
	delete(data, "turnID")
	if event.Type == "turn" || event.Type == "done" {
		data["turnID"] = event.TurnID
	}
	return writeSSEEvent(c, eventType, data)
}

func writeSSEEvent(c *gin.Context, eventType string, data any) error {
	b, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, err = fmt.Fprintf(c.Writer, "event:%s\ndata:%s\n\n", eventType, string(b))
	return err
}

func writeSSEError(c *gin.Context, message string) error {
	return writeSSEEvent(c, "error", map[string]string{"message": message})
}

func writeSSEInterrupted(c *gin.Context, message string) error {
	return writeSSEEvent(c, "interrupted", map[string]string{"message": message})
}

func lsSkills(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	skills := util.DiscoverSkills(model.EnabledUserSkills())
	ret.Data = skills
}

func lsUserSkills(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	ret.Data = util.DiscoverUserSkills(model.EnabledUserSkills())
}

type skillGetReq struct {
	Name string `json:"name"`
}

func getSkill(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	req := &skillGetReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	content, err := util.ReadSkill(req.Name, model.EnabledUserSkills())
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}

	ret.Data = map[string]string{
		"name":    req.Name,
		"content": content,
	}
}

type skillSaveReq struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

func saveSkill(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	req := &skillSaveReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	if err := util.SaveSkill(req.Name, req.Content); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

type skillRemoveReq struct {
	Name string `json:"name"`
}

func removeSkill(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	req := &skillRemoveReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	if err := util.RemoveSkill(req.Name); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}

type skillRenameReq struct {
	OldName string `json:"oldName"`
	NewName string `json:"newName"`
}

func renameSkill(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)

	req := &skillRenameReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		return
	}

	if err := util.RenameSkill(req.OldName, req.NewName); err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
}
