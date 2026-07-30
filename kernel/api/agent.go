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
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const agentOwnerTokenHeader = "X-SiYuan-Agent-Owner-Token"

var resolveAgentUploadNotebook = model.ResolveActiveWorkspaceAIMainNotebook
var getAgentKernelDeviceIPs = agentKernelDeviceIPs

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

func requireAgentSessionAccess(c *gin.Context, sessionID string) (*agentOwnerAuthorization, *agent.TaskDirectoryBinding, bool) {
	binding, err := agent.GetTaskDirectoryBinding(sessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "msg": "failed to inspect agent session"})
		return nil, nil, false
	}
	ownerAuth, authErr := optionalAgentOwnerAuthorization(c)
	if authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return nil, binding, false
	}
	if binding == nil {
		return ownerAuth, nil, true
	}
	if ownerAuth == nil || !subtleConstantTimeStringEqual(binding.OwnerIdentityID, ownerAuth.IdentityID) {
		c.JSON(http.StatusForbidden, gin.H{"code": -1, "msg": "verified device owner access is required"})
		return nil, binding, false
	}
	return ownerAuth, binding, true
}

func subtleConstantTimeStringEqual(left, right string) bool {
	if len(left) != len(right) || left == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
}

func requireRunningAgentAccess(c *gin.Context, sessionID string) bool {
	ownerAuth, binding, ok := requireAgentSessionAccess(c, sessionID)
	if !ok {
		return false
	}
	sessionsMu.Lock()
	running := runningSessions[sessionID]
	sessionsMu.Unlock()
	if running == nil {
		c.JSON(http.StatusConflict, gin.H{"code": -1, "msg": "agent session is not running"})
		return false
	}
	if binding != nil && (ownerAuth == nil || !subtleConstantTimeStringEqual(running.ownerIdentityID, ownerAuth.IdentityID)) {
		c.JSON(http.StatusForbidden, gin.H{"code": -1, "msg": "verified device owner access is required"})
		return false
	}
	return true
}

type agentChatReq struct {
	SessionID       string               `json:"sessionID"`
	UserEntryID     string               `json:"userEntryID"`
	ContentRevision *int64               `json:"contentRevision"`
	Message         string               `json:"message"`
	Language        string               `json:"language"`
	References      []agent.Reference    `json:"references"`
	EditorContext   agent.EditorContext  `json:"editorContext"`
	PluginActions   []agent.PluginAction `json:"pluginActions"`
	Model           string               `json:"model,omitempty"`
	Regenerate      bool                 `json:"regenerate"`
	ReasoningEffort string               `json:"reasoningEffort,omitempty"`
}

type runningSession struct {
	app             string
	turnID          string
	committed       bool
	terminal        bool
	eventCh         <-chan agent.AgentEvent
	ownerIdentityID string
}

var sessionsMu sync.Mutex
var runningSessions = map[string]*runningSession{}

func isAgentSessionRunning(sessionID string) bool {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	return runningSessions[sessionID] != nil
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
		ret.Msg = model.Conf.Language(193)
		c.JSON(http.StatusOK, ret)
		return
	}
	client := util.NewOpenAIClientWithModel(selectedProvider.APIKey, selectedProvider.BaseURL, selectedModel.Name, model.Conf.AI.EffectiveAPIProxy(model.Conf.System))

	confirmTimeout := time.Duration(model.Conf.AI.Agent.ConfirmTimeout) * time.Second
	if confirmTimeout <= 0 {
		confirmTimeout = 120 * time.Second
	}
	maxRetries := model.Conf.AI.Agent.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}
	// Provider 请求超时只限制建立上游流；流建立后由可重置的空闲超时检测连续无输出，
	// 避免持续正常输出的长回答被固定截止时间中断。
	requestTimeout := time.Duration(selectedProvider.RequestTimeout) * time.Second
	if requestTimeout <= 0 {
		requestTimeout = 30 * time.Second
	}
	streamIdleTimeout := time.Duration(model.Conf.AI.Agent.StreamIdleTimeout) * time.Second
	if streamIdleTimeout <= 0 {
		streamIdleTimeout = 120 * time.Second
	}

	app := c.GetHeader("X-SiYuan-App-ID")

	ownerIdentityID := ""
	ownerExpiresAt := int64(0)
	if ownerAuth != nil {
		ownerIdentityID = ownerAuth.IdentityID
		ownerExpiresAt = ownerAuth.ExpiresAt
	}
	ctx, cancel := context.WithCancel(c.Request.Context())

	// 实例级互斥：先占用会话，再启动 Agent，避免竞争失败时短暂执行工具或发起模型请求。
	sessionsMu.Lock()
	if _, ok := runningSessions[req.SessionID]; ok {
		sessionsMu.Unlock()
		cancel()
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "session is busy in another instance"
		c.JSON(http.StatusConflict, ret)
		return
	}
	running := &runningSession{app: app, ownerIdentityID: ownerIdentityID}
	runningSessions[req.SessionID] = running
	sessionsMu.Unlock()

	contentRevision := int64(-1)
	if req.ContentRevision != nil {
		contentRevision = *req.ContentRevision
	}
	eventCh := agent.AgentChat(ctx, client, selectedModel.Name, req.SessionID, req.UserEntryID, contentRevision, req.Message, req.Language, req.References, req.EditorContext, req.PluginActions, req.Regenerate, confirmTimeout, maxRetries, req.ReasoningEffort, taskDirectory, ownerIdentityID, ownerExpiresAt, requestTimeout, streamIdleTimeout)
	sessionsMu.Lock()
	if runningSessions[req.SessionID] == running {
		running.eventCh = eventCh
	}
	sessionsMu.Unlock()
	defer cancel()
	streamClosed := false
	defer func() {
		if streamClosed {
			return
		}
		go func() {
			for event := range eventCh {
				recordRunningEvent(req.SessionID, running, event)
			}
			finishRunningSession(req.SessionID, running)
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
		remaining := time.Until(time.Unix(ownerExpiresAt, 0))
		if remaining <= 0 {
			writeSSEError(c, "verified device owner authorization expired")
			return
		}
		ownerAuthorizationDeadline = time.After(remaining)
	}

	// 通知其他实例：该会话的流已开始，镜像端可显示"对话进行中"占位。
	broadcastAgentSessionChanged(app, req.SessionID, "streamStart")

	for {
		select {
		case event, ok := <-eventCh:
			if !ok {
				streamClosed = true
				finishRunningSession(req.SessionID, running)
				return
			}
			recordRunningEvent(req.SessionID, running, event)
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

func recordRunningEvent(sessionID string, running *runningSession, event agent.AgentEvent) {
	sessionsMu.Lock()
	defer sessionsMu.Unlock()
	if runningSessions[sessionID] != running {
		return
	}
	if event.Type == "turn" {
		running.turnID = event.TurnID
	}
	if event.Type == "done" || event.Type == "error" {
		running.terminal = true
	}
}

func finishRunningSession(sessionID string, running *runningSession) {
	sessionsMu.Lock()
	current := runningSessions[sessionID]
	if current != running {
		sessionsMu.Unlock()
		return
	}
	uncommitted := running.turnID != "" && !running.committed
	delete(runningSessions, sessionID)
	sessionsMu.Unlock()
	broadcastAgentSessionChanged(running.app, sessionID, "streamEnd")
	if uncommitted {
		binding, err := agent.GetTaskDirectoryBinding(sessionID)
		if err != nil {
			logging.LogErrorf("inspect agent session before broadcast failed: %s", err)
		} else if binding == nil {
			util.BroadcastByType("agentChat", "agentSessionChanged", 0, "", map[string]string{
				"sessionID": sessionID,
				"action":    "update",
			})
		}
	}
}

type agentConfirmReq struct {
	SessionID string `json:"sessionID"`
	ConfirmID string `json:"confirmID"`
	Approved  bool   `json:"approved"`
	Always    bool   `json:"always"`
}

func agentChatConfirm(c *gin.Context) {
	req := &agentConfirmReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	ret := gulu.Ret.NewResult()
	if !agent.ConfirmSession(req.SessionID, req.ConfirmID, req.Approved, req.Always) {
		ret.Code = -1
		ret.Msg = "agent confirmation expired"
		c.JSON(http.StatusConflict, ret)
		return
	}
	c.JSON(http.StatusOK, ret)
}

type agentQuestionReq struct {
	SessionID  string   `json:"sessionID"`
	QuestionID string   `json:"questionID"`
	Answers    []string `json:"answers"`
}

func agentChatQuestion(c *gin.Context) {
	req := &agentQuestionReq{}
	if err := c.ShouldBindJSON(req); err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	ret := gulu.Ret.NewResult()
	if !agent.AnswerQuestion(req.SessionID, req.QuestionID, req.Answers) {
		ret.Code = -1
		ret.Msg = "agent question expired"
		c.JSON(http.StatusConflict, ret)
		return
	}
	c.JSON(http.StatusOK, ret)
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
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "invalid request: " + err.Error()
		c.JSON(http.StatusOK, ret)
		return
	}
	if !requireRunningAgentAccess(c, req.SessionID) {
		return
	}
	ret := gulu.Ret.NewResult()
	if !agent.FrontendToolResult(req.SessionID, req.CallID, req.Result, req.IsError) {
		ret.Code = -1
		ret.Msg = "agent frontend tool call expired"
		c.JSON(http.StatusConflict, ret)
		return
	}
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
	sessionsMu.Lock()
	_, running := runningSessions[req.ID]
	if !running {
		if err := agent.FinalizeOrphanedTurn(req.ID); err != nil {
			sessionsMu.Unlock()
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = err.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
	}
	session, err := agent.GetSessionState(req.ID, !running)
	if err == nil && running {
		session["agentRunning"] = true
	}
	sessionsMu.Unlock()
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
	sessionsMu.Lock()
	_, running := runningSessions[req.ID]
	if running {
		sessionsMu.Unlock()
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = "session is running"
		c.JSON(http.StatusConflict, ret)
		return
	}
	err := agent.DeleteSession(req.ID)
	sessionsMu.Unlock()
	if err != nil {
		ret := gulu.Ret.NewResult()
		ret.Code = -1
		ret.Msg = err.Error()
		c.JSON(http.StatusInternalServerError, ret)
		return
	}
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
	sessionsMu.Lock()
	running := runningSessions[meta.ID]
	if running != nil && running.app != c.GetHeader("X-SiYuan-App-ID") {
		sessionsMu.Unlock()
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
	if running != nil && commitTurnID == "" && c.GetHeader("X-SiYuan-Agent-Checkpoint") != "2" && running.terminal && running.turnID != "" {
		var payload map[string]any
		if err := gulu.JSON.UnmarshalJSON(body, &payload); err != nil {
			sessionsMu.Unlock()
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = err.Error()
			c.JSON(http.StatusBadRequest, ret)
			return
		}
		payload["commitTurnID"] = running.turnID
		body, err = gulu.JSON.MarshalJSON(payload)
		if err != nil {
			sessionsMu.Unlock()
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = err.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
		commitTurnID = running.turnID
	}
	if running == nil {
		if runtimeErr := agent.FinalizeOrphanedTurn(meta.ID); runtimeErr != nil {
			sessionsMu.Unlock()
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = runtimeErr.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
		// 旧前端没有 commitTurnID。流已真正结束后，从终止检查点补出提交标识；SaveSession 仍会
		// 用 runtime 重建权威内容，因此不会信任旧前端可能不完整的流式快照。
		if commitTurnID == "" && c.GetHeader("X-SiYuan-Agent-Checkpoint") != "2" {
			recoverableTurnID, runtimeErr := agent.RecoverableTurnID(meta.ID)
			if runtimeErr != nil {
				sessionsMu.Unlock()
				ret := gulu.Ret.NewResult()
				ret.Code = -1
				ret.Msg = runtimeErr.Error()
				c.JSON(http.StatusInternalServerError, ret)
				return
			}
			if recoverableTurnID != "" {
				var payload map[string]any
				if err := gulu.JSON.UnmarshalJSON(body, &payload); err != nil {
					sessionsMu.Unlock()
					ret := gulu.Ret.NewResult()
					ret.Code = -1
					ret.Msg = err.Error()
					c.JSON(http.StatusBadRequest, ret)
					return
				}
				payload["commitTurnID"] = recoverableTurnID
				body, err = gulu.JSON.MarshalJSON(payload)
				if err != nil {
					sessionsMu.Unlock()
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
	if commitTurnID == "" && (running == nil || running.turnID == "") {
		uncommitted, runtimeErr := agent.HasUncommittedTurn(meta.ID)
		if runtimeErr != nil {
			sessionsMu.Unlock()
			ret := gulu.Ret.NewResult()
			ret.Code = -1
			ret.Msg = runtimeErr.Error()
			c.JSON(http.StatusInternalServerError, ret)
			return
		}
		if uncommitted {
			sessionsMu.Unlock()
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
	if err == nil && running != nil {
		if commitTurnID != "" && commitTurnID == running.turnID {
			running.committed = true
		}
	}
	sessionsMu.Unlock()
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

// broadcastAgentSessionChanged 只广播普通会话。外部目录会话的 ID、活动状态和时序
// 都不能进入未携带 owner capability 的全局 WebSocket 通道。
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
	util.BroadcastByTypeAndExcludeApp(app, "agentChat", "agentSessionChanged", 0, "", data)
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
	switch event.Type {
	case "turn":
		return writeSSEEvent(c, "turn", map[string]string{"turnID": event.TurnID})
	case "content":
		return writeSSEEvent(c, "content", map[string]string{"token": event.Token})
	case "thinking":
		return writeSSEEvent(c, "thinking", map[string]string{"reasoning": event.Reasoning})
	case "reasoning":
		return writeSSEEvent(c, "reasoning", map[string]string{"token": event.Token})
	case "confirm":
		return writeSSEEvent(c, "confirm", map[string]any{
			"name":      event.Name,
			"arguments": event.Arguments,
			"confirmID": event.ConfirmID,
			"effects":   event.Effects,
		})
	case "tool_call":
		return writeSSEEvent(c, "tool_call", map[string]any{
			"name":      event.Name,
			"arguments": event.Arguments,
			"callID":    event.CallID,
		})
	case "tool_progress":
		return writeSSEEvent(c, "tool_progress", map[string]interface{}{
			"name":     event.Name,
			"callID":   event.CallID,
			"progress": event.ToolProgress,
		})
	case "tool_result":
		return writeSSEEvent(c, "tool_result", map[string]string{
			"name":   event.Name,
			"result": event.Result,
			"callID": event.CallID,
		})
	case "error":
		return writeSSEEvent(c, "error", map[string]string{"message": event.Error})
	case "usage":
		return writeSSEEvent(c, "usage", map[string]any{
			"promptTokens":     event.PromptTokens,
			"completionTokens": event.CompletionTokens,
			"lastPromptTokens": event.LastPromptTokens,
			"tokenBreakdown":   event.TokenBreakdown,
			"cachedTokens":     event.CachedTokens,
			"contextLimit":     event.ContextLimit,
		})
	case "done":
		return writeSSEEvent(c, "done", map[string]string{"turnID": event.TurnID})
	case "retry":
		return writeSSEEvent(c, "retry", map[string]any{
			"attempt":    event.RetryAttempt,
			"maxRetries": event.RetryMax,
		})
	case "question":
		return writeSSEEvent(c, "question", map[string]any{
			"questionID": event.QuestionID,
			"arguments":  event.Arguments,
		})
	case "frontend_tool_call":
		return writeSSEEvent(c, "frontend_tool_call", map[string]any{
			"callID":    event.CallID,
			"name":      event.Name,
			"arguments": event.Arguments,
		})
	case "snapshot":
		return writeSSEEvent(c, "snapshot", map[string]string{"snapshotID": event.SnapshotID})
	}
	return nil
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
	skills := util.DiscoverSkills()
	ret.Data = skills
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

	content, err := util.ReadSkill(req.Name)
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
