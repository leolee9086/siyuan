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
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const agentOwnerTokenHeader = "X-SiYuan-Agent-Owner-Token"

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
	return util.IsLocalHost(c.Request.RemoteAddr) && util.IsLocalHost(c.Request.Host)
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
	client := util.NewOpenAIClient(selectedProvider.APIKey, model.Conf.AI.EffectiveAPIProxy(model.Conf.System), selectedProvider.BaseURL)

	confirmTimeout := time.Duration(model.Conf.AI.Agent.ConfirmTimeout) * time.Second
	if confirmTimeout <= 0 {
		confirmTimeout = 120 * time.Second
	}
	maxRetries := model.Conf.AI.Agent.MaxRetries
	if maxRetries <= 0 {
		maxRetries = 3
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
	runningSessions[req.SessionID] = &runningSession{ownerIdentityID: ownerIdentityID}
	sessionsMu.Unlock()
	eventCh := agent.AgentChat(ctx, client, selectedModel.Name, req.SessionID, req.Message, req.Language, req.References, req.EditorContext, req.PluginActions, req.Regenerate, confirmTimeout, maxRetries, req.ReasoningEffort, taskDirectory, ownerIdentityID, ownerExpiresAt)
	sessionsMu.Lock()
	if running := runningSessions[req.SessionID]; running != nil {
		running.eventCh = eventCh
	}
	sessionsMu.Unlock()
	defer cancel()
	defer func() {
		sessionsMu.Lock()
		delete(runningSessions, req.SessionID)
		sessionsMu.Unlock()
	}()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		return
	}

	timeout := selectedProvider.RequestTimeout
	if timeout <= 0 {
		timeout = 30
	}
	totalTimeout := time.Duration(model.Conf.AI.Agent.SessionTimeout) * time.Second
	if totalTimeout <= 0 {
		totalTimeout = time.Duration(timeout) * time.Second * 10
	}
	if totalTimeout > 3600*time.Second {
		totalTimeout = 3600 * time.Second
	}
	deadline := time.After(totalTimeout)
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
				// 流正常结束（done 已写入 SSE）。通知镜像端解除占位锁定；
				// 实际内容重绘由发起者前端随后的 saveSession 广播（update）驱动，确保读到落盘后的完整数据。
				broadcastAgentSessionChanged(app, req.SessionID, "streamEnd")
				sessionsMu.Lock()
				delete(runningSessions, req.SessionID)
				sessionsMu.Unlock()
				return
			}
			if err := writeSSE(c, event); err != nil {
				// 客户端断开导致写失败，同样通知镜像端解除锁定，避免占位条悬挂。
				broadcastAgentSessionChanged(app, req.SessionID, "streamEnd")
				return
			}
			flusher.Flush()
		case <-c.Request.Context().Done():
			broadcastAgentSessionChanged(app, req.SessionID, "streamEnd")
			return
		case <-deadline:
			broadcastAgentSessionChanged(app, req.SessionID, "streamEnd")
			writeSSEError(c, model.Conf.Language(24))
			flusher.Flush()
			return
		case <-ownerAuthorizationDeadline:
			writeSSEError(c, "verified device owner authorization expired")
			flusher.Flush()
			return
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
	agent.ConfirmSession(req.SessionID, req.ConfirmID, req.Approved, req.Always)
	ret := gulu.Ret.NewResult()
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
	agent.AnswerQuestion(req.SessionID, req.QuestionID, req.Answers)
	ret := gulu.Ret.NewResult()
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
	agent.FrontendToolResult(req.SessionID, req.CallID, req.Result, req.IsError)
	ret := gulu.Ret.NewResult()
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
	client := util.NewOpenAIClient(selectedProvider.APIKey, model.Conf.AI.EffectiveAPIProxy(model.Conf.System), selectedProvider.BaseURL)

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

func sanitizeSessionForResponse(session map[string]interface{}) map[string]interface{} {
	if session == nil {
		return nil
	}
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
	session, err := agent.GetSession(req.ID)
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
		c.JSON(http.StatusConflict, gin.H{"code": -1, "msg": "running agent session cannot be deleted"})
		return
	}
	_ = agent.DeleteSession(req.ID)
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
		c.JSON(http.StatusBadRequest, gin.H{"code": -1, "msg": "invalid agent session payload"})
		return
	}
	if _, _, ok := requireAgentSessionAccess(c, meta.ID); !ok {
		return
	}
	if err := agent.SaveSession(body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"code": -1, "msg": "failed to save agent session"})
		return
	}
	// update 只广播会话 ID 和动作，不携带任务目录、标题或消息内容。
	broadcastAgentSessionChanged(c.GetHeader("X-SiYuan-App-ID"), meta.ID, "update")
	ret := gulu.Ret.NewResult()
	c.JSON(http.StatusOK, ret)
}

// broadcastAgentSessionChanged 只广播普通会话。外部目录会话的 ID、活动状态和时序
// 都不能进入未携带 owner capability 的全局 WebSocket 通道。
func broadcastAgentSessionChanged(app, sessionID, action string) {
	if "" == app || "" == sessionID {
		return
	}
	binding, err := agent.GetTaskDirectoryBinding(sessionID)
	if err != nil || binding != nil {
		return
	}
	data := map[string]string{"sessionID": sessionID, "action": action}
	util.BroadcastByTypeAndExcludeApp(app, "agentChat", "agentSessionChanged", 0, "", data)
}

// sessionMeta 用于从 saveSession 的 body 中解析出会话 ID，agent 包内也有同名字段，此处独立定义避免循环依赖。
type sessionMeta struct {
	ID string `json:"id"`
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
	case "content":
		return writeSSEEvent(c, "content", map[string]string{"token": event.Token})
	case "thinking":
		return writeSSEEvent(c, "thinking", map[string]string{"reasoning": event.Reasoning})
	case "reasoning":
		return writeSSEEvent(c, "reasoning", map[string]string{"token": event.Token})
	case "confirm":
		return writeSSEEvent(c, "confirm", map[string]interface{}{
			"name":      event.Name,
			"arguments": event.Arguments,
			"confirmID": event.ConfirmID,
		})
	case "tool_call":
		return writeSSEEvent(c, "tool_call", map[string]interface{}{
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
		return writeSSEEvent(c, "usage", map[string]interface{}{
			"promptTokens":     event.PromptTokens,
			"completionTokens": event.CompletionTokens,
			"lastPromptTokens": event.LastPromptTokens,
			"tokenBreakdown":   event.TokenBreakdown,
			"cachedTokens":     event.CachedTokens,
			"contextLimit":     event.ContextLimit,
		})
	case "done":
		return writeSSEEvent(c, "done", map[string]interface{}{})
	case "retry":
		return writeSSEEvent(c, "retry", map[string]interface{}{
			"attempt":    event.RetryAttempt,
			"maxRetries": event.RetryMax,
		})
	case "question":
		return writeSSEEvent(c, "question", map[string]interface{}{
			"questionID": event.QuestionID,
			"arguments":  event.Arguments,
		})
	case "frontend_tool_call":
		return writeSSEEvent(c, "frontend_tool_call", map[string]interface{}{
			"callID":    event.CallID,
			"name":      event.Name,
			"arguments": event.Arguments,
		})
	case "snapshot":
		return writeSSEEvent(c, "snapshot", map[string]string{"snapshotID": event.SnapshotID})
	}
	return nil
}

func writeSSEEvent(c *gin.Context, eventType string, data interface{}) error {
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
