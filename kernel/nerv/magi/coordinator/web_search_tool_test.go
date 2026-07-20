package coordinator

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestWebSearchToolResultExecutor_HandlesOnlyWebSearchTools(t *testing.T) {
	executor := newWebSearchToolResultExecutor()
	result, handled, err := executor.ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{Name: config.NoteKeywordSearchToolName},
	})
	if err != nil || handled || result != "" {
		t.Fatalf("unexpected handling of unrelated tool: result=%q handled=%v err=%v", result, handled, err)
	}
}

func TestWebSearchToolResultExecutor_RejectsEmptySearchQuery(t *testing.T) {
	executor := newWebSearchToolResultExecutor()
	result, handled, err := executor.ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.SearchWebToolName,
			Arguments: `{"purpose":"验证空搜索词拒绝","query":"  "}`,
		},
	})
	if !handled || err == nil || result != "" {
		t.Fatalf("expected explicit empty-query error: result=%q handled=%v err=%v", result, handled, err)
	}
	if !strings.Contains(err.Error(), "query") {
		t.Fatalf("expected query error, got %v", err)
	}
}

func TestWebSearchReferenceMetadataRejectsUntrustedTargets(t *testing.T) {
	meta := webSearchMetaFromResult(`{"linkMap":{"ref:web-good":"https://example.com/source","ref:web-bad":"javascript:alert(1)","fake":"https://example.com/fake"}}`)
	if meta == nil {
		t.Fatal("expected trusted web search metadata")
	}
	links, ok := meta[webSearchLinksMetaKey].(map[string]string)
	if !ok || len(links) != 1 || links["ref:web-good"] != "https://example.com/source" {
		t.Fatalf("unexpected trusted link metadata: %+v", meta)
	}
}

func TestWebSearchToolResultExecutor_InspectsExplicitEnginesWithoutProbe(t *testing.T) {
	executor := newWebSearchToolResultExecutor()
	result, handled, err := executor.ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.InspectWebSearchEnginesToolName,
			Arguments: `{"purpose":"检查搜索引擎状态","engines":["nvd","nvd","missing-engine"],"probe":false}`,
		},
	})
	if err != nil || !handled {
		t.Fatalf("diagnosis should be local and explicit: handled=%v err=%v", handled, err)
	}
	var statuses []struct {
		Name   string `json:"name"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal([]byte(result), &statuses); err != nil {
		t.Fatalf("diagnosis must be valid JSON: %v; result=%s", err, result)
	}
	if len(statuses) != 2 {
		t.Fatalf("expected two unique explicit engine statuses, got %d", len(statuses))
	}
	for _, status := range statuses {
		if status.Name == "missing-engine" && status.Status != "not_registered" {
			t.Fatalf("unknown engine must be explicit, got %+v", status)
		}
	}
}

func TestWebSearchHistorySummaryKeepsQueryAndDropsDetailedResults(t *testing.T) {
	call := types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.SearchWebToolName,
			Arguments: `{"purpose":"查找 Go 发布信息","query":"Go release","provider":"meta","engines":["nvd"]}`,
		},
	}
	summary := buildWebSearchHistorySummary(call, "查找版本信息", `{"provider":"meta","results":[{"title":"one"},{"title":"two"}],"usedEngines":["nvd"],"noResults":false}`, nil)
	query, ok := summary["query"].(map[string]interface{})
	if !ok || query["query"] != "Go release" {
		t.Fatalf("query parameters missing from summary: %+v", summary)
	}
	if summary["resultCount"] != 2 || summary["usedEngines"].([]string)[0] != "nvd" {
		t.Fatalf("compact result metadata missing: %+v", summary)
	}
}

func TestMAGIWebToolsArePresentInVoteAndHeartbeatReadingSets(t *testing.T) {
	want := map[string]bool{
		config.SearchWebToolName:               false,
		config.FetchWebPageToolName:            false,
		config.InspectWebSearchEnginesToolName: false,
	}
	for _, tool := range buildVoteInvestigationTools() {
		if _, ok := want[tool.Function.Name]; ok {
			want[tool.Function.Name] = true
		}
	}
	for name, found := range want {
		if !found {
			t.Fatalf("vote investigation tools missing %s", name)
		}
	}

	for key := range want {
		want[key] = false
	}
	for _, tool := range buildHeartbeatReadingRuntimeTools() {
		if _, ok := want[tool.Function.Name]; ok {
			want[tool.Function.Name] = true
		}
	}
	for name, found := range want {
		if !found {
			t.Fatalf("heartbeat reading tools missing %s", name)
		}
	}
}

func TestMAGIWebFetchUsesStructuredProtocolFailure(t *testing.T) {
	executor := newWebFetchToolResultExecutor()
	result, handled, err := executor.ExecuteToolCall(types.ToolCall{
		Function: types.ToolCallFunction{
			Name:      config.FetchWebPageToolName,
			Arguments: `{"purpose":"验证不支持的网页协议","url":"file:///etc/passwd"}`,
		},
	})
	if err != nil || !handled {
		t.Fatalf("fetch protocol failure must be a handled JSON result: handled=%v err=%v", handled, err)
	}
	var payload fetchWebPageResultPayload
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		t.Fatalf("fetch failure must be JSON: %v", err)
	}
	if payload.OK || payload.ErrorCode != "UNSUPPORTED_PROTOCOL" {
		t.Fatalf("fetch failure must preserve existing protocol fields: %+v", payload)
	}
}

func TestMAGIWebSearchArchiveCalloutContainsQueryAndResultCount(t *testing.T) {
	callout := buildWebSearchArchiveCallout(
		types.ToolCall{Function: types.ToolCallFunction{
			Name:      config.SearchWebToolName,
			Arguments: `{"purpose":"查找发布说明","query":"release notes","provider":"meta"}`,
		}},
		"检索发布说明",
		`{"provider":"meta","results":[{},{}],"usedEngines":["nvd"]}`,
		"2026-07-16T23:00:00+08:00",
	)
	if !strings.Contains(callout, "release notes") || !strings.Contains(callout, "结果数") || !strings.Contains(callout, "2") {
		t.Fatalf("search archive callout lost query metadata: %s", callout)
	}
}
