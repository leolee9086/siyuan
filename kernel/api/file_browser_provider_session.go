package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type fileBrowserProviderCredentialStore interface {
	Issue(fileprovider.ProviderID, []byte) (string, error)
	Resolve(context.Context, fileprovider.ProviderID, string) ([]byte, error)
	Revoke(string)
}

var fileBrowserProviderCredentialVault fileBrowserProviderCredentialStore = fileprovider.NewCredentialVault()

func openFileBrowserProviderSession(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderSessionRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.Provider == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	registry := newFileBrowserProviderRegistry()
	provider, ok := registry.Lookup(request.Provider)
	if !ok {
		ret.Code = fileBrowserProviderErrorCode(fileprovider.ErrProviderNotRegistered)
		ret.Msg = fileprovider.ErrProviderNotRegistered.Error()
		return
	}
	if request.CredentialRef != "" && len(request.Credentials) > 0 {
		ret.Code = http.StatusBadRequest
		ret.Msg = "credentialRef and credentials are mutually exclusive"
		return
	}
	sessionRequest := externalprovider.SessionRequest{
		Endpoint: request.Endpoint, CredentialRef: strings.TrimSpace(request.CredentialRef), ReadOnly: request.ReadOnly,
		InsecureHTTPConfirmed: request.InsecureHTTPConfirmed, Options: request.Options,
	}
	if err := registry.ValidateSessionRequest(c.Request.Context(), request.Provider, sessionRequest); err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	credentialRef := strings.TrimSpace(request.CredentialRef)
	issuedRef := ""
	if len(request.Credentials) > 0 {
		var err error
		issuedRef, err = fileBrowserProviderCredentialVault.Issue(request.Provider, request.Credentials)
		if err != nil {
			ret.Code = fileBrowserProviderErrorCode(err)
			ret.Msg = err.Error()
			return
		}
		credentialRef = issuedRef
		defer fileBrowserProviderCredentialVault.Revoke(issuedRef)
	}
	sessionRequest.CredentialRef = credentialRef
	session, err := registry.OpenSession(c.Request.Context(), request.Provider, sessionRequest)
	if err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = sForgeFileBrowserProviderSessionResponse{
		Provider:   request.Provider,
		Session:    session.ID(),
		ReadOnly:   request.ReadOnly,
		Descriptor: provider.Descriptor(),
	}
}

func closeFileBrowserProviderSession(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	var request sForgeFileBrowserProviderSessionCloseRequest
	if !decodeFileBrowserRequest(c, ret, &request) {
		return
	}
	if request.Provider == "" || request.Session == "" {
		ret.Code = http.StatusBadRequest
		ret.Msg = fileprovider.ErrInvalidProviderRequest.Error()
		return
	}
	if err := newFileBrowserProviderRegistry().CloseSession(request.Provider, request.Session); err != nil {
		ret.Code = fileBrowserProviderErrorCode(err)
		ret.Msg = err.Error()
		return
	}
	ret.Data = map[string]any{"provider": request.Provider, "session": request.Session, "closed": true}
}

func listFileBrowserProviderDescriptors(c *gin.Context) {
	ret := gulu.Ret.NewResult()
	defer c.JSON(http.StatusOK, ret)
	if !requireLocalFileBrowser(c, ret) {
		return
	}
	ret.Data = newFileBrowserProviderRegistry().Descriptors()
}

// resolveProviderLocator converts an opaque browser locator to the provider
// resource reference required by the registry. A token is never accepted
// without matching provider/session/resource identity fields.
func resolveProviderLocator(registry *fileprovider.ProviderRegistry, locator providerResourceLocator) (externalprovider.ResourceRef, error) {
	root, err := locator.rootRef()
	if err != nil {
		return externalprovider.ResourceRef{}, err
	}
	if !locator.hasToken() {
		return root, nil
	}
	return registry.ResolveResourceAddress(locator.Provider, locator.Session, locator.Resource, locator.Token)
}

func decodeProviderJSON(c *gin.Context, target any) error {
	decoder := json.NewDecoder(c.Request.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var trailing any
	err := decoder.Decode(&trailing)
	if errors.Is(err, io.EOF) {
		return nil
	}
	return fileprovider.ErrInvalidProviderRequest
}
