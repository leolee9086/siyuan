package api

import (
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/thumbnail"
)

// getSForgeFileBrowserThumbnail serves a resized preview after the file-browser root boundary has resolved it.
// The query form keeps root-relative paths opaque to routing and works for external Agent roots as well.
func getSForgeFileBrowserThumbnail(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	if !requireLocalFileBrowser(c, ret) {
		c.AbortWithStatus(ret.Code)
		return
	}
	rootID := c.Query("rootID")
	relativePath := c.Query("path")
	if rootID == "" || relativePath == "" {
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}
	service := newFileBrowserService()
	_, absolutePath, _, info, err := service.ValidateFilePath(rootID, relativePath)
	if err != nil {
		c.AbortWithStatus(fileBrowserErrorCode(err))
		return
	}
	if info == nil || !info.Mode().IsRegular() {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	width, height := parseSizeParams(c)
	var data []byte
	var contentType string
	if c.Query("refresh") == "true" || c.Query("refresh") == "1" {
		data, contentType, err = thumbnail.NewInstance().Refresh(absolutePath, width, height)
	} else {
		data, contentType, err = thumbnail.NewInstance().GetWithSize(absolutePath, width, height)
	}
	if err != nil {
		c.AbortWithStatus(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "private, max-age=86400")
	c.Data(http.StatusOK, contentType, data)
}
