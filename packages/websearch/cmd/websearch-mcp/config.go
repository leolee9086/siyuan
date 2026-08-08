package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

// Config 是独立 MCP server 的运行时配置。
//
// websearch 包刻意不读环境变量（凭据与代理必须通过 RuntimeConfig 显式
// 传入），因此本服务在进程边界读取配置并组装交给 shared.NewService 的
// RuntimeConfig。
//
// 优先级（从高到低）：命令行 flags > 环境变量 > 可选 JSON 配置文件 > 包默认值。
type Config struct {
	Enabled        bool
	Provider       shared.WebSearchProvider
	TimeoutMs      int
	ExaAPIKey      string
	ParallelAPIKey string
	Proxy          shared.ProxyConfig
	DefaultOptions shared.SearchOptions
	Engines        map[string]shared.EngineRuntimeConfig

	HTTPAddr    string
	LogLevel    string
	ProtectURLs bool
	ShowVersion bool
}

// fileConfig 与 RuntimeConfig 同构（带 JSON 标签），供可选的 -config 文件使用。
type fileConfig struct {
	Enabled        *bool                        `json:"enabled"`
	Provider       string                       `json:"provider"`
	TimeoutMs      int                          `json:"timeoutMs"`
	ExaAPIKey      string                       `json:"exaApiKey"`
	ParallelAPIKey string                       `json:"parallelApiKey"`
	Proxy          *fileProxy                   `json:"proxy"`
	DefaultOptions *fileSearchOptions           `json:"defaultOptions"`
	Engines        map[string]fileEngineRuntime `json:"engines"`
}

type fileProxy struct {
	HTTP    string `json:"http"`
	HTTPS   string `json:"https"`
	NoProxy string `json:"noProxy"`
}

type fileSearchOptions struct {
	NumResults int    `json:"numResults"`
	SafeSearch int    `json:"safeSearch"`
	TimeRange  string `json:"timeRange"`
	Lang       string `json:"lang"`
	Livecrawl  bool   `json:"livecrawl"`
	QueryType  string `json:"queryType"`
	SearchType string `json:"searchType"`
}

type fileEngineRuntime struct {
	Enabled    bool              `json:"enabled"`
	APIKey     string            `json:"apiKey"`
	BaseURL    string            `json:"baseUrl"`
	TimeoutMs  int               `json:"timeoutMs"`
	MaxResults int               `json:"maxResults"`
	Weight     float64           `json:"weight"`
	Priority   int               `json:"priority"`
	Headers    map[string]string `json:"headers"`
}

func loadConfig(args []string) (*Config, error) {
	cfg := &Config{
		Enabled:        true,
		LogLevel:       "info",
		DefaultOptions: shared.DefaultSearchOptions(),
		Engines:        map[string]shared.EngineRuntimeConfig{},
	}

	fs := flag.NewFlagSet("websearch-mcp", flag.ContinueOnError)
	var (
		configPath string
		numResults int
		timeoutMs  int
		proxyURL   string
		noProxy    string
		keysJSON   string
		disabled   bool
	)
	fs.StringVar(&configPath, "config", "", "path to a JSON config file (schema mirrors RuntimeConfig)")
	fs.StringVar(&cfg.HTTPAddr, "http-addr", "", "serve streamable HTTP on this address (e.g. :8080); empty runs stdio")
	fs.StringVar(&cfg.LogLevel, "log", "info", "log level: debug, info, warn, error")
	fs.IntVar(&numResults, "num-results", 0, "default number of aggregated results (default 300)")
	fs.IntVar(&timeoutMs, "timeout-ms", 0, "per-engine timeout in milliseconds (default 15000)")
	fs.StringVar(&proxyURL, "proxy", "", "proxy URL used for both HTTP and HTTPS")
	fs.StringVar(&noProxy, "no-proxy", "", "comma-separated hosts that bypass the proxy")
	fs.StringVar(&keysJSON, "keys-json", "", "JSON object mapping engine name to API key")
	fs.BoolVar(&disabled, "disabled", false, "disable search (always returns disabled diagnostics)")
	fs.BoolVar(&cfg.ProtectURLs, "protect-urls", false, "replace result URLs with opaque reference tokens in web_search output")
	fs.BoolVar(&cfg.ShowVersion, "version", false, "print version and exit")
	fs.Usage = func() {
		fmt.Fprintf(os.Stderr, "websearch-mcp %s - standalone MCP server for the websearch package\n\n", shared.Version)
		fmt.Fprintf(os.Stderr, "Usage: websearch-mcp [flags]\n\nFlags:\n")
		fs.PrintDefaults()
		fmt.Fprintf(os.Stderr, "\nEnvironment:\n")
		fmt.Fprintf(os.Stderr, "  EXA_API_KEY             Exa search API key\n")
		fmt.Fprintf(os.Stderr, "  PARALLEL_API_KEY        Parallel search API key\n")
		fmt.Fprintf(os.Stderr, "  WEBSEARCH_PROVIDER      auto | meta | duckduckgo | exa | parallel\n")
		fmt.Fprintf(os.Stderr, "  WEBSEARCH_NUM_RESULTS   default number of results\n")
		fmt.Fprintf(os.Stderr, "  WEBSEARCH_TIMEOUT_MS    per-engine timeout in milliseconds\n")
		fmt.Fprintf(os.Stderr, "  WEBSEARCH_ENGINES       comma-separated engine whitelist\n")
		fmt.Fprintf(os.Stderr, "  WEBSEARCH_ENABLED       true | false\n")
		fmt.Fprintf(os.Stderr, "  HTTP_PROXY / HTTPS_PROXY / NO_PROXY\n")
		fmt.Fprintf(os.Stderr, "\nPrecedence: flags > environment > config file > defaults\n")
	}
	if err := fs.Parse(args); err != nil {
		return nil, err
	}
	set := make(map[string]bool)
	fs.Visit(func(f *flag.Flag) { set[f.Name] = true })

	if cfg.ShowVersion {
		return cfg, nil
	}

	// 1. Config file (lowest of the three explicit sources).
	if configPath != "" {
		if err := applyConfigFile(cfg, configPath); err != nil {
			return nil, err
		}
	}

	// 2. Environment variables.
	if v := envStr("WEBSEARCH_ENABLED"); v != "" {
		cfg.Enabled = envBool(v)
	}
	if v := envStr("WEBSEARCH_PROVIDER"); v != "" {
		cfg.Provider = shared.WebSearchProvider(v)
	}
	if v := envStr("EXA_API_KEY"); v != "" {
		cfg.ExaAPIKey = v
	}
	if v := envStr("PARALLEL_API_KEY"); v != "" {
		cfg.ParallelAPIKey = v
	}
	if v := envInt("WEBSEARCH_NUM_RESULTS"); v > 0 {
		cfg.DefaultOptions.NumResults = v
	}
	if v := envInt("WEBSEARCH_TIMEOUT_MS"); v > 0 {
		cfg.TimeoutMs = v
	}
	if v := envStr("WEBSEARCH_ENGINES"); v != "" {
		cfg.DefaultOptions.Engines = splitComma(v)
	}
	httpProxy := envStr("HTTP_PROXY")
	httpsProxy := envStr("HTTPS_PROXY")
	if httpsProxy == "" {
		httpsProxy = httpProxy
	}
	if httpProxy != "" || httpsProxy != "" {
		cfg.Proxy = shared.NewExplicitProxy(httpProxy, httpsProxy)
		cfg.Proxy.NoProxy = envStr("NO_PROXY")
	}

	// 3. CLI flags (highest).
	if set["num-results"] {
		cfg.DefaultOptions.NumResults = numResults
	}
	if set["timeout-ms"] {
		cfg.TimeoutMs = timeoutMs
	}
	if set["proxy"] {
		cfg.Proxy = shared.NewExplicitProxy(proxyURL, proxyURL)
	}
	if set["no-proxy"] {
		cfg.Proxy.NoProxy = noProxy
	}
	if set["disabled"] {
		cfg.Enabled = !disabled
	}
	if keysJSON != "" {
		keys := map[string]string{}
		if err := json.Unmarshal([]byte(keysJSON), &keys); err != nil {
			return nil, fmt.Errorf("invalid -keys-json: %w", err)
		}
		for name, key := range keys {
			entry := cfg.Engines[name]
			entry.APIKey = key
			cfg.Engines[name] = entry
		}
	}

	if cfg.DefaultOptions.NumResults <= 0 {
		cfg.DefaultOptions.NumResults = 300
	}
	return cfg, nil
}

func applyConfigFile(cfg *Config, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read config file: %w", err)
	}
	var fc fileConfig
	if err := json.Unmarshal(data, &fc); err != nil {
		return fmt.Errorf("parse config file %s: %w", path, err)
	}
	if fc.Enabled != nil {
		cfg.Enabled = *fc.Enabled
	}
	if fc.Provider != "" {
		cfg.Provider = shared.WebSearchProvider(fc.Provider)
	}
	if fc.TimeoutMs > 0 {
		cfg.TimeoutMs = fc.TimeoutMs
	}
	if fc.ExaAPIKey != "" {
		cfg.ExaAPIKey = fc.ExaAPIKey
	}
	if fc.ParallelAPIKey != "" {
		cfg.ParallelAPIKey = fc.ParallelAPIKey
	}
	if fc.Proxy != nil {
		proxy := shared.NewExplicitProxy(fc.Proxy.HTTP, fc.Proxy.HTTPS)
		proxy.NoProxy = fc.Proxy.NoProxy
		cfg.Proxy = proxy
	}
	if fc.DefaultOptions != nil {
		if fc.DefaultOptions.NumResults > 0 {
			cfg.DefaultOptions.NumResults = fc.DefaultOptions.NumResults
		}
		if fc.DefaultOptions.SafeSearch != 0 {
			cfg.DefaultOptions.SafeSearch = fc.DefaultOptions.SafeSearch
		}
		if fc.DefaultOptions.TimeRange != "" {
			cfg.DefaultOptions.TimeRange = fc.DefaultOptions.TimeRange
		}
		if fc.DefaultOptions.Lang != "" {
			cfg.DefaultOptions.Lang = fc.DefaultOptions.Lang
		}
		cfg.DefaultOptions.Livecrawl = fc.DefaultOptions.Livecrawl
		if fc.DefaultOptions.QueryType != "" {
			cfg.DefaultOptions.QueryType = fc.DefaultOptions.QueryType
		}
		if fc.DefaultOptions.SearchType != "" {
			cfg.DefaultOptions.SearchType = fc.DefaultOptions.SearchType
		}
	}
	for name, e := range fc.Engines {
		cfg.Engines[name] = shared.EngineRuntimeConfig{
			Enabled:    e.Enabled,
			APIKey:     e.APIKey,
			BaseURL:    e.BaseURL,
			TimeoutMs:  e.TimeoutMs,
			MaxResults: e.MaxResults,
			Weight:     e.Weight,
			Priority:   e.Priority,
			Headers:    e.Headers,
		}
	}
	return nil
}

// runtimeConfig 把服务器 Config 转换为 websearch 的 RuntimeConfig。
func (c *Config) runtimeConfig() shared.RuntimeConfig {
	return shared.RuntimeConfig{
		Enabled:        c.Enabled,
		Provider:       c.Provider,
		TimeoutMs:      c.TimeoutMs,
		ExaAPIKey:      c.ExaAPIKey,
		ParallelAPIKey: c.ParallelAPIKey,
		Proxy:          c.Proxy,
		DefaultOptions: c.DefaultOptions,
		Engines:        c.Engines,
	}
}

func envStr(key string) string {
	return strings.TrimSpace(os.Getenv(key))
}

func envInt(key string) int {
	v, err := strconv.Atoi(envStr(key))
	if err != nil {
		return 0
	}
	return v
}

func envBool(raw string) bool {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func splitComma(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}
