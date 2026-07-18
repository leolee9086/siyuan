package websearch

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestServiceDiagnoseReportsMissingCredentials(t *testing.T) {
	service := NewService(RuntimeConfig{
		Enabled:        true,
		Provider:       ProviderMeta,
		DefaultOptions: DefaultSearchOptions(),
		Engines:        map[string]EngineRuntimeConfig{},
	})
	statuses := service.Diagnose([]string{"brave"}, false, "")
	if len(statuses) != 1 {
		t.Fatalf("expected one engine status, got %d", len(statuses))
	}
	status := statuses[0]
	if !status.RequiresKey || status.CredentialsReady || status.Status != "requires_credentials" {
		t.Fatalf("missing credentials must be explicit: %+v", status)
	}
}

func TestServiceDiagnoseMarksProtectedEnginesAsCredentialBound(t *testing.T) {
	service := NewService(RuntimeConfig{
		Enabled:        true,
		Provider:       ProviderMeta,
		DefaultOptions: DefaultSearchOptions(),
		Engines:        map[string]EngineRuntimeConfig{},
	})
	names := []string{
		"ads", "brave", "context7", "flickr", "fred", "freesound",
		"github-code", "github-issues", "github-repo-files", "gitlab", "igdb",
		"openweather", "pexels", "pixabay", "rawg", "soundcloud", "spotify",
		"theguardian", "unsplash",
	}
	statuses := service.Diagnose(names, false, "")
	if len(statuses) != len(names) {
		t.Fatalf("expected one diagnostic per protected engine: got %d want %d", len(statuses), len(names))
	}
	for _, status := range statuses {
		if !status.RequiresKey || status.Status != "requires_credentials" {
			t.Fatalf("protected engine must require configured credentials: %+v", status)
		}
	}
}

func TestServiceSearchReportsUnknownExplicitEngine(t *testing.T) {
	service := NewService(RuntimeConfig{
		Enabled:        true,
		Provider:       ProviderMeta,
		DefaultOptions: DefaultSearchOptions(),
		Engines:        map[string]EngineRuntimeConfig{},
	})
	response, err := service.Search("query", SearchOptions{
		Provider:   ProviderMeta,
		NumResults: 1,
		Engines:    []string{"missing-engine"},
	}, nil)
	if err != nil {
		t.Fatalf("unknown explicit engine should be a structured diagnostic: %v", err)
	}
	if len(response.Diagnostics) != 1 || response.Diagnostics[0].Status != "not_registered" {
		t.Fatalf("expected not_registered diagnostic, got %+v", response.Diagnostics)
	}
}

func TestServiceAppliesDefaultAndPerEngineTimeouts(t *testing.T) {
	service := NewService(RuntimeConfig{
		Enabled:   true,
		TimeoutMs: 2100,
		Engines:   map[string]EngineRuntimeConfig{},
	})
	base := DefaultEngineConfig("github")
	if got := service.engineConfig("github", base).Timeout; got != 2100 {
		t.Fatalf("default runtime timeout=%d, want 2100", got)
	}

	service = NewService(RuntimeConfig{
		Enabled:   true,
		TimeoutMs: 2100,
		Engines: map[string]EngineRuntimeConfig{
			"github": {TimeoutMs: 3200},
		},
	})
	if got := service.engineConfig("github", base).Timeout; got != 3200 {
		t.Fatalf("per-engine runtime timeout=%d, want 3200", got)
	}
}

func TestServiceDiagnoseWithProgressProbesConcurrentlyAndKeepsSortedResults(t *testing.T) {
	names := []string{"diagnostic-concurrent-c", "diagnostic-concurrent-a", "diagnostic-concurrent-b"}
	var active atomic.Int32
	var maxActive atomic.Int32
	for _, name := range names {
		registerDiagnosticContractEngine(name, 100*time.Millisecond, 1000, &active, &maxActive)
		defer unregisterDiagnosticContractEngine(name)
	}
	service := NewService(RuntimeConfig{Enabled: true, Engines: map[string]EngineRuntimeConfig{}})
	var progress []DiagnosticProgress
	statuses := service.DiagnoseWithProgress(names, true, "query", func(update DiagnosticProgress) {
		progress = append(progress, update)
	})

	if maxActive.Load() < 2 {
		t.Fatalf("diagnostic probes did not run concurrently: maxActive=%d", maxActive.Load())
	}
	if len(statuses) != 3 || statuses[0].Name != "diagnostic-concurrent-a" || statuses[2].Name != "diagnostic-concurrent-c" {
		t.Fatalf("diagnostic results must remain sorted: %+v", statuses)
	}
	if len(progress) != 4 || progress[0].Done != 0 || progress[0].Total != 3 {
		t.Fatalf("diagnostic progress must start immediately: %+v", progress)
	}
	for index := 1; index < len(progress); index++ {
		if progress[index].Done != index || progress[index].Total != 3 || progress[index].Current == "" {
			t.Fatalf("diagnostic progress must advance monotonically: %+v", progress)
		}
	}
}

func TestServiceDiagnoseProbeUsesHardTimeout(t *testing.T) {
	name := "diagnostic-hard-timeout"
	registerDiagnosticContractEngine(name, 250*time.Millisecond, 50, nil, nil)
	defer unregisterDiagnosticContractEngine(name)
	service := NewService(RuntimeConfig{Enabled: true, Engines: map[string]EngineRuntimeConfig{}})
	started := time.Now()
	statuses := service.Diagnose([]string{name}, true, "query")
	elapsed := time.Since(started)

	if elapsed >= 200*time.Millisecond {
		t.Fatalf("diagnostic hard timeout was not enforced: elapsed=%s", elapsed)
	}
	if len(statuses) != 1 || statuses[0].Status != "probe_failed" || !strings.Contains(statuses[0].LastError, "timed out") {
		t.Fatalf("timeout must be explicit in diagnostic result: %+v", statuses)
	}
}

func registerDiagnosticContractEngine(name string, delay time.Duration, timeoutMs int, active, maxActive *atomic.Int32) {
	GlobalEngineRegistry.Register(name, func(config EngineConfig) SearchEngine {
		config.Name = name
		config.Timeout = timeoutMs
		return &diagnosticContractEngine{config: config, delay: delay, active: active, maxActive: maxActive}
	})
}

func unregisterDiagnosticContractEngine(name string) {
	GlobalEngineRegistry.mu.Lock()
	defer GlobalEngineRegistry.mu.Unlock()
	delete(GlobalEngineRegistry.engines, name)
}

type diagnosticContractEngine struct {
	config    EngineConfig
	delay     time.Duration
	active    *atomic.Int32
	maxActive *atomic.Int32
}

func (e *diagnosticContractEngine) Name() string         { return e.config.Name }
func (e *diagnosticContractEngine) Config() EngineConfig { return e.config }
func (e *diagnosticContractEngine) Search(string, SearchOptions, map[string]string) ([]SearchResult, error) {
	if e.active != nil {
		current := e.active.Add(1)
		defer e.active.Add(-1)
		for {
			previous := e.maxActive.Load()
			if current <= previous || e.maxActive.CompareAndSwap(previous, current) {
				break
			}
		}
	}
	time.Sleep(e.delay)
	return []SearchResult{{Title: "ok", URL: "https://example.com", Engine: e.config.Name}}, nil
}

func TestMCPResponseParserRejectsMalformedPayload(t *testing.T) {
	if parsed := parseMCPResponse(`{"result":{"content":[{"type":"text","text":"ok"}]}}`); parsed != "ok" {
		t.Fatalf("valid MCP response was not parsed: %q", parsed)
	}
	if parsed := parseMCPResponse(`{"result":{"content":[]}}`); parsed != "" {
		t.Fatalf("empty MCP content must not become a successful result: %q", parsed)
	}
}
