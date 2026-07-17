package websearch

import (
	"net/http"
	"testing"
	"time"
)

func TestNewMCPHTTPClientUsesExplicitProxy(t *testing.T) {
	client, err := newMCPHTTPClient("https://mcp.example/search", time.Second, NewExplicitProxy("http://proxy.example:7890", "http://proxy.example:7890"))
	if err != nil {
		t.Fatal(err)
	}
	transport, ok := client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("transport type=%T, want *http.Transport", client.Transport)
	}
	request, err := http.NewRequest(http.MethodGet, "https://mcp.example/search", nil)
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

func TestNewMCPHTTPClientHonorsNoProxy(t *testing.T) {
	proxy := NewExplicitProxy("http://proxy.example:7890", "http://proxy.example:7890")
	proxy.NoProxy = "mcp.example"
	client, err := newMCPHTTPClient("https://mcp.example/search", time.Second, proxy)
	if err != nil {
		t.Fatal(err)
	}
	transport := client.Transport.(*http.Transport)
	request, err := http.NewRequest(http.MethodGet, "https://mcp.example/search", nil)
	if err != nil {
		t.Fatal(err)
	}
	proxyURL, err := transport.Proxy(request)
	if err != nil {
		t.Fatal(err)
	}
	if proxyURL != nil {
		t.Fatalf("proxy=%v, want direct connection for NoProxy host", proxyURL)
	}
}

func TestNewMCPHTTPClientDoesNotUseEnvironmentProxy(t *testing.T) {
	client, err := newMCPHTTPClient("https://mcp.example/search", time.Second, NewProxyConfig())
	if err != nil {
		t.Fatal(err)
	}
	transport := client.Transport.(*http.Transport)
	if transport.Proxy != nil {
		t.Fatal("empty proxy must remain direct instead of consulting environment")
	}
}
