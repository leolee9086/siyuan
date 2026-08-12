package fileprovider

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	efu "github.com/siyuan-note/siyuan/packages/everything-efu"
	everythinghttp "github.com/siyuan-note/siyuan/packages/everything-http-native"
	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func TestProviderRegistryValidatesAdaptersAndOpaqueAddresses(t *testing.T) {
	addresses := NewAddressRegistry()
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		_, _ = writer.Write([]byte(`{"results":[{"type":"file","name":"cover.png","path":"C:\\assets","size":"3"}],"totalFileResults":1}`))
	}))
	t.Cleanup(server.Close)
	host, portText, err := net.SplitHostPort(server.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	registry := NewProviderRegistry(addresses)
	if err = registry.Register(everythinghttp.NewProvider(server.Client())); err != nil {
		t.Fatal(err)
	}
	if err = registry.Register(everythinghttp.NewProvider(server.Client())); err != ErrProviderAlreadyRegistered {
		t.Fatalf("expected duplicate registration error, got %v", err)
	}
	page, err := registry.Search(context.Background(), providerRequest(ProviderEverythingHTTP, `{"host":"`+host+`","port":`+portText+`,"limit":1}`))
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Assets) != 1 || page.Assets[0].Path != "" || page.Assets[0].Address == nil {
		t.Fatalf("physical provider path crossed kernel boundary: %#v", page)
	}
	record, err := addresses.ResolveFor(ProviderEverythingHTTP, page.Assets[0].Address.Token)
	if err != nil || record.Path != "C:/assets/cover.png" {
		t.Fatalf("opaque address did not resolve internally: %#v %v", record, err)
	}
	if _, err = addresses.ResolveFor(ProviderEFU, page.Assets[0].Address.Token); err != ErrExternalAddressNotFound {
		t.Fatalf("provider token was accepted by another adapter: %v", err)
	}
	if _, err = registry.Search(context.Background(), SearchRequest{Provider: "missing", Payload: json.RawMessage(`{}`)}); err != ErrProviderNotRegistered {
		t.Fatalf("expected unregistered provider error, got %v", err)
	}
	if _, err = registry.Search(context.Background(), providerRequest(ProviderEverythingHTTP, `{"host":"10.0.0.7","port":80}`)); err != ErrInvalidProviderRequest {
		t.Fatalf("remote host crossed adapter boundary: %v", err)
	}
}

func TestEFUAdapterUsesRootRelativeSourceAndRegistryContract(t *testing.T) {
	addresses := NewAddressRegistry()
	var received efu.SearchRequest
	provider := efu.NewProvider(func(ctx context.Context, request efu.SearchRequest) (io.ReadCloser, error) {
		received = request
		return io.NopCloser(strings.NewReader("Filename,Size\nC:\\assets\\one.txt,4\n")), nil
	})
	registry := NewProviderRegistry(addresses)
	if err := registry.Register(provider); err != nil {
		t.Fatal(err)
	}
	page, err := registry.Search(context.Background(), providerRequest(ProviderEFU, `{"rootID":"root-a","path":"exports/list.efu","limit":1}`))
	if err != nil {
		t.Fatal(err)
	}
	if received.RootID != "root-a" || received.Path != "exports/list.efu" || len(page.Assets) != 1 || page.Assets[0].Address == nil {
		t.Fatalf("unexpected EFU adapter call/result: %#v %#v", received, page)
	}
	if _, err = registry.Search(context.Background(), providerRequest(ProviderEFU, `{"rootID":"root-a","path":"exports/list.txt"}`)); !errors.Is(err, ErrInvalidProviderRequest) {
		t.Fatalf("provider-specific extension rule was bypassed: %v", err)
	}
}

type invalidPageAdapter struct{}

func (invalidPageAdapter) ID() ProviderID { return "invalid" }
func (invalidPageAdapter) Descriptor() externalprovider.Descriptor {
	return externalprovider.Descriptor{
		ID: "invalid", DisplayName: "Invalid", Kind: externalprovider.ProviderKindCatalog,
		SessionMode: externalprovider.SessionModeNone, Capabilities: []string{externalprovider.CapabilitySearch},
	}
}
func (invalidPageAdapter) SearchPayload(context.Context, json.RawMessage) (externalprovider.Page, error) {
	return externalprovider.Page{Provider: ProviderEverythingHTTP, Limit: 1}, nil
}

func TestProviderRegistryRejectsMismatchedProviderResponse(t *testing.T) {
	registry := NewProviderRegistry(NewAddressRegistry())
	if err := registry.Register(invalidPageAdapter{}); err != nil {
		t.Fatal(err)
	}
	if _, err := registry.Search(context.Background(), providerRequest("invalid", `{}`)); err != ErrProviderResponse {
		t.Fatalf("expected provider response validation error, got %v", err)
	}
}

func providerRequest(provider ProviderID, payload string) SearchRequest {
	return SearchRequest{Provider: provider, Payload: json.RawMessage(payload)}
}
