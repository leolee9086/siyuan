// 引擎框架：三种引擎工厂模式 + 辅助函数
package websearch

import (
	"encoding/base64"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ═══════════════════════════════════════════════════════
// 引擎工厂框架
// ═══════════════════════════════════════════════════════

// ── JSON API 引擎 ─────────────────────────────────────

type jsonAPIConfig struct {
	Name          string
	URL           func(query string, numResults int) string
	Parse         func(data []byte, maxResults int) ([]SearchResult, error)
	Category      string
	UserAgent     string
	Headers       map[string]string // 额外的自定义请求头
	RequiresKey   bool
	APIKeyEnv     string
	APIKeyHeader  string
}

func newJSONAPIEngine(cfg jsonAPIConfig) EngineFactory {
	return func(config EngineConfig) SearchEngine {
		return &jsonAPIEngine{cfg: cfg, config: config}
	}
}

type jsonAPIEngine struct {
	cfg    jsonAPIConfig
	config EngineConfig
}

func (e *jsonAPIEngine) Name() string        { return e.config.Name }
func (e *jsonAPIEngine) Config() EngineConfig { return e.config }
func (e *jsonAPIEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	url := e.cfg.URL(query, opts.NumResults)
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	client.SetHeader("Accept", "application/json")
	if e.cfg.UserAgent != "" {
		client.SetHeader("User-Agent", e.cfg.UserAgent)
	}
	for k, v := range e.cfg.Headers {
		client.SetHeader(k, v)
	}
	if e.cfg.RequiresKey && e.cfg.APIKeyEnv != "" {
		if key := os.Getenv(e.cfg.APIKeyEnv); key != "" {
			h := e.cfg.APIKeyHeader
			if h == "" {
				h = "Authorization"
			}
			client.SetHeader(h, "Bearer "+key)
		}
	}
	for k, v := range headers {
		client.SetHeader(k, v)
	}
	status, body, err := client.Get(url, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return nil, nil
	}
	return e.cfg.Parse([]byte(body), opts.NumResults)
}

// ── HTML 抓取引擎 ─────────────────────────────────────

func newHTMLScraperEngine(cfg htmlScraperConfig) EngineFactory {
	return func(config EngineConfig) SearchEngine {
		return &htmlScraperEngine{cfg: cfg, config: config}
	}
}

type htmlScraperConfig struct {
	Name     string
	BuildURL func(query string, opts SearchOptions) string
	Parse    func(body string, maxResults int) ([]SearchResult, error)
	Headers  map[string]string
}

type htmlScraperEngine struct {
	cfg    htmlScraperConfig
	config EngineConfig
}

func (e *htmlScraperEngine) Name() string        { return e.config.Name }
func (e *htmlScraperEngine) Config() EngineConfig { return e.config }
func (e *htmlScraperEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	if e.cfg.Headers != nil {
		if headers == nil {
			headers = make(map[string]string)
		}
		for k, v := range e.cfg.Headers {
			if _, exists := headers[k]; !exists {
				headers[k] = v
			}
		}
	}
	url := e.cfg.BuildURL(query, opts)
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	client.SetHeader("Accept", "text/html")
	for k, v := range headers {
		client.SetHeader(k, v)
	}
	status, body, err := client.Get(url, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return nil, nil
	}
	return e.cfg.Parse(body, opts.NumResults)
}

// ── DuckDuckGo Site 引擎 ──────────────────────────────

func newSiteScopedEngine(domain, name string) EngineFactory {
	return func(config EngineConfig) SearchEngine {
		return &siteScopedEngine{domain: domain, engineName: name, config: config}
	}
}

type siteScopedEngine struct {
	domain, engineName string
	config             EngineConfig
}

func (e *siteScopedEngine) Name() string        { return e.config.Name }
func (e *siteScopedEngine) Config() EngineConfig { return e.config }
func (e *siteScopedEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	scopedQuery := "site:" + e.domain + " " + query
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	client.SetHeader("Accept", "text/html")
	client.SetHeader("Content-Type", "application/x-www-form-urlencoded")
	for k, v := range headers {
		client.SetHeader(k, v)
	}
	formData := map[string]string{"q": scopedQuery, "b": "", "kl": "wt-wt"}
	status, body, err := client.PostForm("https://html.duckduckgo.com/html/", formData, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return nil, nil
	}
	if strings.Contains(body, "challenge-form") {
		return nil, nil
	}
	return parseDdgHTML(body, opts.NumResults, e.engineName, e.domain)
}

// ═══════════════════════════════════════════════════════
// 通用解析函数
// ═══════════════════════════════════════════════════════

// ── DuckDuckGo HTML 结果解析 ──────────────────────────

func parseDdgHTML(html string, maxResults int, engineName, domainFilter string) ([]SearchResult, error) {
	var results []SearchResult
	pos := 0
	resultRegex := regexp.MustCompile(`<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>`)
	matches := resultRegex.FindAllStringSubmatch(html, -1)
	for _, m := range matches {
		if len(results) >= maxResults {
			break
		}
		url := extractDDGURL(m[1])
		title := StripHTML(m[2])
		snippet := StripHTML(m[3])
		if title == "" || url == "" {
			continue
		}
		if domainFilter != "" && !strings.Contains(url, domainFilter) {
			continue
		}
		pos++
		results = append(results, SearchResult{
			Title: title, URL: url, Snippet: snippet,
			Engine: engineName, Position: pos, Category: "general",
		})
	}
	return results, nil
}

func extractDDGURL(href string) string {
	if href == "" {
		return ""
	}
	re := regexp.MustCompile(`[?&]uddg=([^&]+)`)
	if m := re.FindStringSubmatch(href); m != nil {
		if decoded, err := url.QueryUnescape(m[1]); err == nil {
			return decoded
		}
	}
	if strings.HasPrefix(href, "http://") || strings.HasPrefix(href, "https://") {
		return href
	}
	if strings.HasPrefix(href, "//") {
		return "https:" + href
	}
	return href
}

// ── Bing URL 解码 ─────────────────────────────────────

func decodeBingURL(href string) string {
	if !strings.Contains(href, "/ck/a?") {
		return href
	}
	re := regexp.MustCompile(`[?&]u=([^&]+)`)
	if m := re.FindStringSubmatch(href); m != nil {
		encoded := m[1]
		if strings.HasPrefix(encoded, "a1") {
			encoded = encoded[2:]
		}
		encoded = strings.NewReplacer("-", "+", "_", "/").Replace(encoded)
		switch len(encoded) % 4 {
		case 2:
			encoded += "=="
		case 3:
			encoded += "="
		}
		decoded, err := base64.StdEncoding.DecodeString(encoded)
		if err == nil {
			return string(decoded)
		}
	}
	return href
}

// ── Google 搜索结果解析 ───────────────────────────────

// parseGoogleResults 解析 Google 搜索结果 HTML
// 对应 TS google.ts 的 parseGoogleResults()
func parseGoogleResults(body string, maxResults int) ([]SearchResult, error) {
	var results []SearchResult
	pos := 0

	// 步骤1: 使用 data-ved + /url?q= 提取标题和 URL
	// 对应 TS: /<a[^>]*data-ved[^>]*href="\/url\?q=([^"&]+)...<h3...>([\s\S]*?)<\/h3>/gi
	type titleEntry struct {
		url   string
		title string
		index int
	}
	var entries []titleEntry
	re := regexp.MustCompile(`<a[^>]*data-ved[^>]*href="\/url\?q=([^"&]+)[^"]*"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>`)
	idxMatches := re.FindAllStringSubmatchIndex(body, -1)
	for _, idx := range idxMatches {
		if len(entries) >= maxResults*2 {
			break
		}
		u, err := url.QueryUnescape(body[idx[2]:idx[3]])
		if err != nil {
			continue
		}
		if idx2 := strings.Index(u, "&sa=U"); idx2 >= 0 {
			u = u[:idx2]
		}
		title := StripHTML(body[idx[4]:idx[5]])
		if title == "" || u == "" {
			continue
		}
		entries = append(entries, titleEntry{url: u, title: title, index: idx[0]})
	}

	// 步骤2: 从 VwiC3b 提取摘要（对应 TS: /<div[^>]*class="[^"]*VwiC3b[^"]*"...>/i）
	for _, e := range entries {
		if len(results) >= maxResults {
			break
		}
		snippet := ""
		end := e.index + 2000
		if end > len(body) {
			end = len(body)
		}
		after := body[e.index:end]
		if sm := regexp.MustCompile(`<div[^>]*class="[^"]*VwiC3b[^"]*"[^>]*>([\s\S]*?)<\/div>`).FindStringSubmatch(after); sm != nil {
			snippet = StripHTML(sm[1])
		}
		if len(snippet) > 300 {
			snippet = snippet[:300]
		}
		pos++
		results = append(results, SearchResult{
			Title: e.title, URL: e.url, Snippet: snippet,
			Engine: "google", Position: pos,
		})
	}
	return results, nil
}

// ── Bing 搜索结果解析 ─────────────────────────────────
// 逐行对齐 TS parseBingResults + extractResult + extractSnippet

func parseBingResults(body string, maxResults int) ([]SearchResult, error) {
	var results []SearchResult
	pos := 0
	seen := make(map[string]bool)

	// 对应 TS: const containerStart = html.indexOf('<ol id="b_results"')
	containerStart := strings.Index(body, `<ol id="b_results"`)
	searchHTML := body
	if containerStart >= 0 {
		searchHTML = body[containerStart:]
	}

	// 对应 TS: /<li[^>]*class="b_algo"[^>]*>[\s\S]*?<\/li>/gi
	algoRegex := regexp.MustCompile(`<li[^>]*class="b_algo"[^>]*>[\s\S]*?<\/li>`)
	for _, block := range algoRegex.FindAllString(searchHTML, -1) {
		if len(results) >= maxResults {
			break
		}
		url, title, snippet := extractBingResult(block)
		if url == "" || title == "" || seen[url] {
			continue
		}
		seen[url] = true
		pos++
		results = append(results, SearchResult{
			Title: title, URL: url, Snippet: snippet,
			Engine: "bing", Position: pos,
		})
	}
	return results, nil
}

// extractBingResult 从单个 b_algo 块提取 URL/标题/摘要
// 对应 TS extractResult + extractSnippet
func extractBingResult(block string) (url, title, snippet string) {
	// 变体1: <h2><a href="URL">TITLE</a></h2> (对应 TS h2Match)
	if m := rxFindStringSubmatch(block, `<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>`); m != nil {
		url = decodeBingURL(m[1])
		title = StripHTML(m[2])
		if title != "" && url != "" {
			goto extractSnippet
		}
	}
	// 变体2: <a class="tilk" href="URL">TITLE</a> (对应 TS tilkMatch)
	if m := rxFindStringSubmatch(block, `<a[^>]*class="tilk"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`); m != nil {
		url = decodeBingURL(m[1])
		title = StripHTML(m[2])
		if title != "" && url != "" {
			goto extractSnippet
		}
	}
	return "", "", ""

extractSnippet:
	// 对应 TS extractSnippet: 清除 <span class="algoSlug_icon"> 装饰
	cleaned := rxReplaceAllString(block, `<span[^>]*class="algoSlug_icon"[^>]*>[\s\S]*?<\/span>`, "")
	// 提取 <p> 标签内容
	snippetParts := rxFindAllStringSubmatch(cleaned, `<p[^>]*>([\s\S]*?)<\/p>`)
	for _, sm := range snippetParts {
		text := StripHTML(sm[1])
		if text != "" {
			if snippet != "" {
				snippet += " "
			}
			snippet += text
		}
	}
	if len(snippet) > 300 {
		snippet = snippet[:300]
	}
	return url, title, snippet
}

// rxFindStringSubmatch 便捷正则匹配
func rxFindStringSubmatch(s, pattern string) []string {
	re := regexp.MustCompile(pattern)
	return re.FindStringSubmatch(s)
}

// rxFindAllStringSubmatch 便捷正则多匹配
func rxFindAllStringSubmatch(s, pattern string) [][]string {
	re := regexp.MustCompile(pattern)
	return re.FindAllStringSubmatch(s, -1)
}

// rxReplaceAllString 便捷正则替换
func rxReplaceAllString(s, pattern, repl string) string {
	re := regexp.MustCompile(pattern)
	return re.ReplaceAllString(s, repl)
}

// ── Google Scholar 结果解析 ───────────────────────────

func parseGoogleScholarResults(body string, maxResults int) ([]SearchResult, error) {
	var results []SearchResult
	blockRegex := regexp.MustCompile(`<div[^>]*class="gs_ri"[^>]*>[\s\S]*?(?=<div[^>]*class="gs_ri"|$)`)
	blocks := blockRegex.FindAllString(body, -1)
	for _, block := range blocks {
		if len(results) >= maxResults {
			break
		}
		titleMatch := regexp.MustCompile(`<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`).FindStringSubmatch(block)
		if titleMatch == nil {
			continue
		}
		u := titleMatch[1]
		title := StripHTML(titleMatch[2])
		if title == "" || u == "" {
			continue
		}
		authorMatch := regexp.MustCompile(`<div[^>]*class="gs_a"[^>]*>([\s\S]*?)<\/div>`).FindStringSubmatch(block)
		authorInfo := ""
		if authorMatch != nil {
			authorInfo = StripHTML(authorMatch[1])
		}
		snippetMatch := regexp.MustCompile(`<div[^>]*class="gs_rs"[^>]*>([\s\S]*?)<\/div>`).FindStringSubmatch(block)
		snippet := ""
		if snippetMatch != nil {
			snippet = StripHTML(snippetMatch[1])
		}
		citations := ""
		if cm := regexp.MustCompile(`Cited by (\d+)`).FindStringSubmatch(block); cm != nil {
			citations = cm[1]
		}
		fullSnippet := authorInfo
		if snippet != "" {
			if fullSnippet != "" {
				fullSnippet += " | "
			}
			fullSnippet += snippet
		}
		if citations != "" {
			fullSnippet += " | 被引用: " + citations
		}
		if len(fullSnippet) > 300 {
			fullSnippet = fullSnippet[:300]
		}
		var publishedDate int64
		if ym := regexp.MustCompile(`(\d{4})`).FindStringSubmatch(authorInfo); ym != nil {
			if year, err := strconv.Atoi(ym[1]); err == nil && year > 1900 && year < 2100 {
				publishedDate = time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
			}
		}
		results = append(results, SearchResult{
			Title: title, URL: u, Snippet: fullSnippet,
			Engine: "google-scholar", Position: len(results) + 1, Category: "academic",
			PublishedDate: publishedDate,
		})
	}
	return results, nil
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func nestedMap(m map[string]interface{}, keys ...string) (interface{}, bool) {
	current := interface{}(m)
	for _, k := range keys {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil, false
		}
		current, ok = m[k]
		if !ok {
			return nil, false
		}
	}
	return current, true
}

func nestedStr(m map[string]interface{}, keys ...string) string {
	v, ok := nestedMap(m, keys...)
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}
