package windowssmbmount

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"sort"
	"strings"
	"sync"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type session struct {
	mu          sync.RWMutex
	id          externalprovider.SessionID
	providerID  externalprovider.ProviderID
	readOnly    bool
	closed      bool
	resources   []mountSpec
	byID        map[externalprovider.ResourceID]mountSpec
	fileSystems FileSystemFactory
}

func (p *Provider) ValidateSessionRequest(request externalprovider.SessionRequest) error {
	if p == nil || p.discoverer == nil || p.fileSystems == nil || strings.TrimSpace(request.CredentialRef) != "" ||
		(len(request.Options) > 0 && string(request.Options) != "null") {
		return externalprovider.ErrInvalidRequest
	}
	if strings.TrimSpace(request.Endpoint) != "" && !strings.EqualFold(strings.TrimSpace(request.Endpoint), "mapped") {
		return ErrInvalidEndpoint
	}
	return nil
}

func (p *Provider) OpenSession(ctx context.Context, request externalprovider.SessionRequest) (externalprovider.Session, error) {
	if err := p.ValidateSessionRequest(request); err != nil {
		return nil, err
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	mounts, err := p.discoverer.Discover(ctx)
	if err != nil {
		return nil, mapSystemError(err)
	}
	resources, err := normalizeMounts(mounts)
	if err != nil {
		return nil, err
	}
	if len(resources) == 0 {
		return nil, ErrNoMappedShares
	}
	id, err := newSessionID()
	if err != nil {
		return nil, err
	}
	byID := make(map[externalprovider.ResourceID]mountSpec, len(resources))
	for _, spec := range resources {
		byID[spec.id] = spec
	}
	return &session{
		id: externalprovider.SessionID(id), providerID: p.ID(), readOnly: request.ReadOnly,
		resources: resources, byID: byID, fileSystems: p.fileSystems,
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
	offset, err := decodeCursor(request.Cursor)
	if err != nil {
		return externalprovider.ResourcePage{}, err
	}
	s.mu.RLock()
	resources := append([]mountSpec(nil), s.resources...)
	s.mu.RUnlock()
	if offset > len(resources) {
		return externalprovider.ResourcePage{}, externalprovider.ErrInvalidRequest
	}
	end := offset + limit
	if end > len(resources) {
		end = len(resources)
	}
	descriptors := make([]externalprovider.ResourceDescriptor, 0, end-offset)
	for _, spec := range resources[offset:end] {
		descriptors = append(descriptors, s.resourceDescriptor(spec))
	}
	page := externalprovider.ResourcePage{
		Resources: descriptors, Total: intPtr(len(resources)), Limit: limit, HasMore: end < len(resources),
	}
	if page.HasMore {
		page.NextCursor = encodeCursor(end)
	}
	return page, nil
}

func (s *session) OpenResource(ctx context.Context, ref externalprovider.ResourceRef) (externalprovider.Resource, error) {
	if err := s.check(ctx); err != nil {
		return nil, err
	}
	if ref.Provider != s.providerID || ref.Session != s.id {
		return nil, externalprovider.ErrInvalidRequest
	}
	s.mu.RLock()
	spec, ok := s.byID[ref.Resource]
	s.mu.RUnlock()
	if !ok {
		return nil, externalprovider.ErrNotFound
	}
	if _, err := normalizeRelativePath(ref.Path); err != nil {
		return nil, err
	}
	return &resource{
		session: s, spec: spec,
		ref:   externalprovider.ResourceRef{Provider: s.providerID, Session: s.id, Resource: spec.id},
		files: s.fileSystems(spec.root),
	}, nil
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

func (s *session) resourceDescriptor(spec mountSpec) externalprovider.ResourceDescriptor {
	ref := externalprovider.ResourceRef{Provider: s.providerID, Session: s.id, Resource: spec.id}
	r := &resource{session: s, spec: spec, ref: ref, files: s.fileSystems(spec.root)}
	aliases := append([]externalprovider.ResourceAlias(nil), spec.aliases...)
	sort.Slice(aliases, func(left, right int) bool { return aliases[left].Label < aliases[right].Label })
	return externalprovider.ResourceDescriptor{
		ID: spec.id, Name: spec.share, Kind: externalprovider.ProviderKindFileShare, ReadOnly: s.readOnly,
		Capabilities: r.capabilities(), Source: sourceDescriptor(spec.host), Aliases: aliases, Ref: ref,
	}
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

var _ externalprovider.SessionProvider = (*Provider)(nil)
