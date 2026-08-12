package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func createFileBrowserProviderDirectory(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderCreateRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.Kind != externalprovider.EntryKindDirectory {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	registry := newFileBrowserProviderRegistry()
	parent, err := resolveProviderLocator(registry, request.providerResourceLocator)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	result, err := registry.CreateResource(c.Request.Context(), parent, externalprovider.CreateRequest{
		Parent: parent, Name: request.Name, Kind: request.Kind, Size: 0,
		MediaType: request.MediaType, Metadata: request.Metadata, Preconditions: request.Preconditions,
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderMutation(result)
}

// createFileBrowserProviderFile streams the request body directly to the
// provider. The Kernel never materializes the upload in a project cache.
func createFileBrowserProviderFile(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	locator, err := providerLocatorFromQuery(c, false)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	name := c.Query("name")
	if strings.TrimSpace(name) == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = "name is required"
		return
	}
	registry := newFileBrowserProviderRegistry()
	parent, err := resolveProviderLocator(registry, locator)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	result, err := registry.CreateResource(c.Request.Context(), parent, externalprovider.CreateRequest{
		Parent: parent, Name: name, Kind: externalprovider.EntryKindFile,
		Content: c.Request.Body, Size: requestBodySize(c), MediaType: requestMediaType(c),
		Preconditions: requestPreconditions(c),
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderMutation(result)
}

func updateFileBrowserProviderEntry(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderUpdateRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	registry := newFileBrowserProviderRegistry()
	target, err := resolveProviderLocator(registry, request.providerResourceLocator)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	if request.NewName == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = "newName is required for a JSON update"
		return
	}
	result, err := registry.UpdateResource(c.Request.Context(), target, externalprovider.UpdateRequest{
		Target: target, NewName: request.NewName, Size: 0,
		MediaType: request.MediaType, Metadata: request.Metadata, Preconditions: request.Preconditions,
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderMutation(result)
}

// updateFileBrowserProviderContent streams a replacement body and optionally
// renames the target in the same provider transaction.
func updateFileBrowserProviderContent(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	locator, err := providerLocatorFromQuery(c, true)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	registry := newFileBrowserProviderRegistry()
	target, err := resolveProviderLocator(registry, locator)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	result, err := registry.UpdateResource(c.Request.Context(), target, externalprovider.UpdateRequest{
		Target: target, NewName: c.Query("newName"), Content: c.Request.Body,
		Size: requestBodySize(c), MediaType: requestMediaType(c), Preconditions: requestPreconditions(c),
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderMutation(result)
}

func deleteFileBrowserProviderEntries(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderDeleteRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if len(request.Targets) == 0 {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	registry := newFileBrowserProviderRegistry()
	targets := make([]externalprovider.ResourceRef, 0, len(request.Targets))
	for _, locator := range request.Targets {
		target, err := resolveProviderLocator(registry, locator)
		if err != nil {
			ret.Code = fileBrowserProviderErrorCode(err)
			ret.Msg = err.Error()
			return
		}
		targets = append(targets, target)
	}
	result, err := registry.DeleteResource(c.Request.Context(), targets[0], externalprovider.DeleteRequest{
		Targets: targets, Recursive: request.Recursive, Preconditions: request.Preconditions,
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderMutation(result)
}

func transferFileBrowserProviderEntry(c *gin.Context, move bool) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderTransferRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	registry := newFileBrowserProviderRegistry()
	source, err := resolveProviderLocator(registry, request.Source)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	destination, err := resolveProviderLocator(registry, request.Destination)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	if move {
		result, moveErr := registry.MoveResource(c.Request.Context(), source, externalprovider.MoveRequest{
			Source: source, Destination: destination, Overwrite: request.Overwrite, Preconditions: request.Preconditions,
		})
		if moveErr != nil {
			ret.Code = fileBrowserProviderErrorCode(moveErr)
			ret.Msg = moveErr.Error()
			return
		}
		ret.Data = publicProviderMutation(result)
		return
	}
	result, err := registry.CopyResource(c.Request.Context(), source, externalprovider.CopyRequest{
		Source: source, Destination: destination, Overwrite: request.Overwrite, Preconditions: request.Preconditions,
	})
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = publicProviderMutation(result)
}

func copyFileBrowserProviderEntry(c *gin.Context) {
	transferFileBrowserProviderEntry(c, false)
}

func moveFileBrowserProviderEntry(c *gin.Context) {
	transferFileBrowserProviderEntry(c, true)
}

func providerLocatorFromQuery(c *gin.Context, target bool) (providerResourceLocator, error) {
	locator := providerResourceLocator{
		Provider: fileprovider.ProviderID(c.Query("provider")),
		Session:  externalprovider.SessionID(c.Query("session")),
		Resource: externalprovider.ResourceID(c.Query("resource")),
		Token:    c.Query("token"),
	}
	if target && !locator.hasToken() {
		return providerResourceLocator{}, fileprovider.ErrInvalidProviderRequest
	}
	if !target && locator.hasToken() {
		return locator, nil
	}
	return locator, nil
}

func requestBodySize(c *gin.Context) int64 {
	if c.Request.ContentLength >= 0 {
		return c.Request.ContentLength
	}
	if value := c.Query("size"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err == nil && parsed >= 0 {
			return parsed
		}
	}
	return -1
}

func requestMediaType(c *gin.Context) string {
	value := strings.TrimSpace(c.Query("mediaType"))
	if value != "" {
		return value
	}
	return strings.TrimSpace(strings.Split(c.GetHeader("Content-Type"), ";")[0])
}

func requestPreconditions(c *gin.Context) externalprovider.Preconditions {
	return externalprovider.Preconditions{
		IfMatch: c.GetHeader("If-Match"), IfNoneMatch: c.GetHeader("If-None-Match"), VersionID: c.GetHeader("X-Version-ID"),
	}
}

func getFileBrowserProviderOperation(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	provider := fileprovider.ProviderID(c.Query("provider"))
	operation := externalprovider.OperationRef{ID: c.Query("operation")}
	if provider == "" || operation.ID == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	status, err := newFileBrowserProviderRegistry().Operation(c.Request.Context(), provider, operation)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = status
}
