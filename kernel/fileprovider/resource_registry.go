package fileprovider

import (
	"context"
	"strings"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type providerSessionKey struct {
	provider ProviderID
	session  externalprovider.SessionID
}

func sessionKey(provider ProviderID, session externalprovider.SessionID) providerSessionKey {
	return providerSessionKey{provider: provider, session: session}
}

// ValidateSessionRequest 在任何凭据解析或网络副作用之前调用 provider 自己的
// 请求校验。所有可建立 session 的 provider 都必须提供该边界。
func (r *ProviderRegistry) ValidateSessionRequest(ctx context.Context, providerID ProviderID, request externalprovider.SessionRequest) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if r == nil || providerID == "" {
		return ErrInvalidProviderRequest
	}
	provider, ok := r.Lookup(providerID)
	if !ok {
		return ErrProviderNotRegistered
	}
	factory, ok := provider.(externalprovider.SessionProvider)
	if !ok {
		return ErrProviderCapabilityMissing
	}
	return factory.ValidateSessionRequest(request)
}

// OpenSession 建立并登记一个 provider-owned 连接会话。Kernel 只保存会话
// 生命周期和 provider 归属，不解析 endpoint、sid、tree connect 或凭据。
func (r *ProviderRegistry) OpenSession(ctx context.Context, providerID ProviderID, request externalprovider.SessionRequest) (externalprovider.Session, error) {
	if err := r.ValidateSessionRequest(ctx, providerID, request); err != nil {
		return nil, err
	}
	provider, _ := r.Lookup(providerID)
	factory, ok := provider.(externalprovider.SessionProvider)
	if !ok {
		return nil, ErrProviderCapabilityMissing
	}
	session, err := factory.OpenSession(ctx, request)
	if err != nil {
		return nil, err
	}
	if session == nil || strings.TrimSpace(string(session.ID())) == "" {
		return nil, ErrProviderResponse
	}
	key := sessionKey(providerID, session.ID())
	r.mu.Lock()
	if r.sessions == nil {
		r.sessions = make(map[providerSessionKey]externalprovider.Session)
	}
	if _, exists := r.sessions[key]; exists {
		r.mu.Unlock()
		_ = session.Close()
		return nil, ErrProviderSessionExists
	}
	r.sessions[key] = session
	r.mu.Unlock()
	return session, nil
}

func (r *ProviderRegistry) LookupSession(providerID ProviderID, sessionID externalprovider.SessionID) (externalprovider.Session, bool) {
	if r == nil || providerID == "" || sessionID == "" {
		return nil, false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	session, ok := r.sessions[sessionKey(providerID, sessionID)]
	return session, ok
}

// ResolveResourceAddress resolves a browser-facing opaque entry token while
// enforcing every explicit identity supplied by the caller.
func (r *ProviderRegistry) ResolveResourceAddress(providerID ProviderID, sessionID externalprovider.SessionID, resourceID externalprovider.ResourceID, token string) (externalprovider.ResourceRef, error) {
	if r == nil || r.addresses == nil {
		return externalprovider.ResourceRef{}, ErrExternalAddressNotFound
	}
	return r.addresses.ResolveResourceAddressFor(providerID, sessionID, resourceID, token)
}

func (r *ProviderRegistry) CloseSession(providerID ProviderID, sessionID externalprovider.SessionID) error {
	if r == nil || providerID == "" || sessionID == "" {
		return ErrProviderSessionNotFound
	}
	key := sessionKey(providerID, sessionID)
	r.mu.Lock()
	session, ok := r.sessions[key]
	if ok {
		delete(r.sessions, key)
	}
	r.mu.Unlock()
	if !ok {
		return ErrProviderSessionNotFound
	}
	err := session.Close()
	if r.addresses != nil {
		r.addresses.RevokeSession(providerID, sessionID)
	}
	return err
}

func (r *ProviderRegistry) ListResources(ctx context.Context, providerID ProviderID, sessionID externalprovider.SessionID, request externalprovider.PageRequest) (externalprovider.ResourcePage, error) {
	if err := externalprovider.ValidatePageRequest(request); err != nil {
		return externalprovider.ResourcePage{}, err
	}
	session, err := r.sessionFor(ctx, providerID, sessionID)
	if err != nil {
		return externalprovider.ResourcePage{}, err
	}
	page, err := session.Resources(ctx, request)
	if err != nil {
		return externalprovider.ResourcePage{}, err
	}
	if err := externalprovider.ValidateResourcePage(page); err != nil {
		return externalprovider.ResourcePage{}, ErrProviderResponse
	}
	return page, nil
}

func (r *ProviderRegistry) ListResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.ListRequest) (externalprovider.DirectoryPage, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if request.Parent == (externalprovider.ResourceRef{}) {
		request.Parent = ref
	}
	if err := externalprovider.ValidateListRequest(request); err != nil || !sameResourceRef(request.Parent, ref) {
		return externalprovider.DirectoryPage{}, ErrInvalidProviderRequest
	}
	resource, err := r.resourceFor(ctx, ref)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	lister, ok := resource.(externalprovider.ListResource)
	if !ok {
		return externalprovider.DirectoryPage{}, ErrProviderCapabilityMissing
	}
	page, err := lister.List(ctx, request)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if err := externalprovider.ValidateDirectoryPage(page); err != nil || !sameResourceRef(page.Parent, ref) {
		return externalprovider.DirectoryPage{}, ErrProviderResponse
	}
	for index := range page.Entries {
		if err := r.sealEntry(ref.Provider, &page.Entries[index]); err != nil {
			return externalprovider.DirectoryPage{}, err
		}
	}
	return page, nil
}

func (r *ProviderRegistry) StatResource(ctx context.Context, request externalprovider.StatRequest) (externalprovider.Entry, error) {
	if err := externalprovider.ValidateStatRequest(request); err != nil {
		return externalprovider.Entry{}, err
	}
	resource, err := r.resourceFor(ctx, request.Target)
	if err != nil {
		return externalprovider.Entry{}, err
	}
	stat, ok := resource.(externalprovider.StatResource)
	if !ok {
		return externalprovider.Entry{}, ErrProviderCapabilityMissing
	}
	entry, err := stat.Stat(ctx, request)
	if err != nil {
		return externalprovider.Entry{}, err
	}
	if err := r.sealEntry(request.Target.Provider, &entry); err != nil {
		return externalprovider.Entry{}, err
	}
	return entry, nil
}

func (r *ProviderRegistry) OpenResource(ctx context.Context, request externalprovider.OpenRequest) (externalprovider.OpenResult, error) {
	if err := externalprovider.ValidateOpenRequest(request); err != nil {
		return externalprovider.OpenResult{}, err
	}
	resource, err := r.resourceFor(ctx, request.Target)
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	opener, ok := resource.(externalprovider.OpenResource)
	if !ok {
		return externalprovider.OpenResult{}, ErrProviderCapabilityMissing
	}
	result, err := opener.Open(ctx, request)
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	if result.Reader == nil || result.Size < 0 {
		return externalprovider.OpenResult{}, ErrProviderResponse
	}
	if err := r.sealEntry(request.Target.Provider, &result.Entry); err != nil {
		_ = result.Reader.Close()
		return externalprovider.OpenResult{}, err
	}
	return result, nil
}

func (r *ProviderRegistry) CreateResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.CreateRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateCreateRequest(request); err != nil || !sameResourceRef(request.Parent, ref) {
		return externalprovider.MutationResult{}, ErrInvalidProviderRequest
	}
	return r.mutateResource(ctx, ref, func(resource externalprovider.Resource) (externalprovider.MutationResult, error) {
		creator, ok := resource.(externalprovider.CreateResource)
		if !ok {
			return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
		}
		return creator.Create(ctx, request)
	})
}

func (r *ProviderRegistry) UpdateResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.UpdateRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateUpdateRequest(request); err != nil || !sameResourceRef(request.Target, ref) {
		return externalprovider.MutationResult{}, ErrInvalidProviderRequest
	}
	return r.mutateResource(ctx, ref, func(resource externalprovider.Resource) (externalprovider.MutationResult, error) {
		updater, ok := resource.(externalprovider.UpdateResource)
		if !ok {
			return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
		}
		return updater.Update(ctx, request)
	})
}

func (r *ProviderRegistry) DeleteResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.DeleteRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateDeleteRequest(request); err != nil {
		return externalprovider.MutationResult{}, err
	}
	for _, target := range request.Targets {
		if target.Provider != ref.Provider || target.Session != ref.Session || target.Resource != ref.Resource {
			return externalprovider.MutationResult{}, ErrInvalidProviderRequest
		}
	}
	return r.mutateResource(ctx, ref, func(resource externalprovider.Resource) (externalprovider.MutationResult, error) {
		deleter, ok := resource.(externalprovider.DeleteResource)
		if !ok {
			return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
		}
		return deleter.Delete(ctx, request)
	})
}

func (r *ProviderRegistry) CopyResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.CopyRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateCopyRequest(request); err != nil || !sameResourceRef(request.Source, ref) {
		return externalprovider.MutationResult{}, ErrInvalidProviderRequest
	}
	return r.mutateResource(ctx, ref, func(resource externalprovider.Resource) (externalprovider.MutationResult, error) {
		copier, ok := resource.(externalprovider.CopyResource)
		if !ok {
			return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
		}
		return copier.Copy(ctx, request)
	})
}

func (r *ProviderRegistry) MoveResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.MoveRequest) (externalprovider.MutationResult, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMoveRequest(request); err != nil || !sameResourceRef(request.Source, ref) {
		return externalprovider.MutationResult{}, ErrInvalidProviderRequest
	}
	return r.mutateResource(ctx, ref, func(resource externalprovider.Resource) (externalprovider.MutationResult, error) {
		mover, ok := resource.(externalprovider.MoveResource)
		if !ok {
			return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
		}
		return mover.Move(ctx, request)
	})
}

func (r *ProviderRegistry) WatchResource(ctx context.Context, ref externalprovider.ResourceRef, request externalprovider.WatchRequest) (externalprovider.ChangeStream, error) {
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return nil, err
	}
	if err := externalprovider.ValidateWatchRequest(request); err != nil || !sameResourceRef(request.Root, ref) {
		return nil, ErrInvalidProviderRequest
	}
	resource, err := r.resourceFor(ctx, ref)
	if err != nil {
		return nil, err
	}
	watcher, ok := resource.(externalprovider.WatchResource)
	if !ok {
		return nil, ErrProviderCapabilityMissing
	}
	return watcher.Watch(ctx, request)
}

func (r *ProviderRegistry) Operation(ctx context.Context, providerID ProviderID, ref externalprovider.OperationRef) (externalprovider.OperationStatus, error) {
	if err := ctx.Err(); err != nil {
		return externalprovider.OperationStatus{}, err
	}
	if strings.TrimSpace(string(providerID)) == "" || strings.TrimSpace(ref.ID) == "" {
		return externalprovider.OperationStatus{}, ErrInvalidProviderRequest
	}
	provider, ok := r.Lookup(providerID)
	if !ok {
		return externalprovider.OperationStatus{}, ErrProviderNotRegistered
	}
	operations, ok := provider.(externalprovider.OperationProvider)
	if !ok {
		return externalprovider.OperationStatus{}, ErrProviderCapabilityMissing
	}
	status, err := operations.Operation(ctx, ref)
	if err != nil {
		return externalprovider.OperationStatus{}, err
	}
	if status.Ref.ID != ref.ID || status.Progress < 0 || status.Progress > 100 {
		return externalprovider.OperationStatus{}, ErrProviderResponse
	}
	return status, nil
}

// ProbeProvider invokes a provider-level health capability without accepting
// a transport-specific payload in the Kernel API.
func (r *ProviderRegistry) ProbeProvider(ctx context.Context, providerID ProviderID) (externalprovider.HealthStatus, error) {
	if err := ctx.Err(); err != nil {
		return externalprovider.HealthStatus{}, err
	}
	provider, ok := r.Lookup(providerID)
	if !ok {
		return externalprovider.HealthStatus{}, ErrProviderNotRegistered
	}
	health, ok := provider.(externalprovider.HealthProvider)
	if !ok {
		return externalprovider.HealthStatus{}, ErrProviderCapabilityMissing
	}
	status, err := health.Health(ctx)
	if err != nil {
		return externalprovider.HealthStatus{}, err
	}
	return status, nil
}

func (r *ProviderRegistry) sessionFor(ctx context.Context, providerID ProviderID, sessionID externalprovider.SessionID) (externalprovider.Session, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	session, ok := r.LookupSession(providerID, sessionID)
	if !ok {
		return nil, ErrProviderSessionNotFound
	}
	return session, nil
}

func (r *ProviderRegistry) resourceFor(ctx context.Context, ref externalprovider.ResourceRef) (externalprovider.Resource, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if err := externalprovider.ValidateResourceRef(ref); err != nil {
		return nil, ErrInvalidProviderRequest
	}
	session, err := r.sessionFor(ctx, ref.Provider, ref.Session)
	if err != nil {
		return nil, err
	}
	resource, err := session.OpenResource(ctx, ref)
	if err != nil {
		return nil, err
	}
	if resource == nil || resource.Ref().Provider != ref.Provider || resource.Ref().Session != ref.Session || resource.Ref().Resource != ref.Resource {
		return nil, ErrProviderResponse
	}
	return resource, nil
}

func (r *ProviderRegistry) mutateResource(ctx context.Context, ref externalprovider.ResourceRef, mutate func(externalprovider.Resource) (externalprovider.MutationResult, error)) (externalprovider.MutationResult, error) {
	resource, err := r.resourceFor(ctx, ref)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	result, err := mutate(resource)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMutationResult(result); err != nil {
		return externalprovider.MutationResult{}, ErrProviderResponse
	}
	for index := range result.Entries {
		if err := r.sealEntry(ref.Provider, &result.Entries[index]); err != nil {
			return externalprovider.MutationResult{}, err
		}
	}
	return result, nil
}

func (r *ProviderRegistry) sealEntry(providerID ProviderID, entry *externalprovider.Entry) error {
	if entry == nil || entry.Ref.Provider != providerID || entry.Ref.Session == "" || entry.Ref.Resource == "" || strings.TrimSpace(entry.Name) == "" || entry.Size < 0 {
		return ErrProviderResponse
	}
	if r.addresses == nil {
		return ErrInvalidProviderRequest
	}
	address, err := r.addresses.RegisterResource(entry.Ref, entry.Name)
	if err != nil {
		return err
	}
	entry.ID = address.Token
	entry.Address = &address
	entry.Path = ""
	entry.Ref.Path = ""
	return externalprovider.ValidateEntry(*entry)
}

func sameResourceRef(left, right externalprovider.ResourceRef) bool {
	return left.Provider == right.Provider && left.Session == right.Session && left.Resource == right.Resource && left.Path == right.Path
}
