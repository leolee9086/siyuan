// 通用搜索引擎实现
package websearch

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

func init() {
	register("duckduckgo", newDuckDuckGo)
	register("bing", newBing)
	register("brave", newBrave)
	register("google", newGoogle)
	register("baidu", newBaidu)
}

// ── DuckDuckGo ────────────────────────────────────────
// 对齐 TS duckduckgo.ts: searchHtmlPost + langToKl + timeRangeToDf

// langToKl 对应 TS langToKl: 语言→DDG 区域参数
func langToKl(lang string) string {
	if lang == "" {
		return "wt-wt"
	}
	m := map[string]string{
		"zh-CN": "cn-zh", "zh-TW": "tw-zh", "zh": "cn-zh",
		"ja": "jp-jp", "ko": "kr-kr",
		"en": "us-en", "en-US": "us-en", "en-GB": "uk-en",
		"fr": "fr-fr", "de": "de-de", "es": "es-es",
		"pt": "br-pt", "it": "it-it", "ru": "ru-ru",
	}
	if v, ok := m[lang]; ok {
		return v
	}
	parts := strings.SplitN(lang, "-", 2)
	if v, ok := m[parts[0]]; ok {
		return v
	}
	return "wt-wt"
}

// timeRangeToDf 对应 TS timeRangeToDf: timeRange→DDG 日期过滤参数
func timeRangeToDf(timeRange string) string {
	m := map[string]string{"day": "d", "week": "w", "month": "m", "year": "y"}
	if v, ok := m[timeRange]; ok {
		return v
	}
	return ""
}

func newDuckDuckGo(config EngineConfig) SearchEngine {
	return &ddgEngine{config: config}
}

type ddgEngine struct{ config EngineConfig }

func (e *ddgEngine) Name() string         { return "duckduckgo" }
func (e *ddgEngine) Config() EngineConfig { return e.config }
// Search 对齐 s-code duckduckgo.ts 的 searchWithFallback：
// HTML POST + JSON API + Lite 三路并发执行，全部完成后按优先级取第一个
// 非空结果（HTML 含时间过滤与拼写建议，优先级最高；HTML 被反爬拦截时
// JSON/Lite 通道仍可兜底，避免主力引擎直接失败）。
func (e *ddgEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	type outcome struct {
		results []SearchResult
		err     error
	}
	htmlCh := make(chan outcome, 1)
	jsonCh := make(chan outcome, 1)
	liteCh := make(chan outcome, 1)
	go func() {
		results, err := e.searchHtmlPost(query, opts, headers)
		htmlCh <- outcome{results: results, err: err}
	}()
	go func() {
		results, err := e.searchJsonApi(query, opts)
		jsonCh <- outcome{results: results, err: err}
	}()
	go func() {
		results, err := e.searchLite(query, opts)
		liteCh <- outcome{results: results, err: err}
	}()

	html, json, lite := <-htmlCh, <-jsonCh, <-liteCh
	// 优先级：HTML POST（含时间过滤和拼写建议）> JSON API > Lite
	if len(html.results) > 0 {
		return html.results, html.err
	}
	if len(json.results) > 0 {
		return json.results, json.err
	}
	return lite.results, lite.err
}

// searchHtmlPost 对应 TS searchHtmlPost：DDG HTML POST 通道（默认主通道）
func (e *ddgEngine) searchHtmlPost(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewEngineHTTPClient(e.config)
	// 对应 TS: headers
	client.SetHeader("User-Agent", ddgUserAgent)
	client.SetHeader("Content-Type", "application/x-www-form-urlencoded")
	client.SetHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	// 对应 TS: Accept-Language
	acceptLang := "en-US,en;q=0.9"
	if opts.Lang != "" {
		acceptLang = strings.ReplaceAll(opts.Lang, "_", "-") + ",en;q=0.9"
	}
	client.SetHeader("Accept-Language", acceptLang)
	// 对应 TS: Sec-Fetch-* + Referer
	client.SetHeader("Sec-Fetch-Dest", "document")
	client.SetHeader("Sec-Fetch-Mode", "navigate")
	client.SetHeader("Sec-Fetch-Site", "same-origin")
	client.SetHeader("Sec-Fetch-User", "?1")
	client.SetHeader("Referer", "https://html.duckduckgo.com/")

	// 对应 TS: formData = { q, b: "", kl: langToKl(opts.lang) }
	formData := map[string]string{"q": query, "b": "", "kl": langToKl(opts.Lang)}
	// 对应 TS: if (df) formData.set("df", df)
	if df := timeRangeToDf(opts.TimeRange); df != "" {
		formData["df"] = df
	}

	status, body, err := client.PostForm("https://html.duckduckgo.com/html/", formData, nil)
	if err != nil {
		return nil, err
	}
	// 对应 TS: if (response.status < 200 || response.status >= 400) return []
	if status < 200 || status >= 400 {
		return []SearchResult{}, nil
	}
	// 对应 TS: if (response.status === 303 || response.status === 403) return []
	if status == 303 || status == 403 {
		return []SearchResult{}, nil
	}
	// 对应 TS: if (html.length < 500) return []
	if len(body) < 500 {
		return []SearchResult{}, nil
	}
	// 对应 TS: if (html.includes('id="challenge-form"') || html.includes('id="captcha"')) return []
	// 对齐 s-code：反爬拦截返回空结果（zero_results），不触发熔断
	if strings.Contains(body, `id="challenge-form"`) || strings.Contains(body, `id="captcha"`) {
		return []SearchResult{}, nil
	}
	results, err := parseDdgHTML(body, opts.NumResults, "duckduckgo", "")
	if err != nil {
		return nil, err
	}
	// 对应 TS: extractSuggestion 提取拼写建议并附加到第一条结果
	if suggestion := extractDdgSuggestion(body); suggestion != "" && len(results) > 0 {
		results[0].Suggestion = suggestion
	}
	return results, nil
}

// searchJsonApi 对应 TS searchJsonApi：DDG JSON API 通道（vqd 令牌 + d.js 接口）
func (e *ddgEngine) searchJsonApi(query string, opts SearchOptions) ([]SearchResult, error) {
	client := NewEngineHTTPClient(e.config)
	client.SetHeader("User-Agent", ddgUserAgent)
	client.SetHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	client.SetHeader("Accept-Language", "en-US,en;q=0.9")

	// 对应 TS: 先请求主页 HTML 提取 vqd 令牌
	status, html, err := client.Get("https://duckduckgo.com/?q="+url.QueryEscape(query), nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return []SearchResult{}, nil
	}
	vqd := extractDDGVqd(html)
	if vqd == "" {
		return []SearchResult{}, nil
	}

	// 对应 TS: d.js JSON 接口（kl/l/o/sp/ex 参数逐项对齐）
	jsonURL := "https://links.duckduckgo.com/d.js?q=" + url.QueryEscape(query) +
		"&vqd=" + url.QueryEscape(vqd) + "&kl=wt-wt&l=wt-wt&o=json&sp=0&ex=-1"
	client.SetHeader("Accept", "application/json, text/plain, */*")
	client.SetHeader("Referer", "https://duckduckgo.com/")
	status, body, err := client.Get(jsonURL, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return []SearchResult{}, nil
	}
	return parseDdgJSON([]byte(body), opts.NumResults)
}

// searchLite 对应 TS searchLite：DDG Lite HTML 通道
func (e *ddgEngine) searchLite(query string, opts SearchOptions) ([]SearchResult, error) {
	client := NewEngineHTTPClient(e.config)
	client.SetHeader("User-Agent", ddgUserAgent)
	client.SetHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	client.SetHeader("Accept-Language", "en-US,en;q=0.9")

	status, body, err := client.Get("https://lite.duckduckgo.com/lite/?q="+url.QueryEscape(query), nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return []SearchResult{}, nil
	}
	return parseDdgLiteHTML(body, opts.NumResults)
}

// ── Bing ──────────────────────────────────────────────

func newBing(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "bing",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.bing.com/search?q=" + url.QueryEscape(q) + "&setlang=en"
		},
		Headers: map[string]string{
			"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
			"Accept-Language": "en-US,en;q=0.9",
			"Accept":          "text/html,application/xhtml+xml",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			// 对齐 s-code bing.ts:51：验证码/验证页返回空结果（zero_results），不触发熔断
			if strings.Contains(body, "captcha") || strings.Contains(body, "verify") {
				return []SearchResult{}, nil
			}
			results, _ := parseBingResults(body, max)
			if len(results) > 0 {
				return results, nil
			}
			// 备用：宽松匹配 h2>a（对应 TS fallbackRegex，修复了 <a><h2> 反向嵌套 bug）
			var results2 []SearchResult
			pos := 0
			re := regexp.MustCompile(`<h2[^>]*>[\s\S]*?<a[^>]*href="(https?://[^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results2) >= max {
					break
				}
				title := StripHTML(m[2])
				u := m[1]
				if title == "" || u == "" || strings.Contains(u, "bing.com") {
					continue
				}
				pos++
				results2 = append(results2, SearchResult{Title: title, URL: u, Snippet: "", Engine: "bing", Position: pos})
			}
			if len(results2) > 0 {
				return results2, nil
			}
			return results, nil
		},
	})(config)
}

// ── Brave ─────────────────────────────────────────────

func newBrave(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "brave", Category: "general",
		UserAgent: "opencode-search/1.0",
		Headers: map[string]string{
			"Accept-Encoding": "gzip",
		},
		RequiresKey:  true,
		APIKeyHeader: "X-Subscription-Token",
		URL: func(q string, n int) string {
			// 对应 TS: q, count, safesearch
			return "https://api.search.brave.com/res/v1/web/search?q=" + url.QueryEscape(q) + "&count=" + strconv.Itoa(minInt(n, 20)) + "&safesearch=1"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			// 对应 TS: parsed?.web?.results ?? parsed?.results ?? []
			var resp struct {
				Web *struct {
					Results []struct {
						Title       string `json:"title"`
						URL         string `json:"url"`
						Description string `json:"description"`
						Snippet     string `json:"snippet"`
					} `json:"results"`
				} `json:"web"`
				Results []struct {
					Title       string `json:"title"`
					URL         string `json:"url"`
					Description string `json:"description"`
					Snippet     string `json:"snippet"`
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			// 优先 web.results，fallback 到顶层 results
			var items []struct {
				Title       string `json:"title"`
				URL         string `json:"url"`
				Description string `json:"description"`
				Snippet     string `json:"snippet"`
			}
			if resp.Web != nil && len(resp.Web.Results) > 0 {
				items = resp.Web.Results
			} else if len(resp.Results) > 0 {
				items = resp.Results
			}
			var results []SearchResult
			for i, r := range items {
				if i >= max {
					break
				}
				// 对应 TS: r.description ?? r.snippet ?? ""
				snippet := r.Description
				if snippet == "" {
					snippet = r.Snippet
				}
				results = append(results, SearchResult{
					Title: r.Title, URL: r.URL, Snippet: snippet,
					Engine: "brave", Position: i + 1, Category: "general",
				})
			}
			return results, nil
		},
	})(config)
}

// ── Google ────────────────────────────────────────────
// 完整对齐 TS google.ts + google-traits.ts

// guessCountry 从语言标签猜测国家代码
func guessCountry(lang string) string {
	if lang == "" {
		return "US"
	}
	parts := strings.Split(lang, "-")
	if len(parts) > 1 {
		return strings.ToUpper(parts[1])
	}
	m := map[string]string{
		"zh": "CN", "ja": "JP", "ko": "KR", "de": "DE", "fr": "FR",
		"es": "ES", "pt": "BR", "ru": "RU", "it": "IT", "ar": "SA",
		"tr": "TR", "nl": "NL", "sv": "SE", "pl": "PL", "da": "DK",
		"fi": "FI", "nb": "NO", "th": "TH", "vi": "VN", "id": "ID",
		"ms": "MY",
	}
	if v, ok := m[parts[0]]; ok {
		return v
	}
	return "US"
}

// googleSubdomain 获取 Google 子域名
func googleSubdomain(country string) string {
	m := map[string]string{
		"US": "www.google.com", "GB": "www.google.co.uk", "DE": "www.google.de",
		"FR": "www.google.fr", "JP": "www.google.co.jp", "KR": "www.google.co.kr",
		"CN": "www.google.com.hk", "TW": "www.google.com.tw", "HK": "www.google.com.hk",
		"CA": "www.google.ca", "AU": "www.google.com.au", "IN": "www.google.co.in",
		"BR": "www.google.com.br", "RU": "www.google.ru", "IT": "www.google.it",
		"ES": "www.google.es", "NL": "www.google.nl", "SE": "www.google.se",
		"PL": "www.google.pl", "TR": "www.google.com.tr", "AR": "www.google.com.ar",
		"MX": "www.google.com.mx", "SG": "www.google.com.sg",
	}
	if v, ok := m[country]; ok {
		return v
	}
	return "www.google.com"
}

// googleLangMap 语言→Google LR 参数
func googleLangMap(lang string) string {
	if lang == "" || lang == "all" {
		return ""
	}
	m := map[string]string{
		"en": "lang_en", "zh_CN": "lang_zh-CN", "zh_TW": "lang_zh-TW",
		"ja": "lang_ja", "ko": "lang_ko", "de": "lang_de", "fr": "lang_fr",
		"es": "lang_es", "it": "lang_it", "pt": "lang_pt", "pt_BR": "lang_pt-BR",
		"ru": "lang_ru", "ar": "lang_ar", "tr": "lang_tr",
	}
	// 先查完整 locale, 再查纯语言
	norm := strings.ReplaceAll(lang, "-", "_")
	if v, ok := m[norm]; ok {
		return v
	}
	base := strings.Split(norm, "_")[0]
	if v, ok := m[base]; ok {
		return v
	}
	return "lang_en"
}

// genGoogleUA 生成 Google Search App User-Agent (对应 TS genGoogleUa)
func genGoogleUA(country string) string {
	return "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36 (gws, country:" + country + ")"
}

// isGoogleCaptcha 检测 Google CAPTCHA (对应 TS isGoogleCaptcha)
func isGoogleCaptcha(status int, body string) bool {
	if status == 302 || status == 303 {
		return true
	}
	if body == "" {
		return false
	}
	if len(body) < 2000 && (strings.Contains(body, "/sorry/") || strings.Contains(body, "sorry.google")) {
		return true
	}
	return false
}

func newGoogle(config EngineConfig) SearchEngine {
	return &googleEngine{config: config}
}

type googleEngine struct{ config EngineConfig }

func (e *googleEngine) Name() string         { return "google" }
func (e *googleEngine) Config() EngineConfig { return e.config }
func (e *googleEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	// 对应 TS: getGoogleInfo(lang)
	langParam := opts.Lang // may be ""
	country := guessCountry(langParam)
	langNorm := strings.ReplaceAll(langParam, "-", "_")

	// 对应 TS: const langOrig = lang?.replace("_", "-") || "en"
	hl := langParam
	if hl != "" {
		hl = strings.ReplaceAll(hl, "_", "-")
	} else {
		hl = "en"
	}

	// 对应 TS: const engLang = LANG_MAP[langNorm] || LANG_MAP[langNorm.split("_")[0]] || "lang_en"
	engLang := googleLangMap(langNorm)
	if engLang == "" && langNorm != "" {
		engLang = googleLangMap(strings.Split(langNorm, "_")[0])
	}
	if engLang == "" {
		engLang = "lang_en"
	}

	// 对应 TS: const subdomain = DOMAIN_MAP[country] || "www.google.com"
	subdomain := googleSubdomain(country)

	// 构建 URL: 对应 TS new URLSearchParams({q,num,start,filter,safe,...info.params})
	// TS 始终发送 lr 和 cr（即使是空值），逐行对齐
	params := url.Values{}
	params.Set("q", query)
	params.Set("num", strconv.Itoa(minInt(opts.NumResults, 20)))
	params.Set("start", "0")
	params.Set("filter", "0")
	params.Set("safe", "off")
	params.Set("hl", hl)
	// TS: 如果 lang 是 "all"，不限制语言
	if langParam == "all" {
		// 不设置 lr
	} else {
		params.Set("lr", engLang) // TS 总是设置 lr，默认 lang_en
	}
	// TS: cr 始终设置（countryUS 或空）
	cr := ""
	if country != "US" {
		cr = "country" + country
	}
	params.Set("cr", cr) // TS 始终设置 cr，美国为空
	params.Set("ie", "utf8")
	params.Set("oe", "utf8")

	u := fmt.Sprintf("https://%s/search?%s", subdomain, params.Encode())

	// 对应 TS: headers
	client := NewEngineHTTPClient(e.config)
	client.SetHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	// 对应 TS: lang?.replace("_", "-") || "en-US,en;q=0.9"
	if langParam != "" {
		client.SetHeader("Accept-Language", strings.ReplaceAll(langParam, "_", "-")+",en;q=0.9")
	} else {
		client.SetHeader("Accept-Language", "en-US,en;q=0.9")
	}
	client.SetHeader("User-Agent", genGoogleUA(country))
	client.SetHeader("Cookie", "CONSENT=YES+")
	for k, v := range headers {
		client.SetHeader(k, v)
	}

	status, body, err := client.Get(u, nil)
	if err != nil {
		return nil, err
	}
	// 对齐 s-code：非 2xx / 空 body / CAPTCHA 均返回空结果（zero_results），不触发熔断
	if status < 200 || status >= 400 {
		return []SearchResult{}, nil
	}
	if body == "" {
		return []SearchResult{}, nil
	}
	// CAPTCHA 检测: 对应 TS isGoogleCaptcha
	if isGoogleCaptcha(status, body) {
		return []SearchResult{}, nil
	}
	return parseGoogleResults(body, opts.NumResults)
}

// ── 百度 ──────────────────────────────────────────────

func newBaidu(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name:      "baidu",
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
		Headers: map[string]string{
			"Accept":          "application/json, text/javascript, */*; q=0.01",
			"Accept-Language": "zh-CN,zh;q=0.9",
			"Referer":         "https://www.baidu.com/",
		},
		URL: func(q string, n int) string {
			return "https://www.baidu.com/s?wd=" + url.QueryEscape(q) + "&rn=" + strconv.Itoa(minInt(n, 50)) + "&pn=0&tn=json"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			// 对应 TS: wappass/captcha 检测
			body := string(data)
			if strings.Contains(body, "wappass") || strings.Contains(body, "captcha") {
				return nil, nil
			}
			var resp struct {
				Feed *struct {
					Entry []struct {
						Title string `json:"title"`
						URL   string `json:"url"`
						Abs   string `json:"abs"`
						Time  int64  `json:"time"`
					} `json:"entry"`
				} `json:"feed"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			if resp.Feed == nil {
				return nil, nil
			}
			var results []SearchResult
			for _, entry := range resp.Feed.Entry {
				if len(results) >= max {
					break
				}
				// 对应 TS: if (!title || !url) continue
				title := strings.TrimSpace(UnescapeHTML(entry.Title))
				if title == "" || entry.URL == "" {
					continue
				}
				var pubDate int64
				if entry.Time > 0 {
					pubDate = entry.Time * 1000 // 百度返回秒级时间戳
				}
				results = append(results, SearchResult{
					Title: title, URL: entry.URL,
					Snippet: strings.TrimSpace(UnescapeHTML(entry.Abs)),
					Engine:  "baidu", Position: len(results) + 1,
					PublishedDate: pubDate,
				})
			}
			return results, nil
		},
	})(config)
}

// ── DuckDuckGo 三路 fallback 辅助 ─────────────────────
// 对应 s-code duckduckgo.ts：JSON API / Lite 通道 + vqd / suggestion 提取

const ddgUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"

// extractDDGVqd 从 DDG 主页 HTML 提取 vqd 令牌（对应 TS: /vqd\s*=\s*["']([^"']+)["']/ 及 input 变体）
func extractDDGVqd(html string) string {
	if m := regexp.MustCompile(`vqd\s*=\s*["']([^"']+)["']`).FindStringSubmatch(html); m != nil {
		return m[1]
	}
	if m := regexp.MustCompile(`<input[^>]*name=["']vqd["'][^>]*value=["']([^"']+)["']`).FindStringSubmatch(html); m != nil {
		return m[1]
	}
	return ""
}

// parseDdgJSON 解析 DDG d.js JSON 响应（对应 TS searchJsonApi 的 JSON 解析）
func parseDdgJSON(data []byte, maxResults int) ([]SearchResult, error) {
	var resp struct {
		Results []struct {
			U string `json:"u"`
			T string `json:"t"`
			A string `json:"a"`
		} `json:"results"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return []SearchResult{}, nil
	}
	results := make([]SearchResult, 0, len(resp.Results))
	pos := 0
	for _, r := range resp.Results {
		if len(results) >= maxResults {
			break
		}
		u := extractDDGURL(r.U)
		title := StripHTML(r.T)
		if u == "" || title == "" {
			continue
		}
		pos++
		results = append(results, SearchResult{
			Title: title, URL: u, Snippet: StripHTML(r.A),
			Engine: "duckduckgo", Position: pos, Category: "general",
		})
	}
	return results, nil
}

// parseDdgLiteHTML 解析 DDG Lite HTML 响应（对应 TS parseLiteResults）
func parseDdgLiteHTML(html string, maxResults int) ([]SearchResult, error) {
	results := make([]SearchResult, 0, 16)
	seen := make(map[string]bool)
	pos := 0
	// 表格结构：<tr>...<a href="URL">TITLE</a>...<td class="snippet">SNIPPET</td>
	tableRegex := regexp.MustCompile(`<tr[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<td[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/td>`)
	for _, m := range tableRegex.FindAllStringSubmatch(html, -1) {
		if len(results) >= maxResults {
			break
		}
		u := extractDDGURL(m[1])
		if u == "" || seen[u] {
			continue
		}
		seen[u] = true
		pos++
		results = append(results, SearchResult{
			Title: StripHTML(m[2]), URL: u, Snippet: StripHTML(m[3]),
			Engine: "duckduckgo", Position: pos, Category: "general",
		})
	}
	if len(results) > 0 {
		return results, nil
	}
	// 备用：div.result 结构
	divRegex := regexp.MustCompile(`<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/span>`)
	for _, m := range divRegex.FindAllStringSubmatch(html, -1) {
		if len(results) >= maxResults {
			break
		}
		u := extractDDGURL(m[1])
		if u == "" || seen[u] {
			continue
		}
		seen[u] = true
		pos++
		results = append(results, SearchResult{
			Title: StripHTML(m[2]), URL: u, Snippet: StripHTML(m[3]),
			Engine: "duckduckgo", Position: pos, Category: "general",
		})
	}
	return results, nil
}

// extractDdgSuggestion 提取 DDG 拼写建议（对应 TS extractSuggestion）
func extractDdgSuggestion(html string) string {
	// "Showing results for" 模式：spelling 容器内的 result__suggestion
	showingRegex := regexp.MustCompile(`class=["'][^"']*spelling[^"']*["'][^>]*>.*?class=["'][^"']*result__suggestion[^"']*["'][^>]*>([^<]+)`)
	if m := showingRegex.FindStringSubmatch(html); m != nil {
		if s := StripHTML(m[1]); s != "" {
			return s
		}
	}
	// 备选：<a class="result__suggestion" ...>
	linkRegex := regexp.MustCompile(`class=["'][^"']*result__suggestion[^"']*["'][^>]*>([^<]+)`)
	if m := linkRegex.FindStringSubmatch(html); m != nil {
		if s := StripHTML(m[1]); s != "" {
			return s
		}
	}
	// "Did you mean" 文本模式
	didYouMeanRegex := regexp.MustCompile(`(?i)did\s+you\s+mean[:\s]+([^<.]+)`)
	if m := didYouMeanRegex.FindStringSubmatch(html); m != nil {
		if s := StripHTML(m[1]); s != "" {
			return s
		}
	}
	return ""
}
