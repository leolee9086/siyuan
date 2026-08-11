package fileprovider

import (
	"crypto/rand"
	"encoding/base64"
	"strings"
	"sync"
	"time"
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
	mu      sync.Mutex
	entries map[string]addressEntry
	now     func() time.Time
}

func NewAddressRegistry() *AddressRegistry {
	return &AddressRegistry{entries: make(map[string]addressEntry), now: time.Now}
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

func (r *AddressRegistry) expireLocked(now time.Time) {
	for token, entry := range r.entries {
		if !entry.expires.After(now) {
			delete(r.entries, token)
		}
	}
}

func newToken() (string, error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}
