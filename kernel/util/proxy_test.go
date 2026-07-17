package util

import (
	"net/http"
	"testing"
)

func TestNewOpenAIHTTPClientUsesOnlyExplicitProxy(t *testing.T) {
	client := newOpenAIHTTPClient("http://proxy.example:7890", "test-agent")
	transport, ok := client.Transport.(*AddHeaderTransport)
	if !ok {
		t.Fatalf("transport type=%T, want AddHeaderTransport", client.Transport)
	}
	base, ok := transport.RoundTripper.(*http.Transport)
	if !ok {
		t.Fatalf("round tripper type=%T, want *http.Transport", transport.RoundTripper)
	}
	request, err := http.NewRequest(http.MethodGet, "https://api.example", nil)
	if err != nil {
		t.Fatal(err)
	}
	proxyURL, err := base.Proxy(request)
	if err != nil {
		t.Fatal(err)
	}
	if proxyURL == nil || proxyURL.String() != "http://proxy.example:7890" {
		t.Fatalf("proxy=%v, want explicit proxy", proxyURL)
	}
}

func TestNewOpenAIHTTPClientDoesNotUseEnvironmentProxy(t *testing.T) {
	client := newOpenAIHTTPClient("", "")
	transport, ok := client.Transport.(*AddHeaderTransport)
	if !ok {
		t.Fatalf("transport type=%T, want AddHeaderTransport", client.Transport)
	}
	base, ok := transport.RoundTripper.(*http.Transport)
	if !ok {
		t.Fatalf("round tripper type=%T, want *http.Transport", transport.RoundTripper)
	}
	if base.Proxy != nil {
		t.Fatal("empty proxy must remain direct instead of consulting environment")
	}
}

func TestNewWebFetchClientUsesExplicitProxy(t *testing.T) {
	client, err := newWebFetchClient(0, "http://proxy.example:7890", nil)
	if err != nil {
		t.Fatal(err)
	}
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport type=%T, want *http.Transport", client.Transport)
	}
	request, err := http.NewRequest(http.MethodGet, "https://example.com", nil)
	if err != nil {
		t.Fatal(err)
	}
	proxyURL, err := transport.Proxy(request)
	if err != nil {
		t.Fatal(err)
	}
	if proxyURL == nil || proxyURL.String() != "http://proxy.example:7890" {
		t.Fatalf("proxy=%v, want explicit proxy", proxyURL)
	}
}

func TestNewWebFetchClientWithoutProxyIsDirect(t *testing.T) {
	client, err := newWebFetchClient(0, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport type=%T, want *http.Transport", client.Transport)
	}
	if transport.Proxy != nil {
		t.Fatal("empty proxy must remain direct instead of consulting environment")
	}
}
