package fileprovider

import (
	"context"
	"testing"
	"time"
)

func TestCredentialVaultScopesAndExpiresReferences(t *testing.T) {
	vault := NewCredentialVault()
	now := time.Unix(100, 0)
	vault.now = func() time.Time { return now }
	token, err := vault.Issue("synology-file-station", []byte(`{"account":"admin","password":"secret"}`))
	if err != nil {
		t.Fatal(err)
	}
	payload, err := vault.Resolve(context.Background(), "synology-file-station", token)
	if err != nil || string(payload) == "" {
		t.Fatalf("credential did not resolve: %q %v", payload, err)
	}
	if _, err := vault.Resolve(context.Background(), "webdav", token); err != ErrInvalidProviderRequest {
		t.Fatalf("credential crossed provider boundary: %v", err)
	}
	now = now.Add(credentialTTL)
	if _, err := vault.Resolve(context.Background(), "synology-file-station", token); err != ErrInvalidProviderRequest {
		t.Fatalf("expired credential remained available: %v", err)
	}
}
