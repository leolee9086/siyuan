// Package synologyfilestation adapts DSM File Station's session-oriented HTTP
// API. A login SID remains inside the session; browser responses only contain
// opaque ResourceRef values and never expose the SID or physical path policy.
package synologyfilestation

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const (
	ProviderID       = "synology-file-station"
	RootResourceID   = "root"
	DefaultPageLimit = 200
	MaxListEntries   = 100000
)

type Credentials struct {
	Account  string `json:"account"`
	Password string `json:"password"`
}

// DecodeCredentials keeps DSM credential fields owned by this provider
// package; Kernel only passes an opaque credential payload to this decoder.
func DecodeCredentials(payload []byte) (Credentials, error) {
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var credentials Credentials
	if err := decoder.Decode(&credentials); err != nil || strings.TrimSpace(credentials.Account) == "" {
		return Credentials{}, externalprovider.ErrInvalidRequest
	}
	var trailing any
	if decoder.Decode(&trailing) == nil {
		return Credentials{}, externalprovider.ErrInvalidRequest
	}
	return credentials, nil
}

type CredentialResolver func(context.Context, string) (Credentials, error)

type FileInfo struct {
	Path      string
	Name      string
	Size      int64
	IsDir     bool
	Modified  time.Time
	Created   time.Time
	MediaType string
	ETag      string
}

type FilePage struct {
	Files      []FileInfo
	Total      int
	TotalKnown bool
}

// ShareInfo is a DSM File Station shared-folder resource visible to the
// authenticated session. Path is a provider-owned absolute DSM path; it is
// never sent to the browser as a filesystem address.
type ShareInfo struct {
	Name string
	Path string
}

type Operation struct {
	ID      string
	API     string
	Version int
}

type TaskStatus struct {
	ID       string
	State    externalprovider.OperationState
	Progress int
	Message  string
}

// Client isolates DSM request/response details from resource semantics and is
// intentionally context-aware so cancelled browser requests stop promptly.
type Client interface {
	Login(context.Context, Credentials) (string, error)
	Logout(context.Context, string) error
	ListShares(context.Context, string) ([]ShareInfo, error)
	List(context.Context, string, string, int, int, []externalprovider.SortTerm) (FilePage, error)
	Stat(context.Context, string, string) (FileInfo, error)
	Open(context.Context, string, string, *externalprovider.ByteRange) (io.ReadCloser, FileInfo, error)
	CreateFolder(context.Context, string, string, string) (FileInfo, error)
	Upload(context.Context, string, string, string, io.Reader, int64, string, bool) error
	Rename(context.Context, string, string, string) (FileInfo, error)
	Delete(context.Context, string, []string, bool) (Operation, error)
	CopyMove(context.Context, string, []string, string, bool, bool) (Operation, error)
	Task(context.Context, string, Operation) (TaskStatus, error)
}
type ClientFactory func(*http.Client, string) (Client, error)

type Config struct {
	Endpoint string
	// RootPath exposes one explicitly configured DSM path. When RootPath and
	// RootPaths are both empty, the provider discovers every share visible to
	// the logged-in account through list_share.
	RootPath string
	// RootPaths exposes several explicitly configured shares. Paths are
	// normalized and validated before a session is returned.
	RootPaths         []string
	HTTPClient        *http.Client
	AllowInsecureHTTP bool
	Credentials       Credentials
	ResolveCredential CredentialResolver
}

type Provider struct {
	config        Config
	clientFactory ClientFactory
	mu            sync.Mutex
	operations    map[string]operationRecord
}

type operationRecord struct {
	remote  Operation
	session *session
}

func NewProvider(config Config) (*Provider, error) {
	return NewProviderWithFactory(config, newHTTPClient)
}

func NewProviderWithFactory(config Config, factory ClientFactory) (*Provider, error) {
	if factory == nil {
		return nil, externalprovider.ErrInvalidRequest
	}
	if config.RootPath != "" && len(config.RootPaths) > 0 {
		return nil, externalprovider.ErrInvalidRequest
	}
	if config.RootPath != "" && strings.TrimSpace(config.RootPath) == "" {
		return nil, externalprovider.ErrInvalidRequest
	}
	for _, path := range config.RootPaths {
		if strings.TrimSpace(path) == "" {
			return nil, externalprovider.ErrInvalidRequest
		}
	}
	config.RootPaths = append([]string(nil), config.RootPaths...)
	if config.Endpoint != "" {
		if _, err := validateEndpoint(config.Endpoint, config.AllowInsecureHTTP); err != nil {
			return nil, err
		}
	}
	return &Provider{config: config, clientFactory: factory, operations: make(map[string]operationRecord)}, nil
}

func (p *Provider) ID() externalprovider.ProviderID { return externalprovider.ProviderID(ProviderID) }

func (p *Provider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID:           p.ID(),
		DisplayName:  "Synology File Station",
		Kind:         externalprovider.ProviderKindFileShare,
		SessionMode:  externalprovider.SessionModeConfigured,
		SessionLabel: "File Station 会话",
		SessionConfig: &externalprovider.SessionConfig{
			ReadOnly:          true,
			EndpointTransport: externalprovider.EndpointTransportHTTPSOrConfirmedPrivateHTTP,
			Fields: []externalprovider.SessionField{
				{
					Target: externalprovider.SessionFieldTargetEndpoint, Key: "endpoint", Label: "DSM 地址",
					Input: externalprovider.SessionFieldInputURL, Required: true,
					Placeholder: "https://nas.example.com:5001", Autocomplete: "url",
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "account", Label: "账户",
					Input: externalprovider.SessionFieldInputText, Required: true, Autocomplete: "username",
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "password", Label: "密码",
					Input: externalprovider.SessionFieldInputPassword, Autocomplete: "current-password",
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
			externalprovider.CapabilityPaging,
			externalprovider.CapabilityOperations,
			externalprovider.CapabilityHealth,
		},
	}
}
