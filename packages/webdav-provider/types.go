// Package webdavprovider adapts a WebDAV file service to the shared external
// provider contract. It keeps endpoint credentials and remote paths inside a
// session/resource object; callers only receive provider-owned references.
package webdavprovider

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const (
	ProviderID       = "webdav"
	RootResourceID   = "root"
	DefaultPageLimit = 200
	MaxListEntries   = 100000
)

type Credentials struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// DecodeCredentials keeps WebDAV credential fields in the adapter package.
func DecodeCredentials(payload []byte) (Credentials, error) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var credentials Credentials
	if err := decoder.Decode(&credentials); err != nil {
		return Credentials{}, externalprovider.ErrInvalidRequest
	}
	var trailing any
	if decoder.Decode(&trailing) == nil {
		return Credentials{}, externalprovider.ErrInvalidRequest
	}
	if credentials.Username == "" && credentials.Password != "" {
		return Credentials{}, externalprovider.ErrInvalidRequest
	}
	return credentials, nil
}

type CredentialResolver func(context.Context, string) (Credentials, error)

// Client is the small context-aware subset needed by the adapter. Keeping this
// seam separate makes protocol behavior testable without a live DAV server.
type Client interface {
	Stat(context.Context, string) (*FileInfo, error)
	ReadDir(context.Context, string, bool) ([]FileInfo, error)
	Open(context.Context, string) (io.ReadCloser, error)
	Create(context.Context, string) (io.WriteCloser, error)
	Mkdir(context.Context, string) error
	RemoveAll(context.Context, string) error
	Copy(context.Context, string, string, bool) error
	Move(context.Context, string, string, bool) error
}

type FileInfo struct {
	Path      string
	Size      int64
	ModTime   time.Time
	IsDir     bool
	MediaType string
	ETag      string
}

type ClientFactory func(httpClient *http.Client, endpoint string, credentials Credentials) (Client, error)

type Options struct {
	HTTPClient        *http.Client
	ResolveCredential CredentialResolver
	AllowInsecureHTTP bool
	ClientFactory     ClientFactory
}

type Provider struct {
	httpClient        *http.Client
	resolveCredential CredentialResolver
	allowInsecureHTTP bool
	clientFactory     ClientFactory
}

func NewProvider(client *http.Client, resolver CredentialResolver) *Provider {
	return NewProviderWithOptions(Options{HTTPClient: client, ResolveCredential: resolver})
}

func NewProviderWithOptions(options Options) *Provider {
	client := options.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	factory := options.ClientFactory
	if factory == nil {
		factory = newDAVClient
	}
	return &Provider{
		httpClient:        safeHTTPClient(client),
		resolveCredential: options.ResolveCredential,
		allowInsecureHTTP: options.AllowInsecureHTTP,
		clientFactory:     factory,
	}
}

func (p *Provider) ID() externalprovider.ProviderID {
	return externalprovider.ProviderID(ProviderID)
}

func (p *Provider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID:           p.ID(),
		DisplayName:  "WebDAV",
		Kind:         externalprovider.ProviderKindFileShare,
		SessionMode:  externalprovider.SessionModeConfigured,
		SessionLabel: "WebDAV 会话",
		SessionConfig: &externalprovider.SessionConfig{
			ReadOnly:          true,
			EndpointTransport: externalprovider.EndpointTransportHTTPSOrConfirmedPrivateHTTP,
			Fields: []externalprovider.SessionField{
				{
					Target: externalprovider.SessionFieldTargetEndpoint, Key: "endpoint", Label: "WebDAV 地址",
					Input: externalprovider.SessionFieldInputURL, Required: true,
					Placeholder: "https://dav.example.com/files", Autocomplete: "url",
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "username", Label: "用户名",
					Input: externalprovider.SessionFieldInputText, Autocomplete: "username",
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "password", Label: "密码",
					Input: externalprovider.SessionFieldInputPassword, RequiredWith: []string{"username"},
					Autocomplete: "current-password",
				},
			},
		},
		Capabilities: []string{
			externalprovider.CapabilityList,
			externalprovider.CapabilityStat,
			externalprovider.CapabilityOpen,
			externalprovider.CapabilityRead,
			externalprovider.CapabilityWrite,
			externalprovider.CapabilityCreate,
			externalprovider.CapabilityUpdate,
			externalprovider.CapabilityDelete,
			externalprovider.CapabilityCopy,
			externalprovider.CapabilityMove,
			externalprovider.CapabilityHealth,
			externalprovider.CapabilityPaging,
		},
	}
}
