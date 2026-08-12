package api

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/kernel/filebrowser"
	"github.com/siyuan-note/siyuan/kernel/fileprovider"
	efu "github.com/siyuan-note/siyuan/packages/everything-efu"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
	s3provider "github.com/siyuan-note/siyuan/packages/s3-provider"
	synologyfilestation "github.com/siyuan-note/siyuan/packages/synology-file-station-provider"
	webdavprovider "github.com/siyuan-note/siyuan/packages/webdav-provider"
)

type recordingFileBrowserCredentialStore struct {
	issues   int
	resolves int
	revokes  int
}

func (s *recordingFileBrowserCredentialStore) Issue(fileprovider.ProviderID, []byte) (string, error) {
	s.issues++
	return "credential", nil
}

func (s *recordingFileBrowserCredentialStore) Resolve(context.Context, fileprovider.ProviderID, string) ([]byte, error) {
	s.resolves++
	return nil, fileprovider.ErrInvalidProviderRequest
}

func (s *recordingFileBrowserCredentialStore) Revoke(string) {
	s.revokes++
}

func TestFileBrowserProviderRegistryIsProcessScoped(t *testing.T) {
	first := newFileBrowserProviderRegistry()
	second := newFileBrowserProviderRegistry()
	if first == nil || first != second {
		t.Fatalf("provider registry was recreated per request: first=%p second=%p", first, second)
	}
}

func TestProductionProviderRegistryDefaultsToEncryptedTransport(t *testing.T) {
	registry := buildFileBrowserProviderRegistry()
	providers := []fileprovider.ProviderID{
		synologyfilestation.ProviderID,
		s3provider.ProviderID,
		webdavprovider.ProviderID,
	}
	for _, providerID := range providers {
		t.Run(string(providerID), func(t *testing.T) {
			err := registry.ValidateSessionRequest(context.Background(), providerID, externalprovider.SessionRequest{
				Endpoint: "http://127.0.0.1:8080",
			})
			if !errors.Is(err, externalprovider.ErrInsecureTransportNotConfirmed) {
				t.Fatalf("production provider accepted HTTP without confirmation: %v", err)
			}

			err = registry.ValidateSessionRequest(context.Background(), providerID, externalprovider.SessionRequest{
				Endpoint: "http://8.8.8.8:8080", InsecureHTTPConfirmed: true,
			})
			if !errors.Is(err, externalprovider.ErrInsecureTransportHostNotPrivate) {
				t.Fatalf("production provider accepted confirmed public HTTP: %v", err)
			}

			err = registry.ValidateSessionRequest(context.Background(), providerID, externalprovider.SessionRequest{
				Endpoint: "http://192.168.1.20:8080", InsecureHTTPConfirmed: true,
			})
			if err != nil {
				t.Fatalf("production provider rejected confirmed private HTTP: %v", err)
			}

			if err = registry.ValidateSessionRequest(context.Background(), providerID, externalprovider.SessionRequest{
				Endpoint: "https://storage.example.test",
			}); err != nil {
				t.Fatalf("production provider requires confirmation for HTTPS: %v", err)
			}
		})
	}
}

func TestProviderSessionAPIRejectsUnsafeHTTPBeforeIssuingCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalRegistry := newFileBrowserProviderRegistry
	originalVault := fileBrowserProviderCredentialVault
	registry := buildFileBrowserProviderRegistry()
	store := &recordingFileBrowserCredentialStore{}
	newFileBrowserProviderRegistry = func() *fileprovider.ProviderRegistry { return registry }
	fileBrowserProviderCredentialVault = store
	t.Cleanup(func() {
		newFileBrowserProviderRegistry = originalRegistry
		fileBrowserProviderCredentialVault = originalVault
	})

	tests := []struct {
		name string
		body string
		want error
	}{
		{
			name: "unconfirmed private HTTP",
			body: `{"provider":"webdav","endpoint":"http://127.0.0.1:8080/dav","credentials":{"username":"tester","password":"secret"}}`,
			want: externalprovider.ErrInsecureTransportNotConfirmed,
		},
		{
			name: "confirmed public HTTP",
			body: `{"provider":"s3","endpoint":"http://8.8.8.8:9000","insecureHTTPConfirmed":true,"credentials":{"accessKey":"access","secretKey":"secret"}}`,
			want: externalprovider.ErrInsecureTransportHostNotPrivate,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			beforeIssues, beforeResolves, beforeRevokes := store.issues, store.resolves, store.revokes
			response := callFileBrowserHandler(t, openFileBrowserProviderSession, "127.0.0.1:6806", test.body)
			if response.Code != 400 || !strings.Contains(response.Msg, test.want.Error()) {
				t.Fatalf("unsafe transport response = %+v, want 400 containing %q", response, test.want.Error())
			}
			if store.issues != beforeIssues || store.resolves != beforeResolves || store.revokes != beforeRevokes {
				t.Fatalf("unsafe transport touched credential vault: issues=%d resolves=%d revokes=%d", store.issues, store.resolves, store.revokes)
			}
		})
	}
}

func TestProviderTransportPolicyErrorsUseBadRequest(t *testing.T) {
	for _, err := range []error{
		externalprovider.ErrInsecureTransportNotConfirmed,
		externalprovider.ErrInsecureTransportHostNotPrivate,
		externalprovider.ErrInsecureTransportRedirect,
	} {
		if code := fileBrowserProviderErrorCode(err); code != 400 {
			t.Fatalf("transport policy error %q mapped to %d", err, code)
		}
	}
}

func TestFileBrowserProviderSearchUsesAuthorizedEFUAndOpaqueAddress(t *testing.T) {
	gin.SetMode(gin.TestMode)
	workspace := t.TempDir()
	fixturePath := filepath.Join(workspace, "exports", "list.efu")
	if err := os.MkdirAll(filepath.Dir(fixturePath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fixturePath, []byte("Filename,Size\nC:\\assets\\one.png,4\n"), 0600); err != nil {
		t.Fatal(err)
	}
	originalService := newFileBrowserService
	originalRegistry := newFileBrowserProviderRegistry
	newFileBrowserService = func() *filebrowser.Service {
		return filebrowser.NewService(workspace, func() (map[string]*agent.TaskDirectoryBinding, error) { return nil, nil })
	}
	var addresses *fileprovider.AddressRegistry
	newFileBrowserProviderRegistry = func() *fileprovider.ProviderRegistry {
		addresses = fileprovider.NewAddressRegistry()
		registry := fileprovider.NewProviderRegistry(addresses)
		if err := registry.Register(efu.NewProvider(openAuthorizedEFU)); err != nil {
			t.Fatal(err)
		}
		return registry
	}
	t.Cleanup(func() {
		newFileBrowserService = originalService
		newFileBrowserProviderRegistry = originalRegistry
	})

	response := callFileBrowserHandler(t, searchSForgeFileBrowserProvider, "127.0.0.1:6806",
		`{"provider":"efu","request":{"rootID":"workspace","path":"exports/list.efu","limit":1}}`)
	if response.Code != 0 {
		t.Fatalf("provider search failed: %+v", response)
	}
	var page fileprovider.Page
	if err := json.Unmarshal(response.Data, &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Assets) != 1 || page.Assets[0].Path != "" || page.Assets[0].Address == nil || page.Assets[0].Address.Provider != fileprovider.ProviderEFU {
		t.Fatalf("physical path crossed API boundary: %#v", page)
	}
	if addresses == nil {
		t.Fatal("provider registry factory was not used")
	}
	record, err := addresses.ResolveFor(fileprovider.ProviderEFU, page.Assets[0].Address.Token)
	if err != nil || record.Path != "C:/assets/one.png" {
		t.Fatalf("address was not retained by kernel registry: %#v %v", record, err)
	}

	traversal := callFileBrowserHandler(t, searchSForgeFileBrowserProvider, "127.0.0.1:6806",
		`{"provider":"efu","request":{"rootID":"workspace","path":"../outside.efu"}}`)
	if traversal.Code != 403 {
		t.Fatalf("EFU source escaped authorized root: %+v", traversal)
	}
	invalidExtension := callFileBrowserHandler(t, searchSForgeFileBrowserProvider, "127.0.0.1:6806",
		`{"provider":"efu","request":{"rootID":"workspace","path":"exports/list.txt"}}`)
	if invalidExtension.Code != 400 || !strings.Contains(invalidExtension.Msg, "invalid") {
		t.Fatalf("provider-owned extension validation was bypassed: %+v", invalidExtension)
	}
}

func TestFileBrowserProviderSearchRejectsUnknownProvider(t *testing.T) {
	gin.SetMode(gin.TestMode)
	response := callFileBrowserHandler(t, searchSForgeFileBrowserProvider, "127.0.0.1:6806", `{"provider":"unknown"}`)
	if response.Code != 501 {
		t.Fatalf("unknown provider was not rejected by registry: %+v", response)
	}
}
