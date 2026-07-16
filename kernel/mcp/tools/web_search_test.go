package tools

import (
	"encoding/json"
	"strings"
	"testing"
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
