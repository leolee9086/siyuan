package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var forgeRuntimeClose = model.Close

// forgeRuntimeShutdown 仅接受同一 Forge Supervisor 的回环请求，并在响应后优雅关闭 Kernel。
func forgeRuntimeShutdown(c *gin.Context) {
	if !util.IsForgeSupervisorRequest(c.Request.RemoteAddr, c.GetHeader(util.ForgeSupervisorTokenHeader)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid Forge Supervisor request"})
		return
	}
	c.JSON(http.StatusAccepted, gin.H{"state": "shutting_down"})
	go forgeRuntimeClose(false, false, 1)
}
