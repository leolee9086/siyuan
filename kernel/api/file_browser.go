package api

import (
	"context"
	"encoding/json"
	"errors"
	"mime"
	"net/http"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/assetmeta"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
	"github.com/siyuan-note/siyuan/kernel/fileproperties"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var newFileBrowserService = func() *filebrowser.Service {
	return filebrowser.NewService(util.WorkspaceDir, nil)
}

var newFilePropertiesService = func() *fileproperties.Service {
	return fileproperties.NewService(newFileBrowserService(), assetmeta.NewInstance())
}

type fileBrowserTagDefinitionsService interface {
	GetTagDefinitions() assetmeta.TagDefinitionsSnapshot
	UpdateTagDefinitions(assetmeta.TagDefinitionsUpdate) (assetmeta.TagDefinitionsSnapshot, error)
}

var newFileBrowserTagDefinitionsService = func() fileBrowserTagDefinitionsService {
	return assetmeta.NewInstance()
}

func requireLocalFileBrowser(c *gin.Context, ret *gulu.Result) bool {
	if isAgentKernelDeviceRequest(c) {
		return true
	}
	ret.Code = http.StatusForbidden
	ret.Msg = "file browser roots are available on the kernel device only"
	return false
}

func getSForgeFileBrowserRoots(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	roots, err := newFileBrowserService().ListRoots()
	if err != nil {
		ret.Code = http.StatusInternalServerError
		ret.Msg = err.Error()
		return
	}
	ret.Data = roots
}

func listSForgeFileBrowserDirectory(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return
	}
	encoded, err := json.Marshal(arg)
	if err != nil {
		ret.Code = http.StatusBadRequest
		ret.Msg = err.Error()
		return
	}
	var request filebrowser.ListRequest
	if err = json.Unmarshal(encoded, &request); err != nil {
		ret.Code = http.StatusBadRequest
		ret.Msg = err.Error()
		return
	}
	if request.RootID == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = "rootID is required"
		return
	}
	result, err := newFileBrowserService().ListContext(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func walkSForgeFileBrowserDirectory(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request filebrowser.WalkRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.RootID == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = "rootID is required"
		return
	}
	result, err := newFileBrowserService().WalkContext(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func decodeFileBrowserRequest(c *gin.Context, ret *gulu.Result, target any) bool {
	arg, ok := util.JsonArg(c, ret)
	if !ok {
		return false
	}
	encoded, err := json.Marshal(arg)
	if err == nil {
		err = json.Unmarshal(encoded, target)
	}
	if err != nil {
		ret.Code = http.StatusBadRequest
		ret.Msg = err.Error()
		return false
	}
	return true
}

func statSForgeFileBrowserFile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request filebrowser.FileRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.RootID == "" || request.Path == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = "rootID and path are required"
		return
	}
	result, err := newFileBrowserService().Stat(request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func batchSForgeFileBrowserProperties(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request filebrowser.BatchPropertiesRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	result, err := newFilePropertiesService().Inspect(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func setSForgeFileProperties(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request fileproperties.BatchUpdateRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	result, err := newFilePropertiesService().Update(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func getSForgeFileBrowserTagDefinitions(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	ret.Data = newFileBrowserTagDefinitionsService().GetTagDefinitions()
}

func setSForgeFileBrowserTagDefinitions(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request assetmeta.TagDefinitionsUpdate
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	result, err := newFileBrowserTagDefinitionsService().UpdateTagDefinitions(request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func previewSForgeFileBrowserFile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request filebrowser.PreviewRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.RootID == "" || request.Path == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = "rootID and path are required"
		return
	}
	result, err := newFileBrowserService().Preview(request)
	if err != nil {
		ret.Code = fileBrowserErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func serveSForgeFileBrowserContent(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	if !requireLocalFileBrowser(c, ret) {
		c.AbortWithStatus(ret.Code)
		return
	}
	request := filebrowser.FileRequest{
		RootID: c.Param("rootID"),
		Path:   strings.TrimPrefix(c.Param("path"), "/"),
	}
	file, stat, err := newFileBrowserService().Open(request)
	if err != nil {
		c.AbortWithStatus(fileBrowserErrorCode(err))
		return
	}
	defer file.Close()
	disposition := "attachment"
	if stat.PreviewKind == filebrowser.PreviewKindImage || stat.PreviewKind == filebrowser.PreviewKindAudio ||
		stat.PreviewKind == filebrowser.PreviewKindVideo || stat.PreviewKind == filebrowser.PreviewKindPDF {
		disposition = "inline"
	}
	c.Header("Cache-Control", "private, no-cache")
	c.Header("Content-Security-Policy", "sandbox; default-src 'none'")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": stat.Entry.Name}))
	c.Header("Content-Type", stat.MediaType)
	info, err := file.Stat()
	if err != nil {
		c.AbortWithStatus(http.StatusInternalServerError)
		return
	}
	http.ServeContent(c.Writer, c.Request, stat.Entry.Name, info.ModTime(), file)
}

func fileBrowserErrorCode(err error) int {
	switch {
	case errors.Is(err, assetmeta.ErrTagDefinitionInvalid):
		return http.StatusBadRequest
	case errors.Is(err, assetmeta.ErrTagDefinitionsConflict):
		return http.StatusConflict
	case errors.Is(err, assetmeta.ErrTagDefinitionsUnavailable):
		return http.StatusServiceUnavailable
	case errors.Is(err, filebrowser.ErrPropertiesEmpty), errors.Is(err, filebrowser.ErrPropertiesTooLarge):
		return http.StatusBadRequest
	case errors.Is(err, filebrowser.ErrRootNotFound), errors.Is(err, filebrowser.ErrPathNotFound):
		return http.StatusNotFound
	case errors.Is(err, filebrowser.ErrPathTraversal):
		return http.StatusForbidden
	case errors.Is(err, filebrowser.ErrRootUnavailable):
		return http.StatusGone
	case errors.Is(err, filebrowser.ErrNotDirectory), errors.Is(err, filebrowser.ErrNotFile):
		return http.StatusMethodNotAllowed
	case errors.Is(err, filebrowser.ErrPreviewUnsupported):
		return http.StatusUnsupportedMediaType
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return http.StatusRequestTimeout
	default:
		return http.StatusInternalServerError
	}
}
