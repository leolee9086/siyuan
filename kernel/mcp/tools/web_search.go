// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package tools

import (
	"encoding/json"
	"strings"

	kernelwebsearch "github.com/siyuan-note/siyuan/kernel/websearch"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

var WebSearchTool = &Tool{
	Name:        "web_search",
	Description: "Search the web using configured local engines or Exa/Parallel. Supports query type, time range, language, provider, and explicit engine selection.",
	InputSchema: ToolSchema{
		Type: "object",
		Properties: map[string]Property{
			"query":      {Type: "string", Description: "Search query keywords"},
			"numResults": {Type: "number", Description: "Number of results, default 8, maximum 50"},
			"queryType":  {Type: "string", Description: "general, code, news, academic, social, video, or shopping"},
			"timeRange":  {Type: "string", Description: "day, week, month, or year"},
			"lang":       {Type: "string", Description: "Preferred language or locale"},
			"provider":   {Type: "string", Description: "auto, meta, exa, or parallel"},
			"searchType": {Type: "string", Description: "auto, fast, or deep"},
			"livecrawl":  {Type: "boolean", Description: "Request live crawling for Exa"},
			"engines":    {Type: "array", Description: "Optional explicit engine names", Items: &Property{Type: "string"}},
		},
		Required: []string{"query"},
	},
	Handler: webSearchHandler,
}

func init() {
	register(WebSearchTool)
}

func webSearchHandler(args map[string]interface{}) (CallToolResult, error) {
	query, _ := args["query"].(string)
	opts := shared.DefaultSearchOptions()
	opts.NumResults = intArg(args, "numResults", opts.NumResults)
	opts.QueryType, _ = args["queryType"].(string)
	opts.TimeRange, _ = args["timeRange"].(string)
	opts.Lang, _ = args["lang"].(string)
	opts.Provider = shared.WebSearchProvider(webSearchStringArg(args, "provider"))
	opts.SearchType = webSearchStringArg(args, "searchType")
	if livecrawl, ok := args["livecrawl"].(bool); ok {
		opts.Livecrawl = livecrawl
	}
	opts.Engines = stringSliceArg(args["engines"])

	response, err := kernelwebsearch.NewService().Search(query, opts, nil)
	if err != nil {
		return CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "web_search error: " + err.Error()}},
			IsError: true,
		}, nil
	}

	data, marshalErr := json.Marshal(response)
	if marshalErr != nil {
		return CallToolResult{Content: []ContentItem{{Type: "text", Text: "web_search error: " + marshalErr.Error()}}, IsError: true}, nil
	}
	return CallToolResult{Content: []ContentItem{{Type: "text", Text: string(data)}}}, nil
}

func intArg(args map[string]interface{}, key string, fallback int) int {
	value, ok := args[key].(float64)
	if !ok || value <= 0 {
		return fallback
	}
	if value > 50 {
		return 50
	}
	return int(value)
}

func webSearchStringArg(args map[string]interface{}, key string) string {
	value, _ := args[key].(string)
	return strings.TrimSpace(value)
}

func stringSliceArg(value interface{}) []string {
	values, ok := value.([]interface{})
	if !ok {
		return nil
	}
	result := make([]string, 0, len(values))
	for _, item := range values {
		if value, ok := item.(string); ok && strings.TrimSpace(value) != "" {
			result = append(result, strings.TrimSpace(value))
		}
	}
	return result
}
