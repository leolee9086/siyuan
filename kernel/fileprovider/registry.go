package fileprovider

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
	"sync"
	"time"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

const addressTTL = 10 * time.Minute

type addressEntry struct {
	record  AddressRecord
	expires time.Time
}

// AddressRegistry owns short-lived opaque addresses issued by provider
// queries. It is safe for concurrent API requests and never accepts a caller
// supplied filesystem path during resolution.
type AddressRegistry struct {
	mu           sync.Mutex
	entries      map[string]addressEntry
	resourceKeys map[resourceAddressKey]string
	now          func() time.Time
}

type resourceAddressKey struct {
	provider externalprovider.ProviderID
	session  externalprovider.SessionID
	resource externalprovider.ResourceID
	path     string
}

func NewAddressRegistry() *AddressRegistry {
	return &AddressRegistry{
		entries:      make(map[string]addressEntry),
		resourceKeys: make(map[resourceAddressKey]string),
		now:          time.Now,
	}
}

func (r *AddressRegistry) Register(provider ProviderID, path, name string) (ExternalAssetAddress, error) {
	if r == nil || provider == "" || strings.TrimSpace(path) == "" {
		return ExternalAssetAddress{}, ErrInvalidProviderRequest
	}
	token, err := newToken()
	if err != nil {
		return ExternalAssetAddress{}, err
	}
	now := time.Now()
	if r.now != nil {
		now = r.now()
	}
	r.mu.Lock()
	r.expireLocked(now)
	r.entries[token] = addressEntry{
		record:  AddressRecord{Provider: provider, Token: token, Path: path, Name: name},
		expires: now.Add(addressTTL),
	}
	r.mu.Unlock()
	return ExternalAssetAddress{Provider: provider, Token: token, Name: name}, nil
}

// RegisterResource 为资源 provider 的 opaque address 分配短期 token。物理
// 路径和 provider-owned locator 只保留在 Kernel 内存中，不进入浏览器响应。
func (r *AddressRegistry) RegisterResource(ref externalprovider.ResourceRef, name string) (ExternalAssetAddress, error) {
	if r == nil || ref.Provider == "" || ref.Session == "" || ref.Resource == "" {
		return ExternalAssetAddress{}, ErrInvalidProviderRequest
	}
	now := time.Now()
	if r.now != nil {
		now = r.now()
	}
	copyRef := ref
	key := makeResourceAddressKey(ref)
	r.mu.Lock()
	r.expireLocked(now)
	if token, exists := r.resourceKeys[key]; exists {
		entry, entryExists := r.entries[token]
		if entryExists {
			entry.record.Name = name
			entry.record.Resource = &copyRef
			r.entries[token] = entry
			r.mu.Unlock()
			return ExternalAssetAddress{Provider: ProviderID(ref.Provider), Token: token, Name: name}, nil
		}
		delete(r.resourceKeys, key)
	}
	token, err := newToken()
	if err != nil {
		r.mu.Unlock()
		return ExternalAssetAddress{}, err
	}
	r.entries[token] = addressEntry{
		record: AddressRecord{Provider: ProviderID(ref.Provider), Token: token, Name: name, Resource: &copyRef},
		// Resource addresses are session-scoped. They must remain stable while
		// a tree is open; CloseSession revokes them explicitly.
		expires: time.Time{},
	}
	if r.resourceKeys == nil {
		r.resourceKeys = make(map[resourceAddressKey]string)
	}
	r.resourceKeys[key] = token
	r.mu.Unlock()
	return ExternalAssetAddress{Provider: ProviderID(ref.Provider), Token: token, Name: name}, nil
}

func (r *AddressRegistry) Resolve(token string) (AddressRecord, error) {
	if r == nil || strings.TrimSpace(token) == "" {
		return AddressRecord{}, ErrExternalAddressNotFound
	}
	now := time.Now()
	if r.now != nil {
		now = r.now()
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.expireLocked(now)
	entry, ok := r.entries[token]
	if !ok {
		return AddressRecord{}, ErrExternalAddressNotFound
	}
	return entry.record, nil
}

// ResolveFor enforces the provider identity at the content/thumbnail
// boundary. A valid token issued by another adapter is not interchangeable.
func (r *AddressRegistry) ResolveFor(provider ProviderID, token string) (AddressRecord, error) {
	record, err := r.Resolve(token)
	if err != nil {
		return AddressRecord{}, err
	}
	if provider == "" || record.Provider != provider {
		return AddressRecord{}, ErrExternalAddressNotFound
	}
	return record, nil
}

// ResolveResourceFor 只返回指定 provider 的资源引用，并拒绝 catalog token
// 与资源 token 之间的跨域复用。
func (r *AddressRegistry) ResolveResourceFor(provider ProviderID, token string) (externalprovider.ResourceRef, error) {
	record, err := r.ResolveFor(provider, token)
	if err != nil || record.Resource == nil {
		return externalprovider.ResourceRef{}, ErrExternalAddressNotFound
	}
	return *record.Resource, nil
}

// ResolveResourceAddressFor additionally checks the session and resource IDs
// supplied by the caller. This prevents a valid token from being replayed
// against another session or resource even when both use the same provider.
func (r *AddressRegistry) ResolveResourceAddressFor(provider ProviderID, session externalprovider.SessionID, resource externalprovider.ResourceID, token string) (externalprovider.ResourceRef, error) {
	ref, err := r.ResolveResourceFor(provider, token)
	if err != nil || ref.Session != session || ref.Resource != resource {
		return externalprovider.ResourceRef{}, ErrExternalAddressNotFound
	}
	return ref, nil
}

// RevokeSession removes all resource addresses owned by a closed session.
// Catalog/search addresses retain their short TTL and are not affected.
func (r *AddressRegistry) RevokeSession(provider ProviderID, session externalprovider.SessionID) {
	if r == nil || provider == "" || session == "" {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for token, entry := range r.entries {
		if entry.record.Resource == nil || entry.record.Resource.Provider != externalprovider.ProviderID(provider) || entry.record.Resource.Session != session {
			continue
		}
		delete(r.entries, token)
		delete(r.resourceKeys, makeResourceAddressKey(*entry.record.Resource))
	}
}

func (r *AddressRegistry) expireLocked(now time.Time) {
	for token, entry := range r.entries {
		if !entry.expires.IsZero() && !entry.expires.After(now) {
			delete(r.entries, token)
		}
	}
}

func makeResourceAddressKey(ref externalprovider.ResourceRef) resourceAddressKey {
	return resourceAddressKey{
		provider: ref.Provider,
		session:  ref.Session,
		resource: ref.Resource,
		path:     ref.Path,
	}
}

func newToken() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
