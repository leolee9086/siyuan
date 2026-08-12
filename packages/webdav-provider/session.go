package webdavprovider

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
	endpoint   *url.URL
	client     Client
	readOnly   bool
	closed     bool
	providerID externalprovider.ProviderID
}

func (p *Provider) ValidateSessionRequest(request externalprovider.SessionRequest) error {
	if len(request.Options) > 0 && string(request.Options) != "null" {
		return externalprovider.ErrInvalidRequest
	}
	_, err := p.sessionEndpoint(request)
	return err
}

func (p *Provider) sessionEndpoint(request externalprovider.SessionRequest) (*url.URL, error) {
	if p == nil {
		return nil, externalprovider.ErrInvalidRequest
	}
	return validateEndpoint(request.Endpoint, p.allowInsecureHTTP || request.InsecureHTTPConfirmed)
}

func (p *Provider) OpenSession(ctx context.Context, request externalprovider.SessionRequest) (externalprovider.Session, error) {
	if p == nil {
		return nil, externalprovider.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	endpoint, err := p.sessionEndpoint(request)
	if err != nil {
		return nil, err
	}
	credentials := Credentials{}
	if strings.TrimSpace(request.CredentialRef) != "" {
		if p.resolveCredential == nil {
			return nil, externalprovider.ErrInvalidRequest
		}
		credentials, err = p.resolveCredential(ctx, request.CredentialRef)
		if err != nil {
			return nil, err
		}
	}
	client, err := p.clientFactory(p.httpClient, endpoint.String(), credentials)
	if err != nil {
		return nil, unavailable(err)
	}
	id, err := newSessionID()
	if err != nil {
		return nil, err
	}
	return &session{
		id:         externalprovider.SessionID(id),
		endpoint:   endpoint,
		client:     client,
		readOnly:   request.ReadOnly,
		providerID: p.ID(),
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
		limit = 100
	}
	offset, err := decodeCursor(request.Cursor)
	if err != nil {
		return externalprovider.ResourcePage{}, err
	}
	resources := []externalprovider.ResourceDescriptor{}
	if offset == 0 && limit > 0 {
		resources = append(resources, s.resourceDescriptor())
	}
	next := ""
	if offset+len(resources) < 1 {
		next = ""
	}
	return externalprovider.ResourcePage{
		Resources:  resources,
		Total:      intPtr(1),
		Limit:      limit,
		NextCursor: next,
		HasMore:    false,
	}, nil
}

func (s *session) OpenResource(ctx context.Context, ref externalprovider.ResourceRef) (externalprovider.Resource, error) {
	if err := s.check(ctx); err != nil {
		return nil, err
	}
	if ref.Provider != s.providerID || ref.Session != s.id || ref.Resource != RootResourceID {
		return nil, externalprovider.ErrInvalidRequest
	}
	if _, err := normalizePath(ref.Path); err != nil {
		return nil, err
	}
	return &resource{session: s, ref: externalprovider.ResourceRef{
		Provider: s.providerID,
		Session:  s.id,
		Resource: RootResourceID,
		Path:     "",
	}}, nil
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

func (s *session) resourceDescriptor() externalprovider.ResourceDescriptor {
	sourceName := resourceName(s.endpoint)
	return externalprovider.ResourceDescriptor{
		ID:           RootResourceID,
		Name:         resourceName(s.endpoint),
		Kind:         externalprovider.ProviderKindFileShare,
		ReadOnly:     s.readOnly,
		Capabilities: (&resource{session: s, ref: externalprovider.ResourceRef{Provider: s.providerID, Session: s.id, Resource: RootResourceID}}).capabilities(),
		Source:       externalprovider.SourceDescriptor{Name: sourceName, Kind: "webdav-endpoint"},
		Ref:          externalprovider.ResourceRef{Provider: s.providerID, Session: s.id, Resource: RootResourceID},
	}
}

func resourceName(endpoint *url.URL) string {
	if endpoint == nil {
		return RootResourceID
	}
	if value := strings.Trim(endpoint.Path, "/"); value != "" {
		return value
	}
	return endpoint.Host
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
