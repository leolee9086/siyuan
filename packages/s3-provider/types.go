// Package s3provider adapts Amazon S3 compatible object stores, including
// MinIO, to the shared external provider contract. Buckets are resources and
// object keys are resource-relative paths; no local filesystem path is used.
package s3provider

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const (
	ProviderID       = "s3"
	DefaultPageLimit = 200
	MaxListEntries   = 100000
)

type Credentials struct {
	AccessKey    string `json:"accessKey"`
	SecretKey    string `json:"secretKey"`
	SessionToken string `json:"sessionToken"`
}

type SessionOptions struct {
	Region    string `json:"region,omitempty"`
	Bucket    string `json:"bucket,omitempty"`
	PathStyle *bool  `json:"pathStyle,omitempty"`
}

func decodeSessionOptions(payload json.RawMessage) (SessionOptions, error) {
	if len(payload) == 0 || string(payload) == "null" {
		return SessionOptions{}, nil
	}
	decoder := json.NewDecoder(bytes.NewReader(payload))
	decoder.DisallowUnknownFields()
	var options SessionOptions
	if err := decoder.Decode(&options); err != nil {
		return SessionOptions{}, externalprovider.ErrInvalidRequest
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return SessionOptions{}, externalprovider.ErrInvalidRequest
	}
	options.Region = strings.TrimSpace(options.Region)
	options.Bucket = strings.TrimSpace(options.Bucket)
	if options.Bucket != "" && !validBucketName(options.Bucket) {
		return SessionOptions{}, externalprovider.ErrInvalidRequest
	}
	return options, nil
}

// DecodeCredentials keeps S3 credential fields in the S3 adapter package.
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
	if (credentials.AccessKey == "") != (credentials.SecretKey == "") {
		return Credentials{}, externalprovider.ErrInvalidRequest
	}
	return credentials, nil
}

type CredentialResolver func(context.Context, string) (Credentials, error)

type Config struct {
	Endpoint          string
	Region            string
	Bucket            string
	PathStyle         bool
	AllowInsecureHTTP bool
	HTTPClient        *http.Client
	Credentials       Credentials
	ResolveCredential CredentialResolver
}

type BucketInfo struct {
	Name      string
	CreatedAt time.Time
}

type ObjectInfo struct {
	Key       string
	Size      int64
	Modified  time.Time
	ETag      string
	VersionID string
	MediaType string
	Metadata  map[string]string
	IsPrefix  bool
}

type BucketPage struct {
	Buckets    []BucketInfo
	NextCursor string
	HasMore    bool
}

type ObjectPage struct {
	Objects    []ObjectInfo
	Prefixes   []string
	NextCursor string
	HasMore    bool
}

type ObjectStore interface {
	ListBuckets(context.Context, string, int) (BucketPage, error)
	ListObjects(context.Context, string, string, string, string, int) (ObjectPage, error)
	StatObject(context.Context, string, string, externalprovider.Preconditions) (ObjectInfo, error)
	OpenObject(context.Context, string, string, *externalprovider.ByteRange, externalprovider.Preconditions) (io.ReadCloser, ObjectInfo, error)
	PutObject(context.Context, string, string, io.Reader, int64, string, map[string]string, externalprovider.Preconditions) (ObjectInfo, error)
	DeleteObject(context.Context, string, string, bool, externalprovider.Preconditions) error
	CopyObject(context.Context, string, string, string, string, bool, externalprovider.Preconditions) (ObjectInfo, error)
}

type StoreFactory func(context.Context, string, Credentials, Config) (ObjectStore, error)

type Provider struct {
	config       Config
	storeFactory StoreFactory
}

func NewProvider(config Config) (*Provider, error) {
	return NewProviderWithFactory(config, newAWSStore)
}

func NewProviderWithFactory(config Config, factory StoreFactory) (*Provider, error) {
	if factory == nil {
		return nil, externalprovider.ErrInvalidRequest
	}
	if config.Endpoint != "" {
		if _, err := validateEndpoint(config.Endpoint, config.AllowInsecureHTTP); err != nil {
			return nil, err
		}
	}
	if config.Bucket != "" && !validBucketName(config.Bucket) {
		return nil, externalprovider.ErrInvalidRequest
	}
	return &Provider{config: config, storeFactory: factory}, nil
}

func (p *Provider) ID() externalprovider.ProviderID {
	return externalprovider.ProviderID(ProviderID)
}

func (p *Provider) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID:           p.ID(),
		DisplayName:  "S3 compatible object store",
		Kind:         externalprovider.ProviderKindObject,
		SessionMode:  externalprovider.SessionModeConfigured,
		SessionLabel: "对象存储会话",
		SessionConfig: &externalprovider.SessionConfig{
			ReadOnly:          true,
			EndpointTransport: externalprovider.EndpointTransportHTTPSOrConfirmedPrivateHTTP,
			Fields: []externalprovider.SessionField{
				{
					Target: externalprovider.SessionFieldTargetEndpoint, Key: "endpoint", Label: "S3 地址",
					Input: externalprovider.SessionFieldInputURL, Required: true,
					Placeholder: "https://s3.example.com", Autocomplete: "url",
				},
				{
					Target: externalprovider.SessionFieldTargetOption, Key: "region", Label: "区域",
					Input: externalprovider.SessionFieldInputText, DefaultValue: "us-east-1",
					Placeholder: "us-east-1",
				},
				{
					Target: externalprovider.SessionFieldTargetOption, Key: "bucket", Label: "Bucket",
					Input: externalprovider.SessionFieldInputText, Placeholder: "留空以列出全部 Bucket",
				},
				{
					Target: externalprovider.SessionFieldTargetOption, Key: "pathStyle", Label: "使用 Path-style 地址",
					Input: externalprovider.SessionFieldInputCheckbox,
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "accessKey", Label: "Access Key",
					Input: externalprovider.SessionFieldInputText, RequiredWith: []string{"secretKey"},
					Autocomplete: "username",
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "secretKey", Label: "Secret Key",
					Input: externalprovider.SessionFieldInputPassword, RequiredWith: []string{"accessKey"},
					Autocomplete: "current-password",
				},
				{
					Target: externalprovider.SessionFieldTargetCredential, Key: "sessionToken", Label: "Session Token",
					Input:        externalprovider.SessionFieldInputPassword,
					RequiredWith: []string{"accessKey", "secretKey"}, Autocomplete: "off",
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
			externalprovider.CapabilityVersioning,
			externalprovider.CapabilityHealth,
		},
	}
}
