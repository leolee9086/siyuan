package fileprovider

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"strings"
	"sync"
	"time"
)

const (
	credentialTTL     = 2 * time.Minute
	maxCredentialSize = 64 * 1024
)

type credentialEntry struct {
	provider ProviderID
	payload  []byte
	expires  time.Time
}

// CredentialVault is a short-lived composition-root boundary. Provider
// packages own credential schemas; Kernel only associates an opaque reference
// with the provider that is allowed to resolve it.
type CredentialVault struct {
	mu      sync.Mutex
	entries map[string]credentialEntry
	now     func() time.Time
}

func NewCredentialVault() *CredentialVault {
	return &CredentialVault{entries: make(map[string]credentialEntry), now: time.Now}
}

func (v *CredentialVault) Issue(provider ProviderID, payload []byte) (string, error) {
	if v == nil || strings.TrimSpace(string(provider)) == "" || len(payload) == 0 || len(payload) > maxCredentialSize {
		return "", ErrInvalidProviderRequest
	}
	if err := contextPayloadValid(payload); err != nil {
		return "", err
	}
	tokenBytes := make([]byte, 24)
	if _, err := rand.Read(tokenBytes); err != nil {
		return "", err
	}
	token := "cred-" + base64.RawURLEncoding.EncodeToString(tokenBytes)
	now := time.Now()
	if v.now != nil {
		now = v.now()
	}
	v.mu.Lock()
	if v.entries == nil {
		v.entries = make(map[string]credentialEntry)
	}
	v.expireLocked(now)
	v.entries[token] = credentialEntry{provider: provider, payload: append([]byte(nil), payload...), expires: now.Add(credentialTTL)}
	v.mu.Unlock()
	return token, nil
}

func (v *CredentialVault) Resolve(ctx context.Context, provider ProviderID, token string) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if v == nil || strings.TrimSpace(string(provider)) == "" || strings.TrimSpace(token) == "" {
		return nil, ErrInvalidProviderRequest
	}
	now := time.Now()
	if v.now != nil {
		now = v.now()
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	v.expireLocked(now)
	entry, ok := v.entries[token]
	if !ok || entry.provider != provider {
		return nil, ErrInvalidProviderRequest
	}
	return append([]byte(nil), entry.payload...), nil
}

func (v *CredentialVault) Revoke(token string) {
	if v == nil || token == "" {
		return
	}
	v.mu.Lock()
	defer v.mu.Unlock()
	if entry, ok := v.entries[token]; ok {
		for index := range entry.payload {
			entry.payload[index] = 0
		}
		delete(v.entries, token)
	}
}

func (v *CredentialVault) expireLocked(now time.Time) {
	for token, entry := range v.entries {
		if !entry.expires.After(now) {
			for index := range entry.payload {
				entry.payload[index] = 0
			}
			delete(v.entries, token)
		}
	}
}

func contextPayloadValid(payload []byte) error {
	trimmed := strings.TrimSpace(string(payload))
	if trimmed == "" || trimmed == "null" {
		return ErrInvalidProviderRequest
	}
	return nil
}
