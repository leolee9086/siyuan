// Package everythingefu contains the Everything file-list (EFU) parser and
// paging rules. It does not open paths or decide which root is authorized.
package everythingefu

import (
	"context"
	"encoding/json"
	"io"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const ProviderID = "efu"

var (
	ErrInvalidRequest = externalprovider.ErrInvalidRequest
	ErrUnavailable    = externalprovider.ErrUnavailable
	ErrHeader         = externalprovider.ErrInvalidFormat
)

type SearchRequest struct {
	RootID string `json:"rootID"`
	Path   string `json:"path"`
	Offset int    `json:"offset"`
	Limit  int    `json:"limit"`
}

type AssetIssue = externalprovider.AssetIssue
type Asset = externalprovider.Asset
type Page = externalprovider.Page

type Source func(context.Context, SearchRequest) (io.ReadCloser, error)

// ProviderIDValue is the shared contract ID used by the registry without
// introducing a kernel dependency into this package.
func ProviderIDValue() externalprovider.ProviderID { return externalprovider.ProviderID(ProviderID) }

func (p *Provider) ID() externalprovider.ProviderID { return ProviderIDValue() }

func (p *Provider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID: ProviderIDValue(), DisplayName: "Everything EFU file list", Kind: externalprovider.ProviderKindCatalog,
		SessionMode: externalprovider.SessionModeNone,
		Capabilities: []string{externalprovider.CapabilitySearch, externalprovider.CapabilityPaging, externalprovider.CapabilityIssues},
	}
}

// SearchPayload implements externalprovider.Provider. The provider-specific
// request remains private to this package; the registry passes the original
// JSON payload without field-by-field translation.
func (p *Provider) SearchPayload(ctx context.Context, payload json.RawMessage) (Page, error) {
	var request SearchRequest
	if len(payload) == 0 || json.Unmarshal(payload, &request) != nil {
		return Page{}, ErrInvalidRequest
	}
	return p.Search(ctx, request)
}

func NormalizePage(offset, limit int) (int, int, error) {
	if offset < 0 || limit < 0 {
		return 0, 0, ErrInvalidRequest
	}
	if limit == 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}
	return offset, limit, nil
}
