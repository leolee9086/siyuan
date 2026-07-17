package websearch

import "testing"

func TestServicePropagatesDefaultProxyToUnconfiguredEngines(t *testing.T) {
	want := NewExplicitProxy("http://proxy.example:7890", "http://proxy.example:7890")
	service := NewService(RuntimeConfig{
		Enabled:        true,
		Provider:       ProviderMeta,
		Proxy:          want,
		DefaultOptions: DefaultSearchOptions(),
	})
	engines, _ := service.selectEngines(SearchOptions{Engines: []string{"github"}})
	if len(engines) != 1 {
		t.Fatalf("selected engines=%d, want 1", len(engines))
	}
	got := engines[0].Config().Proxy
	if got.HTTP != want.HTTP || got.HTTPS != want.HTTPS {
		t.Fatalf("engine proxy=%#v, want %#v", got, want)
	}
}
