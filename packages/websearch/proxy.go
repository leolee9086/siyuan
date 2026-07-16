package websearch

// ── 代理配置 ──────────────────────────────────────────

// ProxyConfig 代理配置
// AutoDetect 与 HTTP/HTTPS 显式 URL 互斥（由调用方保证）
type ProxyConfig struct {
	HTTP       string // 显式 HTTP 代理 URL，由调用方传入
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

// NewAutoDetectProxy 保留用于兼容旧调用方，但运行时会明确拒绝自动探测。
func NewAutoDetectProxy() ProxyConfig {
	return ProxyConfig{AutoDetect: true}
}
