// Package websearch 提供完整的元搜索引擎功能。
//
// 移植自 opencode 的 websearch 实现（SearXNG 风格元搜索引擎），
// 包含 100+ 搜索引擎适配器、结果聚合去重、双层缓存、速率限制、
// 熔断器、查询意图检测、购物比价等功能。
//
// 架构：
// - 核心引擎逻辑为纯 Go 包，不依赖外部框架
// - 通过 MCP 接口暴露，兼容 s-forge、s-code 及任何 MCP 客户端
// - 引擎注册表支持热插拔，新增引擎无需修改核心逻辑
package websearch

import (
	"fmt"
	"time"
)

const Version = "1.0.0"

var Description = fmt.Sprintf(`多引擎元搜索：同时搜索 100+ 个引擎，自动去重、评分、排序。
内置 DuckDuckGo + Bing + Brave 等搜索引擎，无需 API key 即可开箱即用。
支持时间范围过滤、语言偏好、新闻/视频/学术/代码/购物等专用搜索模式。
引擎熔断器采用指数退避算法，引擎级速率限制，User-Agent 轮换。
双层缓存（内存 + SQLite），结果去重合并，域名多样性保证。
当前年份是 %d。`, time.Now().Year())

// WebSearch 一键搜索接口：选择引擎 -> 并发执行 -> 聚合 -> 格式化
func WebSearch(query string, opts SearchOptions, engines []SearchEngine, onProgress ProgressCallback) (string, error) {
	if engines == nil {
		engines = SelectEngines(nil)
	}
	if len(engines) == 0 {
		return "无可用的搜索引擎。请检查网络连接或配置。", nil
	}
	result := ExecuteAll(engines, query, opts, GlobalExecutorState, onProgress)
	if len(result.Results) == 0 {
		return "未找到搜索结果。请尝试其他查询词。", nil
	}
	aggregated := Aggregate(result.Results, &AggregateContext{
		Weights:    make(map[string]float64),
		MaxResults: opts.NumResults,
	}, query)
	return FormatResults(aggregated, query, ""), nil
}
