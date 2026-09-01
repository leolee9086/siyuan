// SiYuan - From thought to insight, with agents
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

	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var WebFetchTool = &Tool{
	Name:        "web_fetch",
	Description: "Fetch a web page and return markdown, text, or HTML. The tool is read-only and enforces HTTP(S), SSRF, MIME, size, and timeout limits.",
	InputSchema: ToolSchema{
		Type: "object",
		Properties: map[string]Property{
			"url":     {Type: "string", Description: "The page URL to fetch (must start with http:// or https://)"},
			"format":  {Type: "string", Description: "Output format: markdown, text, or html (default markdown)", Enum: []string{"markdown", "text", "html"}},
			"timeout": {Type: "number", Description: "Timeout in seconds, default 30, maximum 120"},
		},
		Required: []string{"url"},
	},
	Handler: webFetchHandler,
}

func init() {
	register(WebFetchTool)
}

func webFetchHandler(args map[string]any) (CallToolResult, error) {
	rawURL, _ := args["url"].(string)
	format, _ := args["format"].(string)
	timeout := 0
	if value, ok := args["timeout"].(float64); ok {
		timeout = int(value)
	}

	proxyURL := ""
	if model.Conf != nil {
		proxyURL = conf.EffectiveProxyURL(model.Conf.System)
	}
	result, err := util.FetchWebPage(rawURL, util.WebFetchOptions{Format: format, TimeoutSeconds: timeout, ProxyURL: proxyURL})
	if err != nil {
		return CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "web_fetch error: " + err.Error()}},
			IsError: true,
		}, nil
	}

	data, marshalErr := json.Marshal(result)
	if marshalErr != nil {
		return CallToolResult{Content: []ContentItem{{Type: "text", Text: "web_fetch error: " + marshalErr.Error()}}, IsError: true}, nil
	}
	return CallToolResult{Content: []ContentItem{{Type: "text", Text: string(data)}}}, nil
}
