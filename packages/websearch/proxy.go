package websearch

import (
	"time"
)

// ── 代理配置 ──────────────────────────────────────────

// ProxyConfig 代理配置
// AutoDetect 与 HTTP/HTTPS 显式 URL 互斥（由调用方保证）
type ProxyConfig struct {
	HTTP       string // 显式 HTTP 代理 URL，如 "http://127.0.0.1:7890"
	HTTPS      string // 显式 HTTPS 代理 URL
	NoProxy    string // 不使用代理的地址列表
	AutoDetect bool   // 是否自动探测本地常见代理端口（与 HTTP/HTTPS 互斥）
}

// NewProxyConfig 创建空代理配置（不使用代理）
func NewProxyConfig() ProxyConfig {
	return ProxyConfig{}
}

// NewExplicitProxy 创建显式代理配置
func NewExplicitProxy(httpURL, httpsURL string) ProxyConfig {
	return ProxyConfig{HTTP: httpURL, HTTPS: httpsURL}
}

// NewAutoDetectProxy 创建自动探测代理配置
func NewAutoDetectProxy() ProxyConfig {
	return ProxyConfig{AutoDetect: true}
}

// ProbeCommonProxy 探测 127.0.0.1:7890 等常见代理地址是否可用
func ProbeCommonProxy() *ProxyConfig {
	candidates := []string{
		"http://127.0.0.1:7890",
		"http://127.0.0.1:1080",
		"http://127.0.0.1:1081",
		"http://127.0.0.1:8080",
	}

	for _, proxy := range candidates {
		client := NewHTTPClient(3 * time.Second)
		status, _, err := client.Get(proxy, map[string]string{})
		if err == nil && status < 500 {
			return &ProxyConfig{HTTP: proxy, HTTPS: proxy}
		}
	}
	return nil
}
