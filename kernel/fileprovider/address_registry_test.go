package fileprovider

import (
	"testing"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func TestResourceAddressIsStableForSessionPathAndRevokedOnClose(t *testing.T) {
	registry := NewAddressRegistry()
	ref := externalprovider.ResourceRef{
		Provider: "smb",
		Session:  "session-a",
		Resource: "share-a",
		Path:     "nested/photo.png",
	}
	first, err := registry.RegisterResource(ref, "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	second, err := registry.RegisterResource(ref, "renamed-photo.png")
	if err != nil {
		t.Fatal(err)
	}
	if first.Token != second.Token || second.Name != "renamed-photo.png" {
		t.Fatalf("resource address was not stable across refresh: first=%#v second=%#v", first, second)
	}
	resolved, err := registry.ResolveResourceAddressFor("smb", "session-a", "share-a", first.Token)
	if err != nil || resolved.Path != ref.Path {
		t.Fatalf("resource address did not resolve to the provider path: %#v %v", resolved, err)
	}
	if _, err := registry.ResolveResourceAddressFor("smb", "session-b", "share-a", first.Token); err != ErrExternalAddressNotFound {
		t.Fatalf("resource token crossed session boundary: %v", err)
	}
	registry.RevokeSession("smb", "session-a")
	if _, err := registry.ResolveResourceFor("smb", first.Token); err != ErrExternalAddressNotFound {
		t.Fatalf("closed session retained resource token: %v", err)
	}
}

func TestCatalogAddressStillUsesShortLivedEntry(t *testing.T) {
	registry := NewAddressRegistry()
	address, err := registry.Register("everything-http", "C:/assets/photo.png", "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := registry.ResolveFor("everything-http", address.Token); err != nil {
		t.Fatalf("catalog address was not retained: %v", err)
	}
}

func TestResourceAddressesRemainIndependentAcrossProviders(t *testing.T) {
	registry := NewAddressRegistry()
	smbRef := externalprovider.ResourceRef{
		Provider: "windows-smb-mount",
		Session:  "session-a",
		Resource: "share-a",
		Path:     "nested/photo.png",
	}
	dsmRef := smbRef
	dsmRef.Provider = "synology-file-station"

	smbAddress, err := registry.RegisterResource(smbRef, "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	dsmAddress, err := registry.RegisterResource(dsmRef, "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	if smbAddress.Token == dsmAddress.Token {
		t.Fatalf("equal session/resource/path values were merged across providers: %#v %#v", smbAddress, dsmAddress)
	}
	if _, err := registry.ResolveResourceAddressFor("windows-smb-mount", "session-a", "share-a", smbAddress.Token); err != nil {
		t.Fatalf("SMB address did not resolve in its provider boundary: %v", err)
	}
	if _, err := registry.ResolveResourceAddressFor("synology-file-station", "session-a", "share-a", dsmAddress.Token); err != nil {
		t.Fatalf("DSM address did not resolve in its provider boundary: %v", err)
	}

	registry.RevokeSession("windows-smb-mount", "session-a")
	if _, err := registry.ResolveResourceAddressFor("windows-smb-mount", "session-a", "share-a", smbAddress.Token); err != ErrExternalAddressNotFound {
		t.Fatalf("closed SMB session retained its address: %v", err)
	}
	if _, err := registry.ResolveResourceAddressFor("synology-file-station", "session-a", "share-a", dsmAddress.Token); err != nil {
		t.Fatalf("closing one provider revoked another provider's equal-valued session: %v", err)
	}
}
