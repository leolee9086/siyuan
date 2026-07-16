package websearch

import "testing"

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

func TestMCPResponseParserRejectsMalformedPayload(t *testing.T) {
	if parsed := parseMCPResponse(`{"result":{"content":[{"type":"text","text":"ok"}]}}`); parsed != "ok" {
		t.Fatalf("valid MCP response was not parsed: %q", parsed)
	}
	if parsed := parseMCPResponse(`{"result":{"content":[]}}`); parsed != "" {
		t.Fatalf("empty MCP content must not become a successful result: %q", parsed)
	}
}
