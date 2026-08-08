package main

import (
	"encoding/json"
	"strings"

	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

// webSearchTool 暴露覆盖全部配置提供方（本地元搜索、Exa、Parallel）的
// 一次性搜索。参数面与 s-forge 内核暴露的工具保持一致，MCP 客户端可以
// 复用相同的调用形状。
func (s *Server) webSearchTool() *Tool {
	return &Tool{
		Name:        "web_search",
		Description: "Search the web using 100+ local engines or Exa/Parallel. Supports query type, time range, language, provider, and explicit engine selection.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"query":      map[string]any{"type": "string", "description": "Search query keywords"},
				"numResults": map[string]any{"type": "number", "description": "Number of results, default 300"},
				"queryType":  map[string]any{"type": "string", "description": "general, code, news, academic, social, video, or shopping"},
				"timeRange":  map[string]any{"type": "string", "description": "day, week, month, or year"},
				"lang":       map[string]any{"type": "string", "description": "Preferred language or locale"},
				"provider":   map[string]any{"type": "string", "description": "auto, meta, exa, or parallel"},
				"searchType": map[string]any{"type": "string", "description": "auto, fast, or deep"},
				"livecrawl":  map[string]any{"type": "boolean", "description": "Request live crawling for Exa"},
				"engines":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Optional explicit engine names"},
			},
			"required": []any{"query"},
		},
		Handler: s.handleWebSearch,
	}
}

func (s *Server) handleWebSearch(args map[string]any) (CallToolResult, error) {
	query, _ := args["query"].(string)
	query = strings.TrimSpace(query)
	if query == "" {
		return CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "web_search error: query is required"}},
			IsError: true,
		}, nil
	}
	opts := shared.DefaultSearchOptions()
	opts.NumResults = intArg(args, "numResults", opts.NumResults)
	opts.QueryType = stringArg(args, "queryType")
	opts.TimeRange = stringArg(args, "timeRange")
	opts.Lang = stringArg(args, "lang")
	opts.Provider = shared.WebSearchProvider(stringArg(args, "provider"))
	opts.SearchType = stringArg(args, "searchType")
	opts.Livecrawl, _ = args["livecrawl"].(bool)
	opts.Engines = stringSliceArg(args["engines"])

	response, err := s.searchFn(query, opts)
	if err != nil {
		return CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "web_search error: " + err.Error()}},
			IsError: true,
		}, nil
	}
	if s.protect {
		shared.ProtectSearchResponse(&response)
	}
	data, marshalErr := json.Marshal(response)
	if marshalErr != nil {
		return CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "web_search error: " + marshalErr.Error()}},
			IsError: true,
		}, nil
	}
	return CallToolResult{Content: []ContentItem{{Type: "text", Text: string(data)}}}, nil
}

// webSearchStatusTool 上报引擎健康、凭据就绪、速率限制与缓存统计；
// 除非调用方要求真实探测，否则不触发网络访问。
func (s *Server) webSearchStatusTool() *Tool {
	return &Tool{
		Name:        "web_search_status",
		Description: "Inspect web search engine health, credentials readiness, rate limiting and cache state.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"engines": map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "Optional engine names; default all engines"},
				"probe":   map[string]any{"type": "boolean", "description": "Live-probe engines (makes network requests); default false"},
				"query":   map[string]any{"type": "string", "description": "Query used for probes; default 'test search'"},
			},
		},
		Handler: s.handleWebSearchStatus,
	}
}

func (s *Server) handleWebSearchStatus(args map[string]any) (CallToolResult, error) {
	names := stringSliceArg(args["engines"])
	probe, _ := args["probe"].(bool)
	query := stringArg(args, "query")
	if query == "" {
		query = "test search"
	}
	var diagnostics []shared.EngineDiagnostic
	if s.statusFn != nil {
		diagnostics = s.statusFn(names, probe, query)
	}
	status := map[string]any{
		"engines":     diagnostics,
		"rateLimiter": shared.GlobalRateLimiter.GetStatus(),
		"cache": map[string]any{
			"size":    shared.GlobalResultCache.Size(),
			"hitRate": shared.GlobalResultCache.HitRate(),
		},
	}
	data, err := json.Marshal(status)
	if err != nil {
		return CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "web_search_status error: " + err.Error()}},
			IsError: true,
		}, nil
	}
	return CallToolResult{Content: []ContentItem{{Type: "text", Text: string(data)}}}, nil
}

// ── 参数辅助函数 ──────────────────────────────────────

func intArg(args map[string]any, key string, fallback int) int {
	value, ok := args[key].(float64)
	if !ok || value <= 0 {
		return fallback
	}
	return int(value)
}

func stringArg(args map[string]any, key string) string {
	value, _ := args[key].(string)
	return strings.TrimSpace(value)
}

func stringSliceArg(value any) []string {
	values, ok := value.([]any)
	if !ok {
		return nil
	}
	var out []string
	for _, item := range values {
		if s, ok := item.(string); ok {
			if s = strings.TrimSpace(s); s != "" {
				out = append(out, s)
			}
		}
	}
	return out
}
