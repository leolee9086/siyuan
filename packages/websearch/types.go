// Package websearch 提供完整的元搜索引擎功能。
// 移植自 opencode 的 websearch 实现（SearXNG 风格元搜索引擎）。
// 包含 100+ 搜索引擎适配器、结果聚合去重、缓存、速率限制、熔断器等。
//
// 架构设计：
// - 核心引擎逻辑为纯 Go 包，独立可测试
// - 通过 MCP 接口暴露，兼容 s-forge、s-code 及任何 MCP 客户端
// - 保持开闭原则：新增引擎无需修改核心逻辑
package websearch

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ── 工具函数 ──────────────────────────────────────────

var reStripTags = regexp.MustCompile(`<[^>]+>`)

// StripHTML 去除 HTML 标签
func StripHTML(text string) string {
	return strings.TrimSpace(reStripTags.ReplaceAllString(text, ""))
}

// UnescapeHTML 解码常见 HTML 实体
func UnescapeHTML(text string) string {
	text = strings.NewReplacer(
		"&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", "\"",
		"&#x27;", "'", "&#x2F;", "/", "&nbsp;", " ",
	).Replace(text)
	re := regexp.MustCompile(`&#(\d+);`)
	text = re.ReplaceAllStringFunc(text, func(m string) string {
		match := re.FindStringSubmatch(m)
		if len(match) > 1 {
			if code, err := strconv.Atoi(match[1]); err == nil && code > 0 {
				return string(rune(code))
			}
		}
		return m
	})
	return text
}

// ── 搜索结果 ──────────────────────────────────────────

// SearchResult 表示来自单个搜索引擎的原始搜索结果
type SearchResult struct {
	Title         string `json:"title"`
	URL           string `json:"url"`
	Snippet       string `json:"snippet"`
	Engine        string `json:"engine"`
	Position      int    `json:"position"`
	PublishedDate int64  `json:"publishedDate,omitempty"` // Unix 毫秒
	Category      string `json:"category,omitempty"`
	Suggestion    string `json:"suggestion,omitempty"` // 拼写建议
}

// AggregatedResult 表示去重合并后的聚合结果
type AggregatedResult struct {
	Title         string   `json:"title"`
	URL           string   `json:"url"`
	Snippet       string   `json:"snippet"`
	Engines       []string `json:"engines"`
	Positions     []int    `json:"positions"`
	Score         float64  `json:"score"`
	PublishedDate int64    `json:"publishedDate,omitempty"`
	Category      string   `json:"category,omitempty"`
	FullSnippet   string   `json:"fullSnippet,omitempty"`
	Suggestion    string   `json:"suggestion,omitempty"`
}

// ── 引擎配置 ──────────────────────────────────────────

// EngineConfig 搜索引擎配置
type EngineConfig struct {
	Name        string            `json:"name"`
	Category    string            `json:"category,omitempty"`
	Weight      float64           `json:"weight"`
	Timeout     int               `json:"timeout"` // 毫秒
	MaxResults  int               `json:"maxResults"`
	RequiresKey bool              `json:"requiresKey"`
	Priority    int               `json:"priority"`
	APIKey      string            `json:"-"`
	BaseURL     string            `json:"baseUrl,omitempty"`
	Headers     map[string]string `json:"-"`
	Proxy       ProxyConfig       `json:"-"`
}

// DefaultEngineConfig 创建默认引擎配置
func DefaultEngineConfig(name string) EngineConfig {
	return EngineConfig{
		Name:       name,
		Weight:     1.0,
		Timeout:    15000,
		MaxResults: 5,
		Priority:   0,
	}
}

// ── 搜索选项 ──────────────────────────────────────────

// SearchOptions 搜索选项
type SearchOptions struct {
	NumResults int
	SafeSearch int
	TimeRange  string // "day" | "week" | "month" | "year"
	Lang       string
	Livecrawl  bool
	Provider   WebSearchProvider
	QueryType  string
	Engines    []string
	SearchType string // "auto" | "fast" | "deep"
}

// DefaultSearchOptions 创建默认搜索选项
// NumResults 与 s-code 对齐（websearch.ts 中 params.numResults || 300），
// 保证单次搜索聚合后可返回足够多的结果供 LLM 消费。
func DefaultSearchOptions() SearchOptions {
	return SearchOptions{
		NumResults: 300,
		SafeSearch: 1,
		Provider:   ProviderAuto,
		SearchType: "auto",
	}
}

// ── 引擎指标 ──────────────────────────────────────────

// EngineMetrics 引擎统计指标
type EngineMetrics struct {
	TotalRequests      int
	SuccessfulRequests int
	AvgLatency         float64
	TotalLatency       float64
	LastSuccessAt      int64
}

// MakeEngineMetrics 创建初始引擎指标
func MakeEngineMetrics() EngineMetrics {
	return EngineMetrics{}
}

// ── 引擎健康状况 ──────────────────────────────────────

// EngineStatus 引擎健康状态
type EngineStatus struct {
	ConsecutiveFailures    int
	TotalFailures          int
	Suspended              bool
	SuspendedUntil         int64
	LastError              string
	LastSuspensionReason   string
	LastSuspensionDuration int64
	Metrics                EngineMetrics
}

// MakeEngineStatus 创建初始引擎状态
func MakeEngineStatus() EngineStatus {
	return EngineStatus{
		Metrics: MakeEngineMetrics(),
	}
}

// ── 引擎适配器接口 ────────────────────────────────────

// SearchEngine 搜索引擎适配器接口
type SearchEngine interface {
	Name() string
	Config() EngineConfig
	Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error)
}

// EngineFactory 引擎工厂函数类型
type EngineFactory func(config EngineConfig) SearchEngine

// ── 引擎错误类型 ──────────────────────────────────────

// EngineError 引擎错误
type EngineError struct {
	Engine    string
	Message   string
	Retryable bool
}

func (e *EngineError) Error() string { return e.Message }

// MissingCredentialError 表示引擎需要配置凭据才能发起真实请求。
type MissingCredentialError struct {
	Engine string
}

func (e *MissingCredentialError) Error() string {
	return e.Engine + " requires credentials configured in AI.webSearch"
}

// ProtocolError 表示远端响应不符合引擎协议，不能被当作空结果处理。
type ProtocolError struct {
	Engine  string
	Message string
}

func (e *ProtocolError) Error() string { return e.Engine + ": " + e.Message }

// CaptchaError CAPTCHA 验证错误
type CaptchaError struct {
	Engine  string
	Message string
}

func (e *CaptchaError) Error() string { return e.Message }

// RateLimitError 速率限制错误
type RateLimitError struct {
	Engine     string
	RetryAfter int
	Message    string
}

func (e *RateLimitError) Error() string { return e.Message }

// AccessDeniedError 访问被拒绝错误
type AccessDeniedError struct {
	Engine  string
	Message string
}

func (e *AccessDeniedError) Error() string { return e.Message }

// TimeoutError 超时错误
type TimeoutError struct {
	Engine  string
	Message string
}

func (e *TimeoutError) Error() string { return e.Message }

// ── 日期解析 ──────────────────────────────────────────

// ParseRelativeDate 解析相对日期字符串为时间戳（毫秒）
func ParseRelativeDate(text string) *int64 {
	now := time.Now().UnixMilli()
	t := strings.TrimSpace(strings.ToLower(text))
	if t == "" {
		return nil
	}
	isoRegex := regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})`)
	if m := isoRegex.FindStringSubmatch(t); m != nil {
		if parsed, err := time.Parse("2006-01-02", m[1]+"-"+m[2]+"-"+m[3]); err == nil {
			v := parsed.UnixMilli()
			return &v
		}
	}
	if t == "today" {
		return &now
	}
	if t == "yesterday" {
		v := now - 86400000
		return &v
	}
	lastRegex := regexp.MustCompile(`^last\s+(week|month|year)$`)
	if m := lastRegex.FindStringSubmatch(t); m != nil {
		switch m[1] {
		case "week":
			v := now - 7*86400000
			return &v
		case "month":
			v := now - 30*86400000
			return &v
		case "year":
			v := now - 365*86400000
			return &v
		}
	}
	agoRegex := regexp.MustCompile(`^(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\s+ago$`)
	if m := agoRegex.FindStringSubmatch(t); m != nil {
		num, _ := strconv.Atoi(m[1])
		switch {
		case strings.HasPrefix(m[2], "minute"):
			v := now - int64(num)*60000
			return &v
		case strings.HasPrefix(m[2], "hour"):
			v := now - int64(num)*3600000
			return &v
		case strings.HasPrefix(m[2], "day"):
			v := now - int64(num)*86400000
			return &v
		case strings.HasPrefix(m[2], "week"):
			v := now - int64(num)*7*86400000
			return &v
		case strings.HasPrefix(m[2], "month"):
			v := now - int64(num)*30*86400000
			return &v
		case strings.HasPrefix(m[2], "year"):
			v := now - int64(num)*365*86400000
			return &v
		}
	}
	shortRegex := regexp.MustCompile(`^(\d+)\s*(h|hr|d|w|mo|y)$`)
	if m := shortRegex.FindStringSubmatch(t); m != nil {
		num, _ := strconv.Atoi(m[1])
		switch m[2] {
		case "h", "hr":
			v := now - int64(num)*3600000
			return &v
		case "d":
			v := now - int64(num)*86400000
			return &v
		case "w":
			v := now - int64(num)*7*86400000
			return &v
		case "mo":
			v := now - int64(num)*30*86400000
			return &v
		case "y":
			v := now - int64(num)*365*86400000
			return &v
		}
	}
	return nil
}

// ── URL 工具 ──────────────────────────────────────────

// ExtractDomain 从 URL 中提取域名（去除 www. 前缀）
func ExtractDomain(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	return strings.TrimPrefix(u.Hostname(), "www.")
}

// NormalizeURL 标准化 URL 用于去重
func NormalizeURL(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return rawURL
	}
	u.Scheme = "https"
	for len(u.Path) > 1 && u.Path[len(u.Path)-1] == '/' {
		u.Path = u.Path[:len(u.Path)-1]
	}
	trackingParams := []string{"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "source"}
	q := u.Query()
	for _, p := range trackingParams {
		q.Del(p)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

// ── JSON 序列化 ───────────────────────────────────────

// SerializeResults 压缩序列化搜索结果
func SerializeResults(results []SearchResult) (string, error) {
	type compactResult struct {
		T  string `json:"t"`
		U  string `json:"u"`
		S  string `json:"s"`
		E  string `json:"e"`
		P  int    `json:"p"`
		D  int64  `json:"d,omitempty"`
		C  string `json:"c,omitempty"`
		Sg string `json:"sg,omitempty"`
	}
	cr := make([]compactResult, len(results))
	for i, r := range results {
		cr[i] = compactResult{T: r.Title, U: r.URL, S: r.Snippet, E: r.Engine, P: r.Position, D: r.PublishedDate, C: r.Category, Sg: r.Suggestion}
	}
	data, err := json.Marshal(cr)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// DeserializeResults 反序列化搜索结果
func DeserializeResults(raw string) ([]SearchResult, error) {
	type compactResult struct {
		T  string `json:"t"`
		U  string `json:"u"`
		S  string `json:"s"`
		E  string `json:"e"`
		P  int    `json:"p"`
		D  int64  `json:"d,omitempty"`
		C  string `json:"c,omitempty"`
		Sg string `json:"sg,omitempty"`
	}
	var cr []compactResult
	if err := json.Unmarshal([]byte(raw), &cr); err != nil {
		return nil, err
	}
	results := make([]SearchResult, len(cr))
	for i, r := range cr {
		results[i] = SearchResult{Title: r.T, URL: r.U, Snippet: r.S, Engine: r.E, Position: r.P, PublishedDate: r.D, Category: r.C, Suggestion: r.Sg}
	}
	return results, nil
}

// ── 进度回调 ──────────────────────────────────────────

type ProgressPhase int

const (
	PhaseStart ProgressPhase = iota
	PhaseResult
	PhaseDone
)

// ProgressInfo 进度回调信息
type ProgressInfo struct {
	Done           int
	Total          int
	Current        string
	Phase          ProgressPhase
	PartialResults []SearchResult
	NewResults     []SearchResult
}

// ProgressCallback 进度回调函数类型
type ProgressCallback func(info ProgressInfo)
