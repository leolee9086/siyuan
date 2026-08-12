package fileprovider

import (
	"context"
	"encoding/json"
	"sort"
	"sync"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

type ProviderRegistry struct {
	mu        sync.RWMutex
	providers map[ProviderID]externalprovider.Provider
	sessions  map[providerSessionKey]externalprovider.Session
	addresses *AddressRegistry
}

func NewProviderRegistry(addresses *AddressRegistry) *ProviderRegistry {
	return &ProviderRegistry{
		providers: make(map[ProviderID]externalprovider.Provider),
		sessions:  make(map[providerSessionKey]externalprovider.Session),
		addresses: addresses,
	}
}

func (r *ProviderRegistry) Register(provider externalprovider.Provider) error {
	if r == nil || provider == nil || provider.ID() == "" {
		return ErrInvalidProviderRequest
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.providers == nil {
		r.providers = make(map[ProviderID]externalprovider.Provider)
	}
	if _, exists := r.providers[provider.ID()]; exists {
		return ErrProviderAlreadyRegistered
	}
	descriptor := provider.Descriptor()
	if descriptor.ID != provider.ID() {
		return ErrProviderResponse
	}
	if err := externalprovider.ValidateDescriptor(descriptor); err != nil {
		return ErrProviderResponse
	}
	r.providers[provider.ID()] = provider
	return nil
}

func (r *ProviderRegistry) Unregister(id ProviderID) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.providers, id)
}

func (r *ProviderRegistry) Lookup(id ProviderID) (externalprovider.Provider, bool) {
	if r == nil || id == "" {
		return nil, false
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	provider, ok := r.providers[id]
	return provider, ok
}

func (r *ProviderRegistry) IDs() []ProviderID {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	ids := make([]ProviderID, 0, len(r.providers))
	for id := range r.providers {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(left, right int) bool { return ids[left] < ids[right] })
	return ids
}

func (r *ProviderRegistry) Descriptors() []externalprovider.Descriptor {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	descriptors := make([]externalprovider.Descriptor, 0, len(r.providers))
	for _, provider := range r.providers {
		descriptors = append(descriptors, provider.Descriptor())
	}
	sort.Slice(descriptors, func(left, right int) bool { return descriptors[left].ID < descriptors[right].ID })
	return descriptors
}

func (r *ProviderRegistry) Search(ctx context.Context, request SearchRequest) (Page, error) {
	if err := ctx.Err(); err != nil {
		return Page{}, err
	}
	if r == nil || request.Provider == "" {
		return Page{}, ErrInvalidProviderRequest
	}
	if r.addresses == nil {
		return Page{}, ErrInvalidProviderRequest
	}
	provider, ok := r.Lookup(request.Provider)
	if !ok {
		return Page{}, ErrProviderNotRegistered
	}
	if len(request.Payload) == 0 || string(request.Payload) == "null" || !json.Valid(request.Payload) {
		return Page{}, ErrInvalidProviderRequest
	}
	searcher, ok := provider.(externalprovider.TransportSearchProvider)
	if !ok {
		return Page{}, ErrProviderCapabilityMissing
	}
	page, err := searcher.SearchPayload(ctx, request.Payload)
	if err != nil {
		return Page{}, err
	}
	if page.Provider != request.Provider || page.Limit <= 0 || page.Offset < 0 || page.TotalCount < 0 || page.Offset > page.TotalCount {
		return Page{}, ErrProviderResponse
	}
	if len(page.NextCursor) > externalprovider.MaxCursorSize || len(page.Cursor) > externalprovider.MaxCursorSize {
		return Page{}, ErrProviderResponse
	}
	for index := range page.Assets {
		asset := &page.Assets[index]
		if asset.Address != nil || asset.Path == "" {
			return Page{}, ErrProviderResponse
		}
		address, err := r.addresses.Register(request.Provider, asset.Path, asset.Name)
		if err != nil {
			return Page{}, err
		}
		asset.ID = address.Token
		asset.Address = &address
		asset.Path = ""
	}
	return page, nil
}

func (r *ProviderRegistry) List(ctx context.Context, request SearchRequest) (externalprovider.DirectoryPage, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	lister, ok := provider.(externalprovider.TransportListProvider)
	if !ok {
		return externalprovider.DirectoryPage{}, ErrProviderCapabilityMissing
	}
	page, err := lister.ListPayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.DirectoryPage{}, err
	}
	if err := externalprovider.ValidateDirectoryPage(page); err != nil {
		return externalprovider.DirectoryPage{}, ErrProviderResponse
	}
	return page, nil
}

func (r *ProviderRegistry) Stat(ctx context.Context, request SearchRequest) (externalprovider.Entry, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.Entry{}, err
	}
	stat, ok := provider.(externalprovider.TransportStatProvider)
	if !ok {
		return externalprovider.Entry{}, ErrProviderCapabilityMissing
	}
	entry, err := stat.StatPayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.Entry{}, err
	}
	if err := externalprovider.ValidateEntry(entry); err != nil {
		return externalprovider.Entry{}, ErrProviderResponse
	}
	return entry, nil
}

func (r *ProviderRegistry) Open(ctx context.Context, request SearchRequest) (externalprovider.OpenResult, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	opener, ok := provider.(externalprovider.TransportOpenProvider)
	if !ok {
		return externalprovider.OpenResult{}, ErrProviderCapabilityMissing
	}
	result, err := opener.OpenPayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.OpenResult{}, err
	}
	if result.Reader == nil || result.Size < 0 || externalprovider.ValidateEntry(result.Entry) != nil {
		if result.Reader != nil {
			_ = result.Reader.Close()
		}
		return externalprovider.OpenResult{}, ErrProviderResponse
	}
	return result, nil
}

func (r *ProviderRegistry) Health(ctx context.Context, request SearchRequest) (externalprovider.HealthStatus, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.HealthStatus{}, err
	}
	health, ok := provider.(externalprovider.TransportHealthProvider)
	if !ok {
		return externalprovider.HealthStatus{}, ErrProviderCapabilityMissing
	}
	return health.HealthPayload(ctx, request.Payload)
}

func (r *ProviderRegistry) Create(ctx context.Context, request SearchRequest) (externalprovider.MutationResult, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	creator, ok := provider.(externalprovider.TransportCreateProvider)
	if !ok {
		return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
	}
	result, err := creator.CreatePayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMutationResult(result); err != nil {
		return externalprovider.MutationResult{}, ErrProviderResponse
	}
	return result, nil
}

func (r *ProviderRegistry) Update(ctx context.Context, request SearchRequest) (externalprovider.MutationResult, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	updater, ok := provider.(externalprovider.TransportUpdateProvider)
	if !ok {
		return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
	}
	result, err := updater.UpdatePayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMutationResult(result); err != nil {
		return externalprovider.MutationResult{}, ErrProviderResponse
	}
	return result, nil
}

func (r *ProviderRegistry) Delete(ctx context.Context, request SearchRequest) (externalprovider.MutationResult, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	deleter, ok := provider.(externalprovider.TransportDeleteProvider)
	if !ok {
		return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
	}
	result, err := deleter.DeletePayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMutationResult(result); err != nil {
		return externalprovider.MutationResult{}, ErrProviderResponse
	}
	return result, nil
}

func (r *ProviderRegistry) Copy(ctx context.Context, request SearchRequest) (externalprovider.MutationResult, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	copier, ok := provider.(externalprovider.TransportCopyProvider)
	if !ok {
		return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
	}
	result, err := copier.CopyPayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMutationResult(result); err != nil {
		return externalprovider.MutationResult{}, ErrProviderResponse
	}
	return result, nil
}

func (r *ProviderRegistry) Move(ctx context.Context, request SearchRequest) (externalprovider.MutationResult, error) {
	provider, err := r.providerForPayload(ctx, request)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	mover, ok := provider.(externalprovider.TransportMoveProvider)
	if !ok {
		return externalprovider.MutationResult{}, ErrProviderCapabilityMissing
	}
	result, err := mover.MovePayload(ctx, request.Payload)
	if err != nil {
		return externalprovider.MutationResult{}, err
	}
	if err := externalprovider.ValidateMutationResult(result); err != nil {
		return externalprovider.MutationResult{}, ErrProviderResponse
	}
	return result, nil
}

func (r *ProviderRegistry) providerForPayload(ctx context.Context, request SearchRequest) (externalprovider.Provider, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if r == nil || request.Provider == "" || r.addresses == nil {
		return nil, ErrInvalidProviderRequest
	}
	provider, ok := r.Lookup(request.Provider)
	if !ok {
		return nil, ErrProviderNotRegistered
	}
	if len(request.Payload) == 0 || string(request.Payload) == "null" || !json.Valid(request.Payload) {
		return nil, ErrInvalidProviderRequest
	}
	return provider, nil
}
