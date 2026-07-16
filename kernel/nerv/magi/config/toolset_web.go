package config

const (
	// SearchWebToolName MAGI 网页搜索工具名。
	SearchWebToolName = "search_web"
	// InspectWebSearchEnginesToolName MAGI 网页搜索引擎诊断工具名。
	InspectWebSearchEnginesToolName = "inspect_web_search_engines"
)

// BuildSearchWebToolDef 构建 MAGI 独立网页搜索工具定义。
func BuildSearchWebToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        SearchWebToolName,
			Description: "使用已配置的本地多引擎、Exa 或 Parallel 搜索真实网络。该工具只读取外部信息，不触发行动治理。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "要搜索的关键词或问题",
					},
					"numResults": map[string]interface{}{
						"type":        "integer",
						"description": "返回结果数量，默认 8，最大 50",
						"minimum":     1,
						"maximum":     50,
					},
					"queryType": map[string]interface{}{
						"type":        "string",
						"description": "查询类型：general、code、news、academic、social、video 或 shopping",
					},
					"timeRange": map[string]interface{}{
						"type":        "string",
						"description": "时间范围：day、week、month 或 year",
					},
					"lang": map[string]interface{}{
						"type":        "string",
						"description": "首选语言或地区，例如 zh-CN、en",
					},
					"provider": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"auto", "meta", "exa", "parallel"},
						"description": "搜索提供商；auto 按凭据和本地引擎自动选择",
					},
					"searchType": map[string]interface{}{
						"type":        "string",
						"enum":        []string{"auto", "fast", "deep"},
						"description": "搜索深度",
					},
					"livecrawl": map[string]interface{}{
						"type":        "boolean",
						"description": "请求 Exa 优先实时抓取",
					},
					"engines": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "可选的显式引擎名称列表",
					},
				},
				"required": []string{"query"},
			},
		},
		Meta: ToolMeta{
			ReadsWebContent:      true,
			AvailableDirectReply: true,
			AvailableWorkHB:      true,
			EntersUnifiedContext: true,
			ResultArchived:       true,
		},
	}
}

// BuildInspectWebSearchEnginesToolDef 构建 MAGI 网页搜索引擎诊断工具定义。
func BuildInspectWebSearchEnginesToolDef() ToolDef {
	return ToolDef{
		Type: "function",
		Function: ToolFunctionDef{
			Name:        InspectWebSearchEnginesToolName,
			Description: "查看已注册搜索引擎的凭据、健康状态和可选的真实网络探测结果。该工具只读，不触发行动治理。",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"probe": map[string]interface{}{
						"type":        "boolean",
						"description": "是否对可用引擎执行真实的一条结果网络探测",
					},
					"query": map[string]interface{}{
						"type":        "string",
						"description": "探测查询，默认使用 test search",
					},
					"engines": map[string]interface{}{
						"type":        "array",
						"items":       map[string]interface{}{"type": "string"},
						"description": "可选的显式引擎名称列表",
					},
				},
			},
		},
		Meta: ToolMeta{
			ReadsWebContent:      true,
			AvailableDirectReply: true,
			AvailableWorkHB:      true,
			EntersUnifiedContext: true,
			ResultArchived:       true,
		},
	}
}
