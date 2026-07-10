// 通用搜索引擎实现
package websearch

import (
	"encoding/json"
	"net/url"
	"strconv"
	"strings"
	"time"
)

func init() {
	register("duckduckgo", newDuckDuckGo)
	register("bing", newBing)
	register("brave", newBrave)
	register("google", newGoogle)
	register("baidu", newBaidu)
}

// ── DuckDuckGo ────────────────────────────────────────

func newDuckDuckGo(config EngineConfig) SearchEngine {
	return &ddgEngine{config: config}
}

type ddgEngine struct{ config EngineConfig }

func (e *ddgEngine) Name() string        { return "duckduckgo" }
func (e *ddgEngine) Config() EngineConfig { return e.config }
func (e *ddgEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	client.SetHeader("Content-Type", "application/x-www-form-urlencoded")
	client.SetHeader("Accept", "text/html")
	formData := map[string]string{"q": query, "b": "", "kl": "wt-wt"}
	status, body, err := client.PostForm("https://html.duckduckgo.com/html/", formData, nil)
	if err != nil {
		return nil, err
	}
	if status < 200 || status >= 400 {
		return nil, nil
	}
	if strings.Contains(body, "challenge-form") || strings.Contains(body, "captcha") {
		return nil, nil
	}
	return parseDdgHTML(body, opts.NumResults, "duckduckgo", "")
}

// ── Bing ──────────────────────────────────────────────

func newBing(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "bing",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.bing.com/search?q=" + url.QueryEscape(q) + "&setlang=en"
		},
		Parse: parseBingResults,
	})(config)
}

// ── Brave ─────────────────────────────────────────────

func newBrave(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "brave", Category: "general",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://api.search.brave.com/res/v1/web/search?q=" + url.QueryEscape(q) + "&count=" + strconv.Itoa(minInt(n, 20))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Web *struct {
					Results []struct {
						Title       string `json:"title"`
						URL         string `json:"url"`
						Description string `json:"description"`
					} `json:"results"`
				} `json:"web"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			if resp.Web == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resp.Web.Results {
				if i >= max {
					break
				}
				results = append(results, SearchResult{
					Title: r.Title, URL: r.URL, Snippet: r.Description,
					Engine: "brave", Position: i + 1, Category: "general",
				})
			}
			return results, nil
		},
	})(config)
}

// ── Google ────────────────────────────────────────────

func newGoogle(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "google",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.google.com/search?q=" + url.QueryEscape(q) + "&num=" + strconv.Itoa(minInt(opts.NumResults, 20))
		},
		Parse: parseGoogleResults,
	})(config)
}

// ── 百度 ──────────────────────────────────────────────

func newBaidu(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "baidu", UserAgent: RandomUserAgent(),
		URL: func(q string, n int) string {
			return "https://www.baidu.com/s?wd=" + url.QueryEscape(q) + "&rn=" + strconv.Itoa(minInt(n, 50)) + "&tn=json"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Feed *struct {
					Entry []struct {
						Title string `json:"title"`
						URL   string `json:"url"`
						Abs   string `json:"abs"`
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
			for i, entry := range resp.Feed.Entry {
				if i >= max {
					break
				}
				results = append(results, SearchResult{
					Title: UnescapeHTML(entry.Title), URL: entry.URL,
					Snippet: UnescapeHTML(entry.Abs), Engine: "baidu", Position: i + 1,
				})
			}
			return results, nil
		},
	})(config)
}
