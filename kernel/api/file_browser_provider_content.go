package api

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func serveFileBrowserProviderContent(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	if !requireLocalFileBrowser(c, ret) {
		c.AbortWithStatus(ret.Code)
		return
	}
	locator := providerResourceLocator{
		Provider: fileprovider.ProviderID(c.Query("provider")),
		Session:  externalprovider.SessionID(c.Query("session")),
		Resource: externalprovider.ResourceID(c.Query("resource")),
		Token:    c.Query("token"),
	}
	registry := newFileBrowserProviderRegistry()
	openRequest := sForgeFileBrowserProviderOpenRequest{}
	byteRange, rangeOK := parseProviderRange(c.GetHeader("Range"))
	if !rangeOK {
		c.Header("Content-Range", "bytes */*")
		c.AbortWithStatus(http.StatusRequestedRangeNotSatisfiable)
		return
	}
	openRequest.Range = byteRange
	request, err := providerOpenRequestFromLocator(registry, locator, openRequest)
	if err != nil {
		c.AbortWithStatus(fileBrowserProviderErrorCode(err))
		return
	}
	result, err := registry.OpenResource(c.Request.Context(), request)
	if err != nil {
		c.AbortWithStatus(fileBrowserProviderErrorCode(err))
		return
	}
	if result.Reader == nil {
		c.AbortWithStatus(http.StatusBadGateway)
		return
	}
	defer result.Reader.Close()
	contentType := result.MediaType
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	name := result.Entry.Name
	if name == "" {
		name = "download"
	}
	disposition := "inline"
	if !isInlineProviderMediaType(contentType) {
		disposition = "attachment"
	}
	c.Header("Cache-Control", "private, no-cache")
	c.Header("Content-Security-Policy", "sandbox; default-src 'none'")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
	c.Header("Content-Type", contentType)
	c.Header("Accept-Ranges", "bytes")
	c.Header("Content-Length", strconv.FormatInt(result.Size, 10))
	if byteRange != nil {
		c.Status(http.StatusPartialContent)
		c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/*", byteRange.Start, byteRange.Start+result.Size-1))
	} else {
		c.Status(http.StatusOK)
	}
	_, _ = io.Copy(c.Writer, result.Reader)
}

func parseProviderRange(value string) (*externalprovider.ByteRange, bool) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, true
	}
	if !strings.HasPrefix(value, "bytes=") || strings.Contains(value, ",") {
		return nil, false
	}
	parts := strings.SplitN(strings.TrimPrefix(value, "bytes="), "-", 2)
	if len(parts) != 2 || parts[0] == "" {
		return nil, false
	}
	start, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || start < 0 {
		return nil, false
	}
	result := &externalprovider.ByteRange{Start: start}
	if parts[1] != "" {
		end, parseErr := strconv.ParseInt(parts[1], 10, 64)
		if parseErr != nil || end < start {
			return nil, false
		}
		result.End = end
	}
	return result, true
}

func isInlineProviderMediaType(value string) bool {
	value = strings.ToLower(strings.TrimSpace(strings.Split(value, ";")[0]))
	return strings.HasPrefix(value, "image/") || strings.HasPrefix(value, "audio/") ||
		strings.HasPrefix(value, "video/") || value == "application/pdf" || value == "text/plain" ||
		value == "text/markdown" || value == "application/json" || value == "image/svg+xml"
}
