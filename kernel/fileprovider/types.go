// Package fileprovider contains the kernel-side adapter boundary for external
// asset providers. Provider query and parsing rules live in packages; this
// package owns authorization-facing adapters and opaque API addresses.
package fileprovider

import (
	"encoding/json"
	"errors"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type ProviderID = externalprovider.ProviderID

const (
	ProviderEverythingHTTP ProviderID = "everything-http"
	ProviderEFU            ProviderID = "efu"
	ProviderWindowsSMB     ProviderID = "windows-smb-mount"
)

var (
	ErrInvalidProviderRequest    = externalprovider.ErrInvalidRequest
	ErrProviderUnavailable       = externalprovider.ErrUnavailable
	ErrProviderResponse          = externalprovider.ErrResponse
	ErrEFUHeader                 = externalprovider.ErrInvalidFormat
	ErrExternalAddressNotFound   = errors.New("external asset address not found")
	ErrProviderNotRegistered     = errors.New("external provider adapter is not registered")
	ErrProviderAlreadyRegistered = errors.New("external provider adapter is already registered")
	ErrProviderCapabilityMissing = errors.New("external provider capability is not implemented")
	ErrProviderSessionExists     = errors.New("external provider session is already registered")
	ErrProviderSessionNotFound   = errors.New("external provider session is not registered")
)

type SearchRequest struct {
	Provider ProviderID      `json:"provider"`
	Payload  json.RawMessage `json:"request"`
}

type AssetIssue = externalprovider.AssetIssue
type ExternalAssetAddress = externalprovider.AssetAddress
type Asset = externalprovider.Asset
type Page = externalprovider.Page

type AddressRecord struct {
	Provider ProviderID
	Token    string
	Name     string
	Path     string
	Resource *externalprovider.ResourceRef
}
