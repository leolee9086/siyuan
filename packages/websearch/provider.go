package websearch

import (
	"strconv"
	"strings"
)

// WebSearchProvider 搜索提供商类型
type WebSearchProvider string

const (
	ProviderAuto       WebSearchProvider = "auto"
	ProviderMeta       WebSearchProvider = "meta"
	ProviderDuckDuckGo WebSearchProvider = "duckduckgo"
	ProviderExa        WebSearchProvider = "exa"
	ProviderParallel   WebSearchProvider = "parallel"
)

// SelectProvider 选择搜索提供商
func SelectProvider(sessionID string, flags struct{ Exa, Parallel bool }) WebSearchProvider {
	if flags.Parallel {
		return ProviderParallel
	}
	if flags.Exa {
		return ProviderExa
	}
	return ProviderMeta
}

// ProviderAvailable 检查提供商是否有可用的 API key。运行时凭据必须由
// 配置层显式传入，websearch 不再读取环境变量。
func ProviderAvailable(provider WebSearchProvider, exaAPIKey, parallelAPIKey string) bool {
	switch provider {
	case ProviderParallel:
		return strings.TrimSpace(parallelAPIKey) != ""
	case ProviderExa:
		return strings.TrimSpace(exaAPIKey) != ""
	case ProviderAuto, ProviderMeta, ProviderDuckDuckGo:
		return true
	}
	return false
}

// ProviderLabel 返回提供商的中文标签
func ProviderLabel(provider WebSearchProvider, exaAPIKey, parallelAPIKey string) string {
	switch provider {
	case ProviderAuto:
		return "自动网络搜索"
	case ProviderMeta:
		return "本地多引擎网络搜索"
	case ProviderDuckDuckGo:
		return "DuckDuckGo 网络搜索"
	case ProviderParallel:
		if strings.TrimSpace(parallelAPIKey) != "" {
			return "Parallel 网络搜索"
		}
		return "Parallel 网络搜索（未配置 API key）"
	case ProviderExa:
		if strings.TrimSpace(exaAPIKey) != "" {
			return "Exa 网络搜索"
		}
		return "Exa 网络搜索（未配置 API key）"
	}
	return "网络搜索"
}

// FormatRateLimiterStatus 格式化速率限制器状态
func FormatRateLimiterStatus() string {
	status := GlobalRateLimiter.GetStatus()
	if len(status) == 0 {
		return ""
	}
	parts := make([]string, 0, len(status))
	for engine, s := range status {
		parts = append(parts, engine+":"+strconv.FormatInt(s.LastCallAgo/1000, 10)+"s前/间隔"+strconv.FormatInt(s.Interval, 10)+"ms")
	}
	return strings.Join(parts, " ")
}
