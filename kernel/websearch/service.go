// Package websearch adapts the shared websearch module to SiYuan runtime
// configuration. Native Agent and MAGI intentionally call this adapter from
// their own tool executors, preserving their separate governance models.
package websearch

import (
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

type DiagnosticProgress = shared.DiagnosticProgress
type DiagnosticProgressCallback = shared.DiagnosticProgressCallback

func NewService() *shared.Service {
	return shared.NewService(RuntimeConfig())
}

func RuntimeConfig() shared.RuntimeConfig {
	config := shared.RuntimeConfig{
		Enabled:        true,
		Provider:       shared.ProviderAuto,
		DefaultOptions: shared.DefaultSearchOptions(),
		Engines:        map[string]shared.EngineRuntimeConfig{},
	}
	if model.Conf == nil {
		return config
	}
	proxyURL := conf.EffectiveProxyURL(model.Conf.System)
	if strings.TrimSpace(proxyURL) == "" {
		// 对齐 s-code proxy.ts probeCommonProxy：系统未配置代理时自动探测本地常见端口
		proxyURL = detectLocalProxy()
	}
	config.Proxy = shared.NewExplicitProxy(proxyURL, proxyURL)
	if model.Conf.AI == nil {
		return config
	}
	settings := model.Conf.AI.WebSearch
	if settings == nil {
		return config
	}
	config.Enabled = settings.Enabled
	config.Provider = shared.WebSearchProvider(strings.TrimSpace(settings.Provider))
	config.TimeoutMs = settings.TimeoutMs
	config.ExaAPIKey = settings.ExaAPIKey
	config.ParallelAPIKey = settings.ParallelAPIKey
	config.DefaultOptions.NumResults = settings.MaxResults
	config.DefaultOptions.Lang = settings.Lang
	config.DefaultOptions.QueryType = settings.QueryType
	config.DefaultOptions.Provider = config.Provider
	proxyURL = conf.EffectiveProxyURLWithOverride(model.Conf.System, settings.Proxy)
	if strings.TrimSpace(proxyURL) == "" {
		proxyURL = detectLocalProxy()
	}
	config.Proxy = shared.NewExplicitProxy(proxyURL, proxyURL)
	for name, engine := range settings.Engines {
		if engine == nil {
			continue
		}
		config.Engines[name] = shared.EngineRuntimeConfig{
			Enabled:    engine.Enabled,
			APIKey:     engine.APIKey,
			BaseURL:    engine.BaseURL,
			TimeoutMs:  engine.TimeoutMs,
			MaxResults: engine.MaxResults,
			Weight:     engine.Weight,
			Priority:   engine.Priority,
			Headers:    cloneHeaders(engine.Headers),
		}
	}
	return config
}

func cloneHeaders(headers map[string]string) map[string]string {
	if len(headers) == 0 {
		return nil
	}
	result := make(map[string]string, len(headers))
	for key, value := range headers {
		result[key] = value
	}
	return result
}

// 本地代理探测缓存：进程内只探测一次（探测最坏耗时 = 候选数 × 5s）
var (
	detectedProxyOnce sync.Once
	detectedProxyURL  string
)

// detectLocalProxy 在系统未配置代理时自动探测本地常见代理端口。
// 对齐 s-code proxy.ts probeCommonProxy（127.0.0.1:7890 等）。
// 仅当候选端口确实能通过其访问外网时才采用，避免把不可用端口当作代理。
func detectLocalProxy() string {
	detectedProxyOnce.Do(func() {
		detectedProxyURL = probeLocalProxyCandidates()
	})
	return detectedProxyURL
}

func probeLocalProxyCandidates() string {
	candidates := []string{
		"http://127.0.0.1:7890",
		"http://127.0.0.1:1080",
		"http://127.0.0.1:1081",
		"http://127.0.0.1:8080",
	}
	for _, proxyURL := range candidates {
		if proxyReachable(proxyURL) {
			return proxyURL
		}
	}
	return ""
}

// proxyReachable 通过候选代理发起快速 HTTPS 请求验证连通性。
// generate_204 是 Google 的轻量连通性探测端点（返回 204）。
func proxyReachable(proxyURL string) bool {
	parsed, err := url.Parse(proxyURL)
	if err != nil {
		return false
	}
	transport := &http.Transport{Proxy: http.ProxyURL(parsed)}
	client := &http.Client{Transport: transport, Timeout: 5 * time.Second}
	resp, err := client.Get("https://www.gstatic.com/generate_204")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}
