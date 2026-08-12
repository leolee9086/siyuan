package synologyfilestation

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"net/url"
	"sort"
	"strings"
	"sync"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type shareResource struct {
	id       externalprovider.ResourceID
	path     string
	name     string
	readOnly bool
}

type session struct {
	mu        sync.RWMutex
	id        externalprovider.SessionID
	sid       string
	client    Client
	provider  *Provider
	resources []shareResource
	byID      map[externalprovider.ResourceID]shareResource
	readOnly  bool
	closed    bool
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
	endpoint := strings.TrimSpace(request.Endpoint)
	if endpoint == "" {
		endpoint = strings.TrimSpace(p.config.Endpoint)
	}
	if endpoint == "" {
		return nil, ErrInvalidEndpoint
	}
	return validateEndpoint(endpoint, p.config.AllowInsecureHTTP || request.InsecureHTTPConfirmed)
}

func (p *Provider) OpenSession(ctx context.Context, request externalprovider.SessionRequest) (externalprovider.Session, error) {
	if p == nil {
		return nil, externalprovider.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	parsed, err := p.sessionEndpoint(request)
	if err != nil {
		return nil, err
	}
	credentials := p.config.Credentials
	if strings.TrimSpace(request.CredentialRef) != "" {
		if p.config.ResolveCredential == nil {
			return nil, externalprovider.ErrInvalidRequest
		}
		credentials, err = p.config.ResolveCredential(ctx, request.CredentialRef)
		if err != nil {
			return nil, err
		}
	}
	if strings.TrimSpace(credentials.Account) == "" {
		return nil, externalprovider.ErrInvalidRequest
	}
	client, err := p.clientFactory(p.config.HTTPClient, parsed.String())
	if err != nil {
		return nil, err
	}
	sid, err := client.Login(ctx, credentials)
	if err != nil {
		return nil, mapAPIError(err)
	}
	if strings.TrimSpace(sid) == "" {
		_ = client.Logout(context.Background(), sid)
		return nil, externalprovider.ErrResponse
	}
	resources, err := p.resolveResources(ctx, client, sid, parsed)
	if err != nil {
		_ = client.Logout(context.Background(), sid)
		return nil, mapAPIError(err)
	}
	id, err := newSessionID()
	if err != nil {
		_ = client.Logout(context.Background(), sid)
		return nil, err
	}
	byID := make(map[externalprovider.ResourceID]shareResource, len(resources))
	for _, resource := range resources {
		byID[resource.id] = resource
	}
	return &session{
		id:        externalprovider.SessionID(id),
		sid:       sid,
		client:    client,
		provider:  p,
		resources: resources,
		byID:      byID,
		readOnly:  request.ReadOnly,
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
	resources := append([]shareResource(nil), s.resources...)
	s.mu.RUnlock()
	if offset > len(resources) {
		return externalprovider.ResourcePage{}, externalprovider.ErrInvalidRequest
	}
	end := offset + limit
	if end > len(resources) {
		end = len(resources)
	}
	pageResources := make([]externalprovider.ResourceDescriptor, 0, end-offset)
	for _, spec := range resources[offset:end] {
		pageResources = append(pageResources, s.resourceDescriptor(spec))
	}
	hasMore := end < len(resources)
	page := externalprovider.ResourcePage{
		Resources: pageResources,
		Total:     intPtr(len(resources)),
		Limit:     limit,
		HasMore:   hasMore,
	}
	if hasMore {
		page.NextCursor = encodeCursor(end)
	}
	if err := externalprovider.ValidateResourcePage(page); err != nil {
		return externalprovider.ResourcePage{}, err
	}
	return page, nil
}

func (s *session) OpenResource(ctx context.Context, ref externalprovider.ResourceRef) (externalprovider.Resource, error) {
	if err := s.check(ctx); err != nil {
		return nil, err
	}
	if ref.Provider != s.provider.ID() || ref.Session != s.id {
		return nil, externalprovider.ErrInvalidRequest
	}
	spec, ok := s.resourceByID(ref.Resource)
	if !ok {
		return nil, externalprovider.ErrNotFound
	}
	_, err := normalizeRelativePath(ref.Path)
	if err != nil {
		return nil, err
	}
	return s.newResource(spec, externalprovider.ResourceRef{
		Provider: s.provider.ID(),
		Session:  s.id,
		Resource: spec.id,
		// A Resource represents the share root. The requested child path is
		// validated above and is carried only by operation requests.
		Path: "",
	}), nil
}

func (s *session) Close() error {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	sid := s.sid
	client := s.client
	s.mu.Unlock()
	if s.provider != nil {
		s.provider.removeOperations(s)
	}
	if client == nil || sid == "" {
		return nil
	}
	return mapAPIError(client.Logout(context.Background(), sid))
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

func (s *session) credentialsSnapshot() (string, Client, error) {
	if s == nil {
		return "", nil, ErrClosed
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.closed {
		return "", nil, ErrClosed
	}
	return s.sid, s.client, nil
}

func (s *session) resourceByID(id externalprovider.ResourceID) (shareResource, bool) {
	if s == nil || id == "" {
		return shareResource{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	spec, ok := s.byID[id]
	return spec, ok
}

func (s *session) newResource(spec shareResource, ref externalprovider.ResourceRef) *resource {
	return &resource{
		session:  s,
		ref:      ref,
		rootPath: spec.path,
		rootName: spec.name,
	}
}

func (s *session) resourceDescriptor(spec shareResource) externalprovider.ResourceDescriptor {
	ref := externalprovider.ResourceRef{Provider: s.provider.ID(), Session: s.id, Resource: spec.id}
	r := s.newResource(spec, ref)
	sourceName := "Synology"
	if endpoint := s.provider.config.Endpoint; endpoint != "" {
		if parsed, err := url.Parse(endpoint); err == nil && parsed.Hostname() != "" {
			sourceName = parsed.Hostname()
		}
	}
	return externalprovider.ResourceDescriptor{
		ID:           spec.id,
		Name:         spec.name,
		Kind:         externalprovider.ProviderKindFileShare,
		ReadOnly:     s.readOnly,
		Capabilities: r.capabilities(),
		Source:       externalprovider.SourceDescriptor{Name: sourceName, Kind: "synology-endpoint"},
		Ref:          ref,
	}
}

func (p *Provider) resolveResources(ctx context.Context, client Client, sid string, endpoint *url.URL) ([]shareResource, error) {
	if p == nil || client == nil || strings.TrimSpace(sid) == "" {
		return nil, externalprovider.ErrInvalidRequest
	}
	if p.config.RootPath != "" && len(p.config.RootPaths) > 0 {
		return nil, externalprovider.ErrInvalidRequest
	}
	if p.config.RootPath != "" {
		path, err := normalizeRootPath(p.config.RootPath)
		if err != nil {
			return nil, err
		}
		return []shareResource{{id: RootResourceID, path: path, name: resourceName(endpoint, path)}}, nil
	}
	if len(p.config.RootPaths) > 0 {
		resources := make([]shareResource, 0, len(p.config.RootPaths))
		seen := make(map[string]struct{}, len(p.config.RootPaths))
		for _, configuredPath := range p.config.RootPaths {
			if strings.TrimSpace(configuredPath) == "" {
				return nil, externalprovider.ErrInvalidRequest
			}
			path, err := normalizeRootPath(configuredPath)
			if err != nil {
				return nil, err
			}
			if _, exists := seen[path]; exists {
				return nil, externalprovider.ErrInvalidRequest
			}
			seen[path] = struct{}{}
			resources = append(resources, shareResource{id: resourceIDForPath(path), path: path, name: pathResourceName(path, endpoint)})
		}
		return validateResourceSet(resources)
	}
	shares, err := client.ListShares(ctx, sid)
	if err != nil {
		return nil, err
	}
	resources := make([]shareResource, 0, len(shares))
	seen := make(map[string]struct{}, len(shares))
	for _, share := range shares {
		path, err := normalizeRootPath(share.Path)
		if err != nil || path == "/" {
			return nil, externalprovider.ErrResponse
		}
		name := strings.TrimSpace(share.Name)
		if name == "" {
			name = pathBase(path)
		}
		if externalprovider.ValidateName(name) != nil {
			return nil, externalprovider.ErrResponse
		}
		if _, exists := seen[path]; exists {
			return nil, externalprovider.ErrResponse
		}
		seen[path] = struct{}{}
		resources = append(resources, shareResource{id: resourceIDForPath(path), path: path, name: name})
	}
	return validateResourceSet(resources)
}

func validateResourceSet(resources []shareResource) ([]shareResource, error) {
	seenIDs := make(map[externalprovider.ResourceID]struct{}, len(resources))
	for index := range resources {
		resource := &resources[index]
		if resource.id == "" || strings.TrimSpace(resource.name) == "" || resource.path == "" {
			return nil, externalprovider.ErrResponse
		}
		if _, exists := seenIDs[resource.id]; exists {
			return nil, externalprovider.ErrResponse
		}
		seenIDs[resource.id] = struct{}{}
	}
	sort.SliceStable(resources, func(left, right int) bool {
		leftName := strings.ToLower(resources[left].name)
		rightName := strings.ToLower(resources[right].name)
		if leftName == rightName {
			return resources[left].path < resources[right].path
		}
		return leftName < rightName
	})
	return resources, nil
}

func pathResourceName(path string, endpoint *url.URL) string {
	name := pathBase(path)
	if name != "." && name != "/" && name != "" {
		return name
	}
	return resourceName(endpoint, path)
}

func resourceIDForPath(path string) externalprovider.ResourceID {
	digest := sha256.Sum256([]byte(path))
	return externalprovider.ResourceID("share-" + base64.RawURLEncoding.EncodeToString(digest[:12]))
}

func (p *Provider) registerOperation(remote Operation, s *session) (externalprovider.OperationRef, error) {
	if strings.TrimSpace(remote.ID) == "" || strings.TrimSpace(remote.API) == "" || remote.Version <= 0 || s == nil {
		return externalprovider.OperationRef{}, externalprovider.ErrResponse
	}
	id, err := newSessionID()
	if err != nil {
		return externalprovider.OperationRef{}, err
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.operations == nil {
		p.operations = make(map[string]operationRecord)
	}
	if _, exists := p.operations[id]; exists {
		return externalprovider.OperationRef{}, externalprovider.ErrResponse
	}
	p.operations[id] = operationRecord{remote: remote, session: s}
	return externalprovider.OperationRef{ID: id}, nil
}

func (p *Provider) removeOperations(s *session) {
	if p == nil || s == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for id, operation := range p.operations {
		if operation.session == s {
			delete(p.operations, id)
		}
	}
}

func (p *Provider) Operation(ctx context.Context, ref externalprovider.OperationRef) (externalprovider.OperationStatus, error) {
	if p == nil || strings.TrimSpace(ref.ID) == "" {
		return externalprovider.OperationStatus{}, externalprovider.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return externalprovider.OperationStatus{}, err
	}
	p.mu.Lock()
	operation, ok := p.operations[ref.ID]
	p.mu.Unlock()
	if !ok || operation.session == nil {
		return externalprovider.OperationStatus{}, externalprovider.ErrNotFound
	}
	sid, client, err := operation.session.credentialsSnapshot()
	if err != nil {
		return externalprovider.OperationStatus{}, err
	}
	status, err := client.Task(ctx, sid, operation.remote)
	if err != nil {
		return externalprovider.OperationStatus{}, mapAPIError(err)
	}
	if status.ID != operation.remote.ID || status.Progress < 0 || status.Progress > 100 {
		return externalprovider.OperationStatus{}, externalprovider.ErrResponse
	}
	return externalprovider.OperationStatus{Ref: ref, State: status.State, Progress: status.Progress, Message: status.Message}, nil
}

func resourceName(endpoint *url.URL, rootPath string) string {
	if rootPath != "/" {
		value := strings.Trim(pathBase(rootPath), "/")
		if value != "" && value != "." {
			return value
		}
	}
	if endpoint != nil && endpoint.Host != "" {
		return endpoint.Host
	}
	return RootResourceID
}

func pathBase(value string) string {
	value = strings.TrimRight(value, "/")
	if value == "" {
		return "/"
	}
	index := strings.LastIndexByte(value, '/')
	if index < 0 {
		return value
	}
	return value[index+1:]
}

func normalizeRootPath(value string) (string, error) {
	value = strings.TrimSpace(strings.ReplaceAll(value, "\\", "/"))
	if value == "" {
		return "/", nil
	}
	if !strings.HasPrefix(value, "/") || strings.IndexByte(value, 0) >= 0 {
		return "", externalprovider.ErrInvalidRequest
	}
	parts := strings.Split(value, "/")
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		switch part {
		case "", ".":
			continue
		case "..":
			return "", externalprovider.ErrInvalidRequest
		default:
			clean = append(clean, part)
		}
	}
	if len(clean) == 0 {
		return "/", nil
	}
	return "/" + strings.Join(clean, "/"), nil
}

func normalizeRelativePath(value string) (string, error) {
	if strings.IndexByte(value, 0) >= 0 || strings.HasPrefix(value, "/") || strings.HasPrefix(value, "\\") {
		return "", externalprovider.ErrInvalidRequest
	}
	value = strings.ReplaceAll(value, "\\", "/")
	parts := strings.Split(value, "/")
	clean := make([]string, 0, len(parts))
	for _, part := range parts {
		switch part {
		case "", ".":
			continue
		case "..":
			return "", externalprovider.ErrInvalidRequest
		default:
			clean = append(clean, part)
		}
	}
	return strings.Join(clean, "/"), nil
}

func relativeRemotePath(root, remote string) (string, error) {
	remote = strings.TrimSpace(strings.ReplaceAll(remote, "\\", "/"))
	if remote == "" {
		return "", externalprovider.ErrResponse
	}
	if !strings.HasPrefix(remote, "/") {
		return "", externalprovider.ErrResponse
	}
	root = strings.TrimRight(root, "/")
	if root == "" {
		root = "/"
	}
	if remote == root || (root == "/" && remote == "/") {
		return "", nil
	}
	prefix := root
	if prefix != "/" {
		prefix += "/"
	} else {
		prefix = "/"
	}
	if !strings.HasPrefix(remote, prefix) {
		return "", externalprovider.ErrPermission
	}
	return normalizeRelativePath(strings.TrimPrefix(remote, prefix))
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
var _ externalprovider.HealthProvider = (*Provider)(nil)
var _ externalprovider.OperationProvider = (*Provider)(nil)
