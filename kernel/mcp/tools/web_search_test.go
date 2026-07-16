package tools

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

func TestWebSearchToolSchemaIncludesSearchControls(t *testing.T) {
	for _, name := range []string{"numResults", "queryType", "timeRange", "lang", "provider", "searchType", "livecrawl", "engines"} {
		if _, ok := WebSearchTool.InputSchema.Properties[name]; !ok {
			t.Fatalf("web_search schema missing %q", name)
		}
	}
	if len(WebSearchTool.InputSchema.Required) != 1 || WebSearchTool.InputSchema.Required[0] != "query" {
		t.Fatalf("web_search must require only query: %+v", WebSearchTool.InputSchema.Required)
	}
}

func TestWebSearchHandlerPropagatesInvalidQuery(t *testing.T) {
	result, err := webSearchHandler(map[string]interface{}{"query": "  "})
	if err != nil {
		t.Fatalf("handler should return MCP result for tool errors: %v", err)
	}
	if !result.IsError || len(result.Content) == 0 || !strings.Contains(result.Content[0].Text, "query") {
		t.Fatalf("invalid query must be explicit: %+v", result)
	}
}

func TestLatestSearchProgressResultsKeepsFiveNewest(t *testing.T) {
	results := make([]shared.SearchResult, 7)
	for i := range results {
		results[i] = shared.SearchResult{Title: "title", URL: "https://example.com/" + strconv.Itoa(i), Engine: "engine"}
	}

	preview := latestSearchProgressResults(results)
	if len(preview) != 5 {
		t.Fatalf("progress preview should keep five results, got %d", len(preview))
	}
	if preview[0].URL != "https://example.com/6" || preview[4].URL != "https://example.com/2" {
		t.Fatalf("progress preview must be newest-first: %+v", preview)
	}
}

func TestWebSearchStatusHandlerReturnsStructuredUnknownEngine(t *testing.T) {
	result, err := webSearchStatusHandler(map[string]interface{}{
		"probe":   false,
		"engines": []interface{}{"missing-engine"},
	})
	if err != nil || result.IsError || len(result.Content) == 0 {
		t.Fatalf("status handler should return structured read-only result: result=%+v err=%v", result, err)
	}
	var statuses []struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(result.Content[0].Text), &statuses); err != nil {
		t.Fatalf("status result must be JSON: %v", err)
	}
	if len(statuses) != 1 || statuses[0].Status != "not_registered" {
		t.Fatalf("unknown engine status must be explicit: %+v", statuses)
	}
}

func TestWebFetchHandlerRejectsInvalidURLWithoutNetwork(t *testing.T) {
	result, err := webFetchHandler(map[string]interface{}{"url": "file:///etc/passwd"})
	if err != nil {
		t.Fatalf("handler should return MCP result for fetch errors: %v", err)
	}
	if !result.IsError || len(result.Content) == 0 || !strings.Contains(result.Content[0].Text, "URL") {
		t.Fatalf("invalid protocol must be explicit: %+v", result)
	}
}

func TestWebSearchHandlerRealKernelPath(t *testing.T) {
	if os.Getenv("WEBSEARCH_RUN_REAL_NETWORK") != "1" {
		t.Skip("set WEBSEARCH_RUN_REAL_NETWORK=1 to run the real kernel tool path")
	}
	proxy := strings.TrimSpace(os.Getenv("WEBSEARCH_TEST_PROXY"))
	if proxy == "" {
		t.Fatal("WEBSEARCH_TEST_PROXY must be set to the caller-provided proxy endpoint")
	}
	timeoutMs := 30000
	if rawTimeout := strings.TrimSpace(os.Getenv("WEBSEARCH_KERNEL_TIMEOUT_MS")); rawTimeout != "" {
		parsed, err := strconv.Atoi(rawTimeout)
		if err != nil || parsed <= 0 {
			t.Fatalf("WEBSEARCH_KERNEL_TIMEOUT_MS must be positive: %q", rawTimeout)
		}
		timeoutMs = parsed
	}
	expectTimeout := os.Getenv("WEBSEARCH_EXPECT_TIMEOUT") == "1"

	previousConf := model.Conf
	defer func() { model.Conf = previousConf }()

	appConf := model.NewAppConf()
	appConf.AI = conf.NewAI()
	appConf.AI.WebSearch.Enabled = true
	appConf.AI.WebSearch.Provider = "meta"
	appConf.AI.WebSearch.Proxy = proxy
	appConf.AI.WebSearch.MaxResults = 3
	appConf.AI.WebSearch.TimeoutMs = timeoutMs
	model.Conf = appConf

	started := time.Now()
	result, err := webSearchHandler(map[string]interface{}{
		"query":      "React 19 new features",
		"numResults": float64(3),
		"provider":   "meta",
		"engines":    []interface{}{"github"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.IsError || len(result.Content) == 0 {
		t.Fatalf("real kernel web_search failed after %s: %+v", time.Since(started), result)
	}

	var response shared.SearchResponse
	if err := json.Unmarshal([]byte(result.Content[0].Text), &response); err != nil {
		t.Fatalf("kernel tool returned invalid SearchResponse: %v; text=%s", err, result.Content[0].Text)
	}
	elapsed := time.Since(started)
	t.Logf("kernel web_search completed in %s with timeout=%dms: provider=%s results=%d errors=%d details=%v used=%v", elapsed, timeoutMs, response.Provider, len(response.Results), len(response.Errors), response.Errors, response.UsedEngines)
	if expectTimeout {
		if elapsed > time.Duration(timeoutMs+5000)*time.Millisecond {
			t.Fatalf("configured kernel timeout was not enforced: elapsed=%s timeout=%dms response=%+v", elapsed, timeoutMs, response)
		}
		return
	}
	if len(response.Results) == 0 {
		t.Fatalf("kernel web_search returned no results: %+v", response)
	}
}
