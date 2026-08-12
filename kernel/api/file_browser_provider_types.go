package api

import (
	"encoding/json"
	"strings"

	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type sForgeFileBrowserProviderSessionRequest struct {
	Provider              fileprovider.ProviderID `json:"provider"`
	Endpoint              string                  `json:"endpoint,omitempty"`
	CredentialRef         string                  `json:"credentialRef,omitempty"`
	Credentials           json.RawMessage         `json:"credentials,omitempty"`
	Options               json.RawMessage         `json:"options,omitempty"`
	ReadOnly              bool                    `json:"readOnly,omitempty"`
	InsecureHTTPConfirmed bool                    `json:"insecureHTTPConfirmed,omitempty"`
}

type sForgeFileBrowserProviderSessionResponse struct {
	Provider   fileprovider.ProviderID     `json:"provider"`
	Session    externalprovider.SessionID  `json:"session"`
	ReadOnly   bool                        `json:"readOnly"`
	Descriptor externalprovider.Descriptor `json:"descriptor"`
}

type sForgeFileBrowserProviderSessionCloseRequest struct {
	Provider fileprovider.ProviderID    `json:"provider"`
	Session  externalprovider.SessionID `json:"session"`
}

type sForgeFileBrowserProviderResourceRequest struct {
	Provider fileprovider.ProviderID      `json:"provider"`
	Session  externalprovider.SessionID   `json:"session"`
	Page     externalprovider.PageRequest `json:"page"`
}

// providerResourceLocator identifies a resource root without exposing its
// provider-owned physical locator.
type providerResourceLocator struct {
	Provider fileprovider.ProviderID     `json:"provider"`
	Session  externalprovider.SessionID  `json:"session"`
	Resource externalprovider.ResourceID `json:"resource"`
	Token    string                      `json:"token,omitempty"`
}

type sForgeFileBrowserProviderListRequest struct {
	providerResourceLocator
	Page             externalprovider.PageRequest `json:"page"`
	Recursive        bool                         `json:"recursive,omitempty"`
	Sort             []externalprovider.SortTerm  `json:"sort,omitempty"`
	IncludeMetadata  bool                         `json:"includeMetadata,omitempty"`
	DirectoriesFirst bool                         `json:"directoriesFirst,omitempty"`
}

type sForgeFileBrowserProviderStatRequest struct {
	providerResourceLocator
	IncludeMetadata bool                           `json:"includeMetadata,omitempty"`
	Preconditions   externalprovider.Preconditions `json:"preconditions,omitempty"`
}

type sForgeFileBrowserProviderOpenRequest struct {
	providerResourceLocator
	Range         *externalprovider.ByteRange    `json:"range,omitempty"`
	Preconditions externalprovider.Preconditions `json:"preconditions,omitempty"`
}

type sForgeFileBrowserProviderCreateRequest struct {
	providerResourceLocator
	Name          string                         `json:"name"`
	Kind          externalprovider.EntryKind     `json:"kind"`
	MediaType     string                         `json:"mediaType,omitempty"`
	Metadata      map[string]string              `json:"metadata,omitempty"`
	Size          int64                          `json:"size"`
	Preconditions externalprovider.Preconditions `json:"preconditions,omitempty"`
}

type sForgeFileBrowserProviderUpdateRequest struct {
	providerResourceLocator
	NewName       string                         `json:"newName,omitempty"`
	MediaType     string                         `json:"mediaType,omitempty"`
	Metadata      map[string]string              `json:"metadata,omitempty"`
	Size          int64                          `json:"size"`
	Preconditions externalprovider.Preconditions `json:"preconditions,omitempty"`
}

type sForgeFileBrowserProviderDeleteRequest struct {
	Targets       []providerResourceLocator      `json:"targets"`
	Recursive     bool                           `json:"recursive,omitempty"`
	Preconditions externalprovider.Preconditions `json:"preconditions,omitempty"`
}

type sForgeFileBrowserProviderTransferRequest struct {
	Source        providerResourceLocator        `json:"source"`
	Destination   providerResourceLocator        `json:"destination"`
	Overwrite     bool                           `json:"overwrite,omitempty"`
	Preconditions externalprovider.Preconditions `json:"preconditions,omitempty"`
}

func (l providerResourceLocator) rootRef() (externalprovider.ResourceRef, error) {
	ref := externalprovider.ResourceRef{Provider: l.Provider, Session: l.Session, Resource: l.Resource}
	if strings.TrimSpace(string(l.Provider)) == "" || strings.TrimSpace(string(l.Session)) == "" || strings.TrimSpace(string(l.Resource)) == "" {
		return externalprovider.ResourceRef{}, fileprovider.ErrInvalidProviderRequest
	}
	return ref, nil
}

func (l providerResourceLocator) hasToken() bool {
	return strings.TrimSpace(l.Token) != ""
}

type sForgeFileBrowserProviderMutationResponse struct {
	Operation    string                             `json:"operation"`
	Count        int                                `json:"count"`
	Entries      []externalprovider.Entry           `json:"entries,omitempty"`
	OperationRef *externalprovider.OperationRef     `json:"operationRef,omitempty"`
	Failures     []externalprovider.MutationFailure `json:"failures,omitempty"`
	Revision     externalprovider.Revision          `json:"revision,omitempty"`
}

func publicProviderMutation(result externalprovider.MutationResult) sForgeFileBrowserProviderMutationResponse {
	return sForgeFileBrowserProviderMutationResponse{
		Operation:    result.Operation,
		Count:        result.Count,
		Entries:      result.Entries,
		OperationRef: result.OperationRef,
		Failures:     result.Failures,
		Revision:     result.Revision,
	}
}
