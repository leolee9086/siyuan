package websearch

import (
	"os"
	"strconv"
	"strings"
)

// WebSearchProvider 搜索提供商类型
type WebSearchProvider string

const (
	ProviderDuckDuckGo WebSearchProvider = "duckduckgo"
	ProviderExa        WebSearchProvider = "exa"
	ProviderParallel   WebSearchProvider = "parallel"
)

// SelectProvider 选择搜索提供商
func SelectProvider(sessionID string, flags struct{ Exa, Parallel bool }) WebSearchProvider {
	override := os.Getenv("OPENCODE_WEBSEARCH_PROVIDER")
	switch override {
	case "exa":
		return ProviderExa
	case "parallel":
		return ProviderParallel
	case "duckduckgo":
		return ProviderDuckDuckGo
	}

	if flags.Parallel {
		return ProviderParallel
	}
	if flags.Exa {
		return ProviderExa
	}
	return ProviderDuckDuckGo
}

// ProviderAvailable 检查提供商是否有可用的 API key
func ProviderAvailable(provider WebSearchProvider) bool {
	switch provider {
	case ProviderParallel:
		return os.Getenv("PARALLEL_API_KEY") != ""
	case ProviderExa:
		return os.Getenv("EXA_API_KEY") != ""
	case ProviderDuckDuckGo:
		return true // 无需 API key
	}
	return false
}

// ProviderLabel 返回提供商的中文标签
func ProviderLabel(provider WebSearchProvider) string {
	switch provider {
	case ProviderDuckDuckGo:
		return "DuckDuckGo 网络搜索"
	case ProviderParallel:
		if env := os.Getenv("PARALLEL_API_KEY"); env != "" {
			return "Parallel 网络搜索"
		}
		return "Parallel 网络搜索（未配置 API key）"
	case ProviderExa:
		if env := os.Getenv("EXA_API_KEY"); env != "" {
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
