package websearch

import "testing"

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

type silentNilEngine struct {
	config EngineConfig
}

func (e silentNilEngine) Name() string         { return e.config.Name }
func (e silentNilEngine) Config() EngineConfig { return e.config }
func (e silentNilEngine) Search(string, SearchOptions, map[string]string) ([]SearchResult, error) {
	return nil, nil
}
