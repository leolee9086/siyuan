package websearch

import (
	"strings"
	"testing"
)

func TestIsSearchResultURLRejectsMalformedAndUnsafeValues(t *testing.T) {
	valid := []string{"https://example.com/path?q=one", "http://localhost:8080/result"}
	for _, value := range valid {
		if !IsSearchResultURL(value) {
			t.Fatalf("expected valid search URL: %q", value)
		}
	}
	invalid := []string{"", "javascript:alert(1)", "file:///tmp/result", "/relative", "https://", "https://example.com\nforged"}
	for _, value := range invalid {
		if IsSearchResultURL(value) {
			t.Fatalf("expected invalid search URL: %q", value)
		}
	}
}

func TestProtectSearchResponseUsesOpaqueReferences(t *testing.T) {
	response := &SearchResponse{
		Results: []AggregatedResult{{Title: "real https://example.com/title", URL: "https://example.com/article", Snippet: "Read https://example.com/related for more."}, {Title: "bad", URL: "javascript:alert(1)"}},
		Text:    "Source: https://example.com/article.",
	}

	ProtectSearchResponse(response)

	if len(response.LinkMap) != 3 {
		t.Fatalf("expected structured and text-field URLs in link map, got %+v", response.LinkMap)
	}
	if !strings.HasPrefix(response.Results[0].URL, "ref:web-") {
		t.Fatalf("result URL must be an opaque reference: %q", response.Results[0].URL)
	}
	if response.Results[1].URL != "" {
		t.Fatalf("invalid result URL must be removed: %q", response.Results[1].URL)
	}
	if strings.Contains(response.Text, "https://example.com/article") {
		t.Fatalf("text must not expose the original source URL: %q", response.Text)
	}
	if strings.Contains(response.Results[0].Title, "https://example.com/title") || strings.Contains(response.Results[0].Snippet, "https://example.com/related") {
		t.Fatalf("result text fields must not expose original source URLs: %+v", response.Results[0])
	}
}

func TestAggregateDropsMalformedSourceURLs(t *testing.T) {
	results := Aggregate([]SearchResult{
		{Title: "valid", URL: "https://example.com/valid", Engine: "fixture", Position: 1},
		{Title: "invalid", URL: "ref:web-forged", Engine: "fixture", Position: 2},
	}, &AggregateContext{MaxResults: 5}, "valid")
	if len(results) != 1 || results[0].Title != "valid" {
		t.Fatalf("malformed source URL should be filtered: %+v", results)
	}
}
