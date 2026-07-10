package websearch

import (
	"os"
	"time"
)

// ── 代理检测 ──────────────────────────────────────────

// ProxyConfig 代理配置
type ProxyConfig struct {
	HTTP    string
	HTTPS   string
	NoProxy string
}

// DetectProxyFromEnv 从环境变量检测代理配置
func DetectProxyFromEnv() ProxyConfig {
	httpProxy := os.Getenv("HTTP_PROXY")
	if httpProxy == "" {
		httpProxy = os.Getenv("http_proxy")
	}
	httpsProxy := os.Getenv("HTTPS_PROXY")
	if httpsProxy == "" {
		httpsProxy = os.Getenv("https_proxy")
	}
	allProxy := os.Getenv("ALL_PROXY")
	if allProxy == "" {
		allProxy = os.Getenv("all_proxy")
	}
	noProxy := os.Getenv("NO_PROXY")
	if noProxy == "" {
		noProxy = os.Getenv("no_proxy")
	}

	config := ProxyConfig{NoProxy: noProxy}
	if httpProxy != "" {
		config.HTTP = httpProxy
	} else if allProxy != "" {
		config.HTTP = allProxy
	}
	if httpsProxy != "" {
		config.HTTPS = httpsProxy
	} else if allProxy != "" {
		config.HTTPS = allProxy
	}
	return config
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

// GetProxyConfig 获取代理配置：优先环境变量
func GetProxyConfig() ProxyConfig {
	envProxy := DetectProxyFromEnv()
	if envProxy.HTTP != "" || envProxy.HTTPS != "" {
		return envProxy
	}
	return ProxyConfig{}
}

// ApplyProxyEnv 将代理配置应用到 HTTP 客户端
func ApplyProxyEnv(config ProxyConfig, client *HTTPClient) {
	if config.HTTP != "" {
		_ = client.SetProxy(config.HTTP)
	}
}
