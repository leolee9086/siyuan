package tools

import (
	"encoding/json"

	kernelwebsearch "github.com/siyuan-note/siyuan/kernel/websearch"
)

var WebSearchStatusTool = &Tool{
	Name:        "web_search_status",
	Description: "Inspect configured web search engines and optionally run a real one-result probe. Read-only.",
	InputSchema: ToolSchema{
		Type: "object",
		Properties: map[string]Property{
			"probe":   {Type: "boolean", Description: "Run a real network probe for each selected engine"},
			"query":   {Type: "string", Description: "Probe query, default test search"},
			"engines": {Type: "array", Description: "Optional engine names", Items: &Property{Type: "string"}},
		},
	},
	Handler: webSearchStatusHandler,
}

func init() {
	register(WebSearchStatusTool)
}

func webSearchStatusHandler(args map[string]interface{}) (CallToolResult, error) {
	probe, _ := args["probe"].(bool)
	query, _ := args["query"].(string)
	status := kernelwebsearch.NewService().Diagnose(stringSliceArg(args["engines"]), probe, query)
	data, err := json.Marshal(status)
	if err != nil {
		return CallToolResult{Content: []ContentItem{{Type: "text", Text: "web_search_status error: " + err.Error()}}, IsError: true}, nil
	}
	return CallToolResult{Content: []ContentItem{{Type: "text", Text: string(data)}}}, nil
}
