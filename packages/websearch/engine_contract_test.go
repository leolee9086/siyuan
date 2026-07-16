package websearch

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestEngineRegistryRejectsSilentNilResults(t *testing.T) {
	registry := NewEngineRegistry()
	registry.Register("silent", func(config EngineConfig) SearchEngine {
		return silentNilEngine{config: config}
	})
	factory, ok := registry.Get("silent")
	if !ok {
		t.Fatal("registered engine factory missing")
	}
	_, err := factory(DefaultEngineConfig("silent")).Search("query", SearchOptions{NumResults: 1}, nil)
	if err == nil {
		t.Fatal("nil result must be reported as a protocol error")
	}
	if _, ok := err.(*ProtocolError); !ok {
		t.Fatalf("expected ProtocolError, got %T: %v", err, err)
	}
}

func TestJSONAPIEnginePassesQueryToQueryAwareParser(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"items":[{"title":"matched"}]}`))
	}))
	defer server.Close()

	engine := newJSONAPIEngine(jsonAPIConfig{
		Name: "query-aware",
		URL:  func(string, int) string { return server.URL },
		ParseQuery: func(data []byte, query string, max int) ([]SearchResult, error) {
			if query != "browser query" {
				t.Fatalf("parser received query %q", query)
			}
			return []SearchResult{{Title: "matched", URL: "https://example.test", Engine: "query-aware", Position: 1}}, nil
		},
	})(DefaultEngineConfig("query-aware"))

	results, err := engine.Search("browser query", SearchOptions{NumResults: 1}, nil)
	if err != nil {
		t.Fatalf("query-aware search failed: %v", err)
	}
	if len(results) != 1 || results[0].Title != "matched" {
		t.Fatalf("unexpected query-aware results: %+v", results)
	}
}

type silentNilEngine struct {
	config EngineConfig
}

func (e silentNilEngine) Name() string         { return e.config.Name }
func (e silentNilEngine) Config() EngineConfig { return e.config }
func (e silentNilEngine) Search(string, SearchOptions, map[string]string) ([]SearchResult, error) {
	return nil, nil
}
