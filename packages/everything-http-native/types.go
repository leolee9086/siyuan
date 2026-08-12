// Package everythinghttp is the native Go domain package for Everything HTTP.
// The browser-facing TypeScript client remains in packages/everything-client-http.
package everythinghttp

import (
	"context"
	"encoding/json"
	"net/http"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const ProviderID = "everything-http"

var (
	ErrInvalidRequest = externalprovider.ErrInvalidRequest
	ErrUnavailable    = externalprovider.ErrUnavailable
	ErrResponse       = externalprovider.ErrResponse
)

type SearchRequest struct {
	Host                   string `json:"host"`
	Port                   int    `json:"port"`
	Search                 string `json:"search"`
	Offset                 int    `json:"offset"`
	Limit                  int    `json:"limit"`
	Sort                   string `json:"sort"`
	ShowPathColumn         *bool  `json:"showPathColumn,omitempty"`
	ShowSizeColumn         *bool  `json:"showSizeColumn,omitempty"`
	ShowDateModifiedColumn *bool  `json:"showDateModifiedColumn,omitempty"`
	ShowDateCreatedColumn  *bool  `json:"showDateCreatedColumn,omitempty"`
	Count                  int    `json:"count,omitempty"`
}

type AssetIssue = externalprovider.AssetIssue
type Asset = externalprovider.Asset
type Page = externalprovider.Page

type Provider struct {
	client *http.Client
}

func NewProvider(client *http.Client) *Provider {
	if client == nil {
		client = http.DefaultClient
	}
	return &Provider{client: client}
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

func ProviderIDValue() externalprovider.ProviderID { return externalprovider.ProviderID(ProviderID) }

func (p *Provider) ID() externalprovider.ProviderID { return ProviderIDValue() }

func (p *Provider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID: ProviderIDValue(), DisplayName: "Everything HTTP", Kind: externalprovider.ProviderKindCatalog,
		SessionMode: externalprovider.SessionModeNone,
		Capabilities: []string{externalprovider.CapabilitySearch, externalprovider.CapabilityPaging, externalprovider.CapabilityIssues, externalprovider.CapabilityHealth},
	}
}

// SearchPayload implements the HTTP envelope boundary without exposing
// provider-specific request fields to the kernel.
func (p *Provider) SearchPayload(ctx context.Context, payload json.RawMessage) (Page, error) {
	var request SearchRequest
	if len(payload) == 0 || json.Unmarshal(payload, &request) != nil {
		return Page{}, ErrInvalidRequest
	}
	return Search(ctx, request, p.client)
}

func (p *Provider) HealthPayload(ctx context.Context, payload json.RawMessage) (externalprovider.HealthStatus, error) {
	var request SearchRequest
	if len(payload) > 0 && json.Unmarshal(payload, &request) != nil {
		return externalprovider.HealthStatus{}, ErrInvalidRequest
	}
	request.Limit = 1
	request.Count = 1
	if _, err := Search(ctx, request, p.client); err != nil {
		return externalprovider.HealthStatus{Available: false, Message: err.Error()}, err
	}
	return externalprovider.HealthStatus{Available: true}, nil
}
