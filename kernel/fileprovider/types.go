// Package fileprovider exposes external asset providers without weakening the
// root-relative file-browser contract.
package fileprovider

import "errors"

type ProviderID string

const (
	ProviderEverythingHTTP ProviderID = "everything-http"
	ProviderEFU            ProviderID = "efu"
)

var (
	ErrInvalidProviderRequest  = errors.New("external provider request is invalid")
	ErrProviderUnavailable     = errors.New("external provider is unavailable")
	ErrProviderResponse        = errors.New("external provider response is invalid")
	ErrEFUHeader               = errors.New("EFU header is invalid")
	ErrExternalAddressNotFound = errors.New("external asset address not found")
)

// SearchRequest contains only provider-specific fields. It is deliberately
// separate from filequery.SearchRequest so external paths cannot enter the
// authorized workspace/Agent root query.
type SearchRequest struct {
	Provider ProviderID `json:"provider"`
	Host     string     `json:"host,omitempty"`
	Port     int        `json:"port,omitempty"`
	Search   string     `json:"search,omitempty"`
	RootID   string     `json:"rootID,omitempty"`
	Path     string     `json:"path,omitempty"`
	Offset   int        `json:"offset,omitempty"`
	Limit    int        `json:"limit,omitempty"`
	Sort     string     `json:"sort,omitempty"`
}

// ExternalAssetAddress is the only address accepted by external content and
// thumbnail endpoints. The physical path never crosses the API boundary.
type ExternalAssetAddress struct {
	Provider ProviderID `json:"provider"`
	Token    string     `json:"token"`
	Name     string     `json:"name"`
}

type AssetIssue struct {
	Line    int    `json:"line"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

type Asset struct {
	ID        string                `json:"id"`
	Name      string                `json:"name"`
	Path      string                `json:"path"`
	Extension string                `json:"extension,omitempty"`
	Size      int64                 `json:"size"`
	Modified  int64                 `json:"modified"`
	Created   int64                 `json:"created"`
	Address   *ExternalAssetAddress `json:"address,omitempty"`
	Issues    []AssetIssue          `json:"issues,omitempty"`
}

type Page struct {
	Provider   ProviderID   `json:"provider"`
	Assets     []Asset      `json:"assets"`
	Issues     []AssetIssue `json:"issues,omitempty"`
	TotalCount int          `json:"totalCount"`
	Offset     int          `json:"offset"`
	Limit      int          `json:"limit"`
	HasMore    bool         `json:"hasMore"`
}

type AddressRecord struct {
	Provider ProviderID
	Token    string
	Name     string
	Path     string
}

func NormalizePage(offset, limit int) (int, int, error) {
	if offset < 0 || limit < 0 {
		return 0, 0, ErrInvalidProviderRequest
	}
	if limit == 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}
	return offset, limit, nil
}
