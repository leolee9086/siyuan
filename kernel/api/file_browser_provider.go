package api

import (
	"context"
	"errors"
	"io"
	"net/http"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	efu "github.com/siyuan-note/siyuan/packages/everything-efu"
	everythinghttp "github.com/siyuan-note/siyuan/packages/everything-http-native"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
	s3provider "github.com/siyuan-note/siyuan/packages/s3-provider"
	synologyfilestation "github.com/siyuan-note/siyuan/packages/synology-file-station-provider"
	webdavprovider "github.com/siyuan-note/siyuan/packages/webdav-provider"
	windowssmbmount "github.com/siyuan-note/siyuan/packages/windows-smb-mount-provider"
)

// buildFileBrowserProviderRegistry is the composition seam for external
// providers. The registry owns provider selection; this API layer only wires
// authorized kernel services into adapters.
func buildFileBrowserProviderRegistry() *fileprovider.ProviderRegistry {
	addresses := fileprovider.NewAddressRegistry()
	registry := fileprovider.NewProviderRegistry(addresses)
	mustRegisterFileBrowserProvider(registry, everythinghttp.NewProvider(nil))
	mustRegisterFileBrowserProvider(registry, efu.NewProvider(openAuthorizedEFU))
	synology, err := synologyfilestation.NewProvider(synologyfilestation.Config{
		ResolveCredential: resolveSynologyCredential,
	})
	if err != nil {
		panic(err)
	}
	mustRegisterFileBrowserProvider(registry, synology)
	mustRegisterFileBrowserProvider(registry, windowssmbmount.NewProvider(windowssmbmount.Config{}))
	s3, err := s3provider.NewProvider(s3provider.Config{
		ResolveCredential: resolveS3Credential,
	})
	if err != nil {
		panic(err)
	}
	mustRegisterFileBrowserProvider(registry, s3)
	mustRegisterFileBrowserProvider(registry, webdavprovider.NewProviderWithOptions(webdavprovider.Options{
		ResolveCredential: resolveWebDAVCredential,
	}))
	return registry
}

func mustRegisterFileBrowserProvider(registry *fileprovider.ProviderRegistry, provider externalprovider.Provider) {
	if err := registry.Register(provider); err != nil {
		panic(err)
	}
}

func resolveSynologyCredential(ctx context.Context, reference string) (synologyfilestation.Credentials, error) {
	payload, err := fileBrowserProviderCredentialVault.Resolve(ctx, synologyfilestation.ProviderID, reference)
	if err != nil {
		return synologyfilestation.Credentials{}, err
	}
	return synologyfilestation.DecodeCredentials(payload)
}

func resolveS3Credential(ctx context.Context, reference string) (s3provider.Credentials, error) {
	payload, err := fileBrowserProviderCredentialVault.Resolve(ctx, s3provider.ProviderID, reference)
	if err != nil {
		return s3provider.Credentials{}, err
	}
	return s3provider.DecodeCredentials(payload)
}

func resolveWebDAVCredential(ctx context.Context, reference string) (webdavprovider.Credentials, error) {
	payload, err := fileBrowserProviderCredentialVault.Resolve(ctx, webdavprovider.ProviderID, reference)
	if err != nil {
		return webdavprovider.Credentials{}, err
	}
	return webdavprovider.DecodeCredentials(payload)
}

// The registry is process-scoped: provider sessions and opaque addresses must
// survive the request that created them. Tests and composition roots can still
// replace this function without mutating the shared production instance.
var fileBrowserProviderRegistry = buildFileBrowserProviderRegistry()

var newFileBrowserProviderRegistry = func() *fileprovider.ProviderRegistry {
	return fileBrowserProviderRegistry
}

func openAuthorizedEFU(ctx context.Context, request efu.SearchRequest) (io.ReadCloser, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	file, _, err := newFileBrowserService().Open(filebrowser.FileRequest{RootID: request.RootID, Path: request.Path})
	if err != nil {
		return nil, err
	}
	return file, nil
}

func searchSForgeFileBrowserProvider(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request fileprovider.SearchRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.Provider == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	result, err := newFileBrowserProviderRegistry().Search(c.Request.Context(), request)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = result
}

func fileBrowserProviderErrorCode(err error) int {
	switch {
	case errors.Is(err, fileprovider.ErrInvalidProviderRequest), errors.Is(err, fileprovider.ErrEFUHeader),
		errors.Is(err, externalprovider.ErrInsecureTransportNotConfirmed),
		errors.Is(err, externalprovider.ErrInsecureTransportHostNotPrivate),
		errors.Is(err, externalprovider.ErrInsecureTransportRedirect):
		return http.StatusBadRequest
	case errors.Is(err, externalprovider.ErrNotFound), errors.Is(err, fileprovider.ErrProviderSessionNotFound),
		errors.Is(err, fileprovider.ErrExternalAddressNotFound):
		return http.StatusNotFound
	case errors.Is(err, externalprovider.ErrPermission):
		return http.StatusForbidden
	case errors.Is(err, externalprovider.ErrConflict), errors.Is(err, fileprovider.ErrProviderSessionExists):
		return http.StatusConflict
	case errors.Is(err, fileprovider.ErrProviderCapabilityMissing):
		return http.StatusNotImplemented
	case errors.Is(err, fileprovider.ErrProviderNotRegistered):
		return http.StatusNotImplemented
	case errors.Is(err, fileprovider.ErrProviderUnavailable):
		return http.StatusBadGateway
	case errors.Is(err, fileprovider.ErrProviderResponse):
		return http.StatusBadGateway
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		return http.StatusRequestTimeout
	case errors.Is(err, filebrowser.ErrRootNotFound), errors.Is(err, filebrowser.ErrPathNotFound):
		return http.StatusNotFound
	case errors.Is(err, filebrowser.ErrPathTraversal), errors.Is(err, filebrowser.ErrWriteDenied):
		return http.StatusForbidden
	default:
		return http.StatusInternalServerError
	}
}
