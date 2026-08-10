package api

import (
	"encoding/json"
	"io"
	"mime"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var forgeRuntimeClose = model.CloseForForgeRestart
var forgeRuntimeCallSupervisor = util.CallForgeSupervisor

var forgeRuntimeJobIDPattern = regexp.MustCompile(`^[a-zA-Z0-9_.-]{1,80}$`)
var forgeRuntimeRevisionPattern = regexp.MustCompile(`^[0-9a-f]{40}$`)

type forgeRuntimeStatusData struct {
	Available bool            `json:"available"`
	Status    json.RawMessage `json:"status,omitempty"`
}

type forgeRuntimeRestartRequest struct {
	Reason string `json:"reason"`
}

type forgeRuntimeApprovalRequest struct {
	JobID    string `json:"jobId"`
	Revision string `json:"revision"`
}

type forgeRuntimeShutdownRequest struct {
	JobID          string `json:"jobId"`
	TargetRevision string `json:"targetRevision"`
}

func forgeRuntimeStatus(c *gin.Context) {
	ret := util.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !util.IsForgeMode() {
		ret.Data = forgeRuntimeStatusData{Available: false}
		return
	}
	if !requireForgeRuntimeWebUI(c, ret) {
		return
	}
	payload, err := forgeRuntimeCallSupervisor(http.MethodGet, "/status", nil)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = forgeRuntimeStatusData{Available: true, Status: payload}
}

func forgeRuntimeRestart(c *gin.Context) {
	ret := util.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireForgeRuntimeMutation(c, ret) {
		return
	}
	var request forgeRuntimeRestartRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		ret.Code = -1
		ret.Msg = "无效的 Forge Runtime 重启请求"
		return
	}
	reason := strings.TrimSpace(request.Reason)
	if reason == "" {
		ret.Code = -1
		ret.Msg = "重启原因不能为空"
		return
	}
	forwardForgeRuntimeRequest(ret, "/restart", map[string]string{"reason": reason})
}

func forgeRuntimeApproveProtectedTests(c *gin.Context) {
	forwardForgeRuntimeApproval(c, "/approve-protected-tests")
}

func forgeRuntimeRejectProtectedTests(c *gin.Context) {
	forwardForgeRuntimeApproval(c, "/reject-protected-tests")
}

func forwardForgeRuntimeApproval(c *gin.Context, endpoint string) {
	ret := util.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireForgeRuntimeMutation(c, ret) {
		return
	}
	var request forgeRuntimeApprovalRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		ret.Code = -1
		ret.Msg = "无效的 Forge Runtime 审批请求"
		return
	}
	jobID := strings.TrimSpace(request.JobID)
	revision := strings.TrimSpace(request.Revision)
	if jobID == "" || revision == "" {
		ret.Code = -1
		ret.Msg = "jobId 和 revision 不能为空"
		return
	}
	forwardForgeRuntimeRequest(ret, endpoint, map[string]string{"jobId": jobID, "revision": revision})
}

func requireForgeRuntimeMutation(c *gin.Context, ret *util.Result) bool {
	if !requireForgeRuntimeWebUI(c, ret) {
		return false
	}
	if !util.IsForgeMode() {
		ret.Code = -1
		ret.Msg = "当前 Kernel 未运行在 Forge 模式"
		return false
	}
	return true
}

// requireForgeRuntimeWebUI 将人工主界面控制面与通用 API Token、插件 JWT 和
// Agent 工具通道分开。设备来源只依据服务端观察到的连接地址，不信任请求头。
func requireForgeRuntimeWebUI(c *gin.Context, ret *util.Result) bool {
	if !isAgentKernelDeviceRequest(c) {
		ret.Code = -1
		ret.Msg = "Forge Runtime 控制仅允许 Kernel 同设备 WebUI 访问"
		return false
	}
	if c.GetHeader("Authorization") != "" || c.GetHeader(model.XAuthTokenKey) != "" || c.Query("token") != "" {
		ret.Code = -1
		ret.Msg = "Forge Runtime WebUI 控制不接受 API Token、插件 JWT 或 BasicAuth，请使用已登录的主界面"
		return false
	}
	contentType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || !strings.EqualFold(contentType, "application/json") {
		ret.Code = -1
		ret.Msg = "Forge Runtime 控制仅接受 application/json 请求"
		return false
	}
	return true
}

func forwardForgeRuntimeRequest(ret *util.Result, endpoint string, body any) {
	payload, err := forgeRuntimeCallSupervisor(http.MethodPost, endpoint, body)
	if err != nil {
		ret.Code = -1
		ret.Msg = err.Error()
		return
	}
	ret.Data = payload
}

// forgeRuntimeShutdown 仅接受同一 Forge Supervisor 的回环请求，并在响应后优雅关闭 Kernel。
func forgeRuntimeShutdown(c *gin.Context) {
	if !util.IsForgeSupervisorRequest(c.Request.RemoteAddr, c.GetHeader(util.ForgeSupervisorTokenHeader)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid Forge Supervisor request"})
		return
	}
	contentType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || !strings.EqualFold(contentType, "application/json") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Forge Runtime shutdown requires application/json"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 4096)
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	var request forgeRuntimeShutdownRequest
	if err = decoder.Decode(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Forge Runtime shutdown request"})
		return
	}
	if err = decoder.Decode(&struct{}{}); err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Forge Runtime shutdown request"})
		return
	}
	if !forgeRuntimeJobIDPattern.MatchString(request.JobID) ||
		!forgeRuntimeRevisionPattern.MatchString(request.TargetRevision) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid Forge Runtime shutdown identity"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"state": "shutting_down"})
	go forgeRuntimeClose(false, false, 1, request.JobID, request.TargetRevision)
}
