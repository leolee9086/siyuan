package s3provider

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"net/url"
	"strings"
	"sync"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type session struct {
	mu         sync.RWMutex
	id         externalprovider.SessionID
	providerID externalprovider.ProviderID
	endpoint   *url.URL
	store      ObjectStore
	bucket     string
	readOnly   bool
	closed     bool
}

func (p *Provider) ValidateSessionRequest(request externalprovider.SessionRequest) error {
	_, _, err := p.sessionSettings(request)
	return err
}

func (p *Provider) sessionSettings(request externalprovider.SessionRequest) (*url.URL, Config, error) {
	if p == nil {
		return nil, Config{}, externalprovider.ErrInvalidRequest
	}
	endpoint := strings.TrimSpace(request.Endpoint)
	if endpoint == "" {
		endpoint = p.config.Endpoint
	}
	if endpoint == "" {
		return nil, Config{}, ErrInvalidEndpoint
	}
	options, err := decodeSessionOptions(request.Options)
	if err != nil {
		return nil, Config{}, err
	}
	config := p.config
	if options.Region != "" {
		config.Region = options.Region
	}
	if options.Bucket != "" {
		config.Bucket = options.Bucket
	}
	if options.PathStyle != nil {
		config.PathStyle = *options.PathStyle
	}
	config.AllowInsecureHTTP = p.config.AllowInsecureHTTP || request.InsecureHTTPConfirmed
	parsed, err := validateEndpoint(endpoint, config.AllowInsecureHTTP)
	if err != nil {
		return nil, Config{}, err
	}
	return parsed, config, nil
}

func (p *Provider) OpenSession(ctx context.Context, request externalprovider.SessionRequest) (externalprovider.Session, error) {
	if p == nil {
		return nil, externalprovider.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	endpoint := strings.TrimSpace(request.Endpoint)
	if endpoint == "" {
		endpoint = p.config.Endpoint
	}
	parsed, sessionConfig, err := p.sessionSettings(request)
	if err != nil {
		return nil, err
	}
	credentialsValue := p.config.Credentials
	if strings.TrimSpace(request.CredentialRef) != "" {
		if p.config.ResolveCredential == nil {
			return nil, externalprovider.ErrInvalidRequest
		}
		credentialsValue, err = p.config.ResolveCredential(ctx, request.CredentialRef)
		if err != nil {
			return nil, err
		}
	}
	bucket := sessionConfig.Bucket
	if bucket == "" {
		bucket = bucketFromEndpoint(parsed)
	}
	if bucket != "" && !validBucketName(bucket) {
		return nil, externalprovider.ErrInvalidRequest
	}
	store, err := p.storeFactory(ctx, endpoint, credentialsValue, sessionConfig)
	if err != nil {
		return nil, err
	}
	id, err := newSessionID()
	if err != nil {
		return nil, err
	}
	return &session{
		id: externalprovider.SessionID(id), providerID: p.ID(), endpoint: parsed,
		store: store, bucket: bucket, readOnly: request.ReadOnly,
	}, nil
}

func (s *session) ID() externalprovider.SessionID {
	if s == nil {
		return ""
	}
	return s.id
}

func (s *session) Resources(ctx context.Context, request externalprovider.PageRequest) (externalprovider.ResourcePage, error) {
	if err := externalprovider.ValidatePageRequest(request); err != nil {
		return externalprovider.ResourcePage{}, err
	}
	if err := s.check(ctx); err != nil {
		return externalprovider.ResourcePage{}, err
	}
	limit := request.Limit
	if limit == 0 {
		limit = DefaultPageLimit
	}
	if s.bucket != "" {
		if request.Cursor != "" {
			return externalprovider.ResourcePage{Resources: nil, Total: intPtr(1), Limit: limit}, nil
		}
		return externalprovider.ResourcePage{
			Resources: []externalprovider.ResourceDescriptor{s.resourceDescriptor(s.bucket)},
			Total:     intPtr(1),
			Limit:     limit,
		}, nil
	}
	page, err := s.store.ListBuckets(ctx, request.Cursor, limit)
	if err != nil {
		return externalprovider.ResourcePage{}, err
	}
	resources := make([]externalprovider.ResourceDescriptor, 0, len(page.Buckets))
	for _, bucket := range page.Buckets {
		if !validBucketName(bucket.Name) {
			return externalprovider.ResourcePage{}, externalprovider.ErrResponse
		}
		resources = append(resources, s.resourceDescriptor(bucket.Name))
	}
	return externalprovider.ResourcePage{Resources: resources, Limit: limit, NextCursor: page.NextCursor, HasMore: page.HasMore}, nil
}

func (s *session) OpenResource(ctx context.Context, ref externalprovider.ResourceRef) (externalprovider.Resource, error) {
	if err := s.check(ctx); err != nil {
		return nil, err
	}
	if ref.Provider != s.providerID || ref.Session != s.id || ref.Resource == "" || !validBucketName(string(ref.Resource)) {
		return nil, externalprovider.ErrInvalidRequest
	}
	if s.bucket != "" && string(ref.Resource) != s.bucket {
		return nil, externalprovider.ErrPermission
	}
	if _, err := normalizeKey(ref.Path); err != nil {
		return nil, err
	}
	return &resource{session: s, ref: externalprovider.ResourceRef{Provider: s.providerID, Session: s.id, Resource: ref.Resource}}, nil
}

func (s *session) Close() error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	s.closed = true
	s.mu.Unlock()
	return nil
}

func (s *session) check(ctx context.Context) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil {
		return ErrClosed
	}
	s.mu.RLock()
	closed := s.closed
	s.mu.RUnlock()
	if closed {
		return ErrClosed
	}
	return nil
}

func (s *session) resourceDescriptor(bucket string) externalprovider.ResourceDescriptor {
	r := &resource{session: s, ref: externalprovider.ResourceRef{Provider: s.providerID, Session: s.id, Resource: externalprovider.ResourceID(bucket)}}
	return externalprovider.ResourceDescriptor{
		ID: externalprovider.ResourceID(bucket), Name: bucket, Kind: externalprovider.ProviderKindObject,
		ReadOnly: s.readOnly, Capabilities: r.capabilities(),
		Source: externalprovider.SourceDescriptor{Name: s.endpoint.Host, Kind: "s3-endpoint"},
		Ref:    r.ref,
	}
}

func bucketFromEndpoint(endpoint *url.URL) string {
	if endpoint == nil {
		return ""
	}
	value := strings.Trim(endpoint.Path, "/")
	if value == "" {
		return ""
	}
	if strings.Contains(value, "/") {
		return ""
	}
	return value
}

func newSessionID() (string, error) {
	value := make([]byte, 18)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value), nil
}

func intPtr(value int) *int {
	return &value
}
