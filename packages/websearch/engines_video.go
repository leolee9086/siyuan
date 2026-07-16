// 视频搜索引擎实现
package websearch

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func init() {
	register("youtube", newYouTube)
	register("bilibili", newBilibili)
	register("vimeo", newVimeo)
	register("dailymotion", newDailymotion)
	register("rumble", newRumble)
	register("odysee", newOdysee)
	register("bitchute", newBitchute)
	register("acfun", newAcfun)
	register("iqiyi", newIqiyi)
	register("sogou-videos", newSogouVideos)
	register("nicovideo", newNiconico)
	register("peertube", newPeerTube)
	register("sepiasearch", newSepiaSearch)
	register("google-videos", newGoogleVideos)
	register("bing-videos", newBingVideos)
	register("piped", newPiped)
	register("invidious", newInvidious)
}

// ── YouTube ───────────────────────────────────────────

func newYouTube(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "youtube",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.youtube.com/results?search_query=" + url.QueryEscape(q)
		},
		Headers: map[string]string{
			"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
			"Accept-Language": "en-US,en;q=0.9",
			"Accept":          "text/html",
			"Cookie":          "CONSENT=YES+",
		},
		Parse: parseYouTubeResults,
	})(config)
}

func parseYouTubeResults(body string, maxResults int) ([]SearchResult, error) {
	var results []SearchResult
	// 尝试从 ytInitialData JSON 提取
	re := regexp.MustCompile(`var ytInitialData\s*=\s*(\{[\s\S]*?\});?\s*</script>`)
	if m := re.FindStringSubmatch(body); len(m) > 1 {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(m[1]), &data); err == nil {
			if contents, ok := nestedMap(data, "contents", "twoColumnSearchResultsRenderer", "primaryContents", "sectionListRenderer", "contents"); ok {
				if arr, ok := contents.([]interface{}); ok && len(arr) > 0 {
					if first, ok := arr[0].(map[string]interface{}); ok {
						if section, ok := first["itemSectionRenderer"].(map[string]interface{}); ok {
							if items, ok := section["contents"].([]interface{}); ok {
								for i, item := range items {
									if len(results) >= maxResults {
										break
									}
									if m, ok := item.(map[string]interface{}); ok {
										if vr, ok := m["videoRenderer"].(map[string]interface{}); ok {
											title := youtubeRendererText(vr["title"])
											videoID := nestedStr(vr, "videoId")
											if title != "" && videoID != "" {
												results = append(results, SearchResult{
													Title: title, URL: "https://www.youtube.com/watch?v=" + videoID,
													Snippet: "", Engine: "youtube", Position: i + 1, Category: "video",
												})
											}
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}
	if len(results) == 0 {
		re2 := regexp.MustCompile(`"url":"/watch\?v=([^"]+)"[^}]*"title":{"runs":\[{"text":"([^"]+)"`)
		matches := re2.FindAllStringSubmatch(body, -1)
		for i, m := range matches {
			if i >= maxResults {
				break
			}
			results = append(results, SearchResult{
				Title: m[2], URL: "https://www.youtube.com/watch?v=" + m[1],
				Snippet: "", Engine: "youtube", Position: i + 1, Category: "video",
			})
		}
	}
	return results, nil
}

func youtubeRendererText(value interface{}) string {
		object, ok := value.(map[string]interface{})
		if !ok {
			return ""
		}
		if simple, ok := object["simpleText"].(string); ok {
			return simple
		}
		runs, ok := object["runs"].([]interface{})
		if !ok || len(runs) == 0 {
			return ""
		}
		first, ok := runs[0].(map[string]interface{})
		if !ok {
			return ""
		}
		text, _ := first["text"].(string)
		return text
}

// ── Bilibili ──────────────────────────────────────────

// hexChars Bilibili buvid3 随机十六进制字符集
var hexChars = "0123456789abcdefABCDEF"

// generateBuvid3 生成 Bilibili 所需的 buvid3 cookie（对应 TS generateBuvid3）
func generateBuvid3() string {
	b := make([]byte, 16)
	for i := range b {
		b[i] = hexChars[rand.IntN(len(hexChars))]
	}
	return string(b) + "infoc"
}

func newBilibili(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "bilibili", Category: "video",
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
		Headers: map[string]string{
			"Referer":         "https://www.bilibili.com/",
			"Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
			"Cookie":          "buvid3=" + generateBuvid3() + "; innersign=0; i-wanna-go-back=-1; b_ut=7; FEED_LIVE_VERSION=V8; header_theme_version=undefined; home_feed_column=4",
		},
		URL: func(q string, n int) string {
			return "https://api.bilibili.com/x/web-interface/search/type?keyword=" + url.QueryEscape(q) +
				"&search_type=video&page=1&page_size=" + strconv.Itoa(minInt(n, 50)) +
				"&single_column=0&__refresh__=true&platform=web"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data *struct {
					Result []struct {
						Title   string `json:"title"`
						Arcurl  string `json:"arcurl"`
						Desc    string `json:"description"`
						Pubdate int64  `json:"pubdate"`
					} `json:"result"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			if resp.Data == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resp.Data.Result {
				if i >= max {
					break
				}
				// 对应 TS sanitizeTitle: 先解 HTML 实体，再剥 <em> 标签
				title := strings.NewReplacer("&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", "\"", "&#x27;", "'", "&#x2F;", "/").Replace(r.Title)
				title = reStripTags.ReplaceAllString(title, "")
				title = strings.TrimSpace(title)
				if title == "" || r.Arcurl == "" {
					continue
				}
				var pubDate int64
				if r.Pubdate > 0 {
					pubDate = r.Pubdate * 1000 // Bilibili 返回秒级时间戳
				}
				results = append(results, SearchResult{
					Title: title, URL: r.Arcurl,
					Snippet: r.Desc, Engine: "bilibili", Position: i + 1, Category: "video",
					PublishedDate: pubDate,
				})
			}
			return results, nil
		},
	})(config)
}

func init() { register("bilibili", newBilibili) }

// ── 其余视频引擎（site-scoped）────────────────────────

// ── Vimeo ──────────────────────────────────────────────

func newVimeo(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "vimeo",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://vimeo.com/search?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/(\d+))"[^>]*>[\s\S]*?<div[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/div>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := strings.TrimSpace(StripHTML(m[3]))
				if title == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: "https://vimeo.com" + m[1], Snippet: "", Engine: "vimeo", Position: pos, Category: "video"})
			}
			return results, nil
		},
	})(config)
}

// ── Dailymotion ─────────────────────────────────────────

func newDailymotion(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "dailymotion", Category: "video", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://api.dailymotion.com/videos?search=" + url.QueryEscape(q) + "&sort=relevance&limit=" + strconv.Itoa(minInt(n, 50)) + "&fields=title,url,description,created_time,duration"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				List []struct {
					Title, URL, Description string
					CreatedTime             int64 `json:"created_time"`
					Duration                int
				} `json:"list"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.List == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.List {
				if i >= max || item.Title == "" || item.URL == "" {
					break
				}
				results = append(results, SearchResult{Title: item.Title, URL: item.URL, Snippet: fmt.Sprintf("%s — %s", formatDuration(item.Duration), StripHTML(truncate(item.Description, 200))), Engine: "dailymotion", Position: i + 1, Category: "video", PublishedDate: item.CreatedTime * 1000})
			}
			return results, nil
		},
	})(config)
}

// ── Rumble ──────────────────────────────────────────────

func newRumble(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "rumble",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://rumble.com/search/video?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<li[^>]*class="[^"]*video-listing-entry[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*video-item--a[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*video-item--title[^"]*"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<span[^>]*class="[^"]*video-item--views[^"]*"[^>]*data-value="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				if title == "" {
					continue
				}
				href, views := m[1], m[3]
				if !strings.HasPrefix(href, "http") {
					href = "https://rumble.com" + href
				}
				pos++
				snippet := "Rumble video"
				if views != "" {
					snippet = views + " views"
				}
				results = append(results, SearchResult{Title: title, URL: href, Snippet: snippet, Engine: "rumble", Position: pos, Category: "video"})
			}
			return results, nil
		},
	})(config)
}

// ── Odysee ──────────────────────────────────────────────

type odyseeEngine struct{ config EngineConfig }

func (e *odyseeEngine) Name() string         { return "odysee" }
func (e *odyseeEngine) Config() EngineConfig { return e.config }
func (e *odyseeEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewEngineHTTPClient(e.config)
	body := fmt.Sprintf(`{"jsonrpc":"2.0","method":"search","params":{"query":"%s","page":1,"limit":%d,"nsfw":false}}`, query, minInt(opts.NumResults, 20))
	status, resp, err := client.PostJSON("https://api.na-backend.odysee.com/api/v1/proxy", body, nil)
	if err != nil || status < 200 || status >= 400 {
		return nil, nil
	}
	var data struct {
		Result []struct {
			Name, Title, Description, ClaimID, ChannelName string
			Duration                                       int
			ViewCount, CreationTimestamp                   int64
		} `json:"result"`
	}
	if err := json.Unmarshal([]byte(resp), &data); err != nil {
		return nil, nil
	}
	var results []SearchResult
	for i, item := range data.Result {
		if i >= opts.NumResults || (item.Title == "" && item.Name == "") {
			break
		}
		title := item.Title
		if title == "" {
			title = item.Name
		}
		var parts []string
		if item.ChannelName != "" {
			parts = append(parts, item.ChannelName)
		}
		if item.ViewCount > 0 {
			parts = append(parts, formatViews(item.ViewCount)+" views")
		}
		if item.Duration > 0 {
			parts = append(parts, formatDuration(item.Duration))
		}
		url := "https://odysee.com/" + item.ChannelName + "/" + item.Name
		if item.Name == "" {
			url = "https://odysee.com/" + item.ClaimID
		}
		snippet := strings.Join(parts, " · ")
		if snippet == "" {
			snippet = truncate(item.Description, 300)
		}
		results = append(results, SearchResult{Title: title, URL: url, Snippet: truncate(snippet, 300), Engine: "odysee", Position: i + 1, Category: "video", PublishedDate: item.CreationTimestamp * 1000})
	}
	return results, nil
}
func newOdysee(config EngineConfig) SearchEngine { return &odyseeEngine{config: config} }

// ── BitChute ────────────────────────────────────────────

type bitchuteEngine struct{ config EngineConfig }

func (e *bitchuteEngine) Name() string         { return "bitchute" }
func (e *bitchuteEngine) Config() EngineConfig { return e.config }
func (e *bitchuteEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewEngineHTTPClient(e.config)
	body := fmt.Sprintf(`{"offset":0,"limit":%d,"query":"%s","sensitivity_id":"normal","sort":"new"}`, minInt(opts.NumResults, 50), query)
	status, resp, err := client.PostJSON("https://api.bitchute.com/api/beta/search/videos", body, nil)
	if err != nil || status < 200 || status >= 400 {
		return nil, nil
	}
	var data struct {
		Videos []struct {
			VideoID, VideoName, Description, Duration, DatePublished string
			ViewCount                                                int64
			Channel                                                  *struct{ ChannelName string } `json:"channel"`
		} `json:"videos"`
	}
	if err := json.Unmarshal([]byte(resp), &data); err != nil {
		return nil, nil
	}
	var results []SearchResult
	for i, item := range data.Videos {
		if i >= opts.NumResults || item.VideoID == "" || item.VideoName == "" {
			break
		}
		author := ""
		if item.Channel != nil {
			author = item.Channel.ChannelName
		}
		var parts []string
		if author != "" {
			parts = append(parts, author)
		}
		if item.Duration != "" {
			parts = append(parts, item.Duration)
		}
		if item.ViewCount > 0 {
			parts = append(parts, fmt.Sprintf("%d views", item.ViewCount))
		}
		snippet := ""
		if len(parts) > 0 {
			snippet = "[" + strings.Join(parts, " · ") + "]" + item.Description
		} else {
			snippet = item.Description
			if snippet == "" {
				snippet = "BitChute video"
			}
		}
		var ts int64
		if item.DatePublished != "" {
			if t, err := time.Parse(time.RFC3339, item.DatePublished); err == nil {
				ts = t.UnixMilli()
			}
		}
		results = append(results, SearchResult{Title: item.VideoName, URL: "https://www.bitchute.com/video/" + item.VideoID, Snippet: truncate(snippet, 300), Engine: "bitchute", Position: i + 1, Category: "video", PublishedDate: ts})
	}
	return results, nil
}
func newBitchute(config EngineConfig) SearchEngine { return &bitchuteEngine{config: config} }

// ── AcFun ───────────────────────────────────────────────

func newAcfun(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "acfun",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.acfun.cn/search?keyword=" + url.QueryEscape(q) + "&pCursor=1"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			pipeRe := regexp.MustCompile(`bigPipe\.onPageletArrive\((\{[\s\S]*?\})\);`)
			for _, pm := range pipeRe.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				var pagelet struct {
					HTML string `json:"html"`
				}
				if err := json.Unmarshal([]byte(pm[1]), &pagelet); err != nil || pagelet.HTML == "" {
					continue
				}
				videoRe := regexp.MustCompile(`<div[^>]*class="[^"]*search-video[^"]*"[^>]*data-exposure-log='([^']+)'[^>]*>([\s\S]*?)<\/div>\s*<\/div>`)
				for _, vm := range videoRe.FindAllStringSubmatch(pagelet.HTML, -1) {
					if len(results) >= max {
						break
					}
					var expo struct{ ContentID, Title string }
					if err := json.Unmarshal([]byte(vm[1]), &expo); err != nil || expo.ContentID == "" || expo.Title == "" {
						continue
					}
					dur := regexp.MustCompile(`duration[^>]*>([^<]+)<`).FindStringSubmatch(vm[2])
					tm := regexp.MustCompile(`create-time[^>]*>([^<]+)<`).FindStringSubmatch(vm[2])
					parts := []string{}
					if len(dur) > 1 {
						parts = append(parts, strings.TrimSpace(dur[1]))
					}
					if len(tm) > 1 {
						parts = append(parts, strings.TrimSpace(tm[1]))
					}
					pos++
					results = append(results, SearchResult{Title: expo.Title, URL: "https://www.acfun.cn/v/ac" + expo.ContentID, Snippet: strings.Join(parts, " · "), Engine: "acfun", Position: pos, Category: "video"})
				}
			}
			return results, nil
		},
	})(config)
}

// ── iQiyi ───────────────────────────────────────────────

func newIqiyi(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name:     "iqiyi",
		BuildURL: func(q string, opts SearchOptions) string { return "https://so.iqiyi.com/so/q_" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="([^"]*)"[^>]*class="[^"]*[Ss]earch-[Rr]esult[Ii]tem[^"]*"[^>]*>[\s\S]*?<img[^>]*src="[^"]*"[^>]*alt="([^"]*)"[^>]*>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				if m[2] == "" || m[1] == "" {
					continue
				}
				href := m[1]
				if strings.HasPrefix(href, "//") {
					href = "https:" + href
				} else if strings.HasPrefix(href, "/") {
					href = "https:" + href
				}
				pos++
				results = append(results, SearchResult{Title: m[2], URL: href, Snippet: "iQiyi video", Engine: "iqiyi", Position: pos, Category: "video"})
			}
			if len(results) == 0 {
				fbRe := regexp.MustCompile(`<a[^>]*href="(/video/[^"]*)"[^>]*>[\s\S]*?<img[^>]*src="[^"]*"[^>]*alt="([^"]*)"[^>]*>`)
				for _, m := range fbRe.FindAllStringSubmatch(body, -1) {
					if len(results) >= max {
						break
					}
					if m[2] == "" {
						continue
					}
					href := m[1]
					if strings.HasPrefix(href, "//") {
						href = "https:" + href
					} else if strings.HasPrefix(href, "/") {
						href = "https:" + href
					}
					pos++
					results = append(results, SearchResult{Title: m[2], URL: href, Snippet: "iQiyi video", Engine: "iqiyi", Position: pos, Category: "video"})
				}
			}
			return results, nil
		},
	})(config)
}

// ── Niconico ────────────────────────────────────────────

func newNiconico(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "nicovideo",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.nicovideo.jp/search/" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<li[^>]*data-video-item[^>]*>[\s\S]*?<a[^>]*class="[^"]*itemThumbWrap[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*videoLength[^"]*"[^>]*>([\d:]+)<\/span>[\s\S]*?<p[^>]*class="[^"]*itemTitle[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title, vidLen := StripHTML(m[3]), strings.TrimSpace(m[2])
				if title == "" || m[1] == "" {
					continue
				}
				vidID := regexp.MustCompile(`/watch/([a-z0-9]+)`).FindStringSubmatch(m[1])
				id := ""
				if len(vidID) > 1 {
					id = vidID[1]
				} else {
					ps := strings.Split(m[1], "/")
					id = ps[len(ps)-1]
				}
				pos++
				results = append(results, SearchResult{Title: title + " (" + vidLen + ")", URL: "https://www.nicovideo.jp/watch/" + id, Snippet: "Niconico · " + vidLen, Engine: "nicovideo", Position: pos, Category: "video"})
			}
			if len(results) == 0 {
				fbRe := regexp.MustCompile(`href="/watch/([a-z0-9]+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"`)
				for _, m := range fbRe.FindAllStringSubmatch(body, -1) {
					if len(results) >= max {
						break
					}
					title := strings.TrimSpace(m[2])
					if title == "" {
						continue
					}
					pos++
					results = append(results, SearchResult{Title: title, URL: "https://www.nicovideo.jp/watch/" + m[1], Snippet: "Niconico video", Engine: "nicovideo", Position: pos, Category: "video"})
				}
			}
			return results, nil
		},
	})(config)
}

// ── PeerTube ────────────────────────────────────────────

func newPeerTube(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "peertube", Category: "video", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://peer.tube/api/v1/search/videos?search=" + url.QueryEscape(q) + "&searchTarget=search-index&resultType=videos&count=" + strconv.Itoa(minInt(n, 50)) + "&sort=-match&nsfw=both"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data []struct {
					URL, Name, Description, PublishedAt string
					Duration, Views                     int
					Channel                             *struct{ DisplayName, Name, Host string }
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, v := range resp.Data {
				if i >= max || v.URL == "" || v.Name == "" {
					break
				}
				cn := ""
				host := ""
				if v.Channel != nil {
					cn = v.Channel.DisplayName
					if cn == "" {
						cn = v.Channel.Name
					}
					host = v.Channel.Host
				}
				var parts []string
				if cn != "" {
					parts = append(parts, cn)
				}
				if host != "" {
					parts = append(parts, "@"+host)
				}
				if v.Duration > 0 {
					parts = append(parts, formatDuration(v.Duration))
				}
				if v.Views > 0 {
					parts = append(parts, fmt.Sprintf("%d views", v.Views))
				}
				snippet := strings.Join(parts, " · ")
				if snippet == "" {
					snippet = "PeerTube video"
				}
				var ts int64
				if v.PublishedAt != "" {
					if t, err := time.Parse(time.RFC3339, v.PublishedAt); err == nil {
						ts = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{Title: v.Name, URL: v.URL, Snippet: snippet, Engine: "peertube", Position: i + 1, Category: "video", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}

// ── SepiaSearch ─────────────────────────────────────────

func newSepiaSearch(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "sepiasearch", Category: "video", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://sepiasearch.org/api/v1/search/videos?search=" + url.QueryEscape(q) + "&start=0&count=" + strconv.Itoa(minInt(n, 20)) + "&sort=-createdAt"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data []struct {
					UUID, Name, URL, Description, CreatedAt string
					Duration, Views                         int
					Channel                                 *struct{ Name string }
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, v := range resp.Data {
				if i >= max || v.Name == "" || (v.UUID == "" && v.URL == "") {
					break
				}
				cn := ""
				if v.Channel != nil {
					cn = v.Channel.Name
				}
				parts := []string{}
				if cn != "" {
					parts = append(parts, cn)
				}
				if v.Duration > 0 {
					parts = append(parts, formatDuration(v.Duration))
				}
				if v.Views > 0 {
					parts = append(parts, fmt.Sprintf("%d views", v.Views))
				}
				u := v.URL
				if u == "" {
					u = "https://sepiasearch.org/videos/watch/" + v.UUID
				}
				var ts int64
				if v.CreatedAt != "" {
					if t, err := time.Parse(time.RFC3339, v.CreatedAt); err == nil {
						ts = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{Title: v.Name, URL: u, Snippet: strings.Join(parts, " · "), Engine: "sepiasearch", Position: i + 1, Category: "video", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}

// ── Google Videos ──────────────────────────────────────

func newGoogleVideos(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "google-videos",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.google.com/search?tbm=vid&q=" + url.QueryEscape(q)
		},
		Headers: map[string]string{"Cookie": "CONSENT=YES+"},
		Parse: func(body string, max int) ([]SearchResult, error) {
			results, _ := parseGoogleResults(body, max)
			for i := range results {
				results[i].Engine = "google-videos"
				results[i].Category = "video"
			}
			return results, nil
		},
	})(config)
}

// ── Bing Videos ─────────────────────────────────────────

func newBingVideos(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "bing-videos",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.bing.com/videos/search?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			results, _ := parseBingResults(body, max)
			for i := range results {
				results[i].Engine = "bing-videos"
				results[i].Category = "video"
			}
			return results, nil
		},
	})(config)
}

// ── Piped ───────────────────────────────────────────────

type pipedEngine struct{ config EngineConfig }

func (e *pipedEngine) Name() string         { return "piped" }
func (e *pipedEngine) Config() EngineConfig { return e.config }
func (e *pipedEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	instances := []string{"https://pipedapi.kavin.rocks", "https://pipedapi.adminforge.de", "https://api.piped.yt"}
	var all []SearchResult
	seen := map[string]bool{}
	for _, inst := range instances {
		if len(all) >= opts.NumResults {
			break
		}
		client := NewEngineHTTPClient(e.config)
		status, resp, err := client.Get(inst+"/search?q="+url.QueryEscape(query)+"&filter=videos", map[string]string{"Accept": "application/json"})
		if err != nil || status < 200 || status >= 400 {
			continue
		}
		var data struct {
			Items []struct {
				URL, Title, UploaderName, UploadedDate string
				Views, Duration                        int
			} `json:"items"`
		}
		if err := json.Unmarshal([]byte(resp), &data); err != nil {
			continue
		}
		for _, item := range data.Items {
			if len(all) >= opts.NumResults || item.Title == "" || item.URL == "" || seen[item.URL] {
				continue
			}
			seen[item.URL] = true
			var parts []string
			if item.UploaderName != "" {
				parts = append(parts, item.UploaderName)
			}
			if item.Views > 0 {
				parts = append(parts, formatViews(int64(item.Views))+" views")
			}
			if item.Duration > 0 {
				parts = append(parts, formatDuration(item.Duration))
			}
			var ts int64
			if item.UploadedDate != "" {
				if t, err := time.Parse(time.RFC3339, item.UploadedDate); err == nil {
					ts = t.UnixMilli()
				}
			}
			all = append(all, SearchResult{Title: item.Title, URL: "https://piped.video" + item.URL, Snippet: strings.Join(parts, " · "), Engine: "piped", Position: len(all) + 1, Category: "video", PublishedDate: ts})
		}
	}
	return all, nil
}
func newPiped(config EngineConfig) SearchEngine { return &pipedEngine{config: config} }

// ── Invidious ───────────────────────────────────────────

type invidiousEngine struct{ config EngineConfig }

func (e *invidiousEngine) Name() string         { return "invidious" }
func (e *invidiousEngine) Config() EngineConfig { return e.config }
func (e *invidiousEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	instances := []string{"https://vid.puffyan.us", "https://invidious.nerdvpn.de", "https://invidious.privacyredirect.com"}
	var all []SearchResult
	seen := map[string]bool{}
	for _, inst := range instances {
		if len(all) >= opts.NumResults {
			break
		}
		client := NewEngineHTTPClient(e.config)
		status, resp, err := client.Get(inst+"/api/v1/search?q="+url.QueryEscape(query)+"&type=video", map[string]string{"Accept": "application/json"})
		if err != nil || status < 200 || status >= 400 {
			continue
		}
		var items []struct {
			VideoID, Title, Author, PublishedText, Description string
			ViewCount                                          int64
			LengthSeconds                                      int
		}
		if err := json.Unmarshal([]byte(resp), &items); err != nil {
			continue
		}
		for _, item := range items {
			if len(all) >= opts.NumResults || item.Title == "" || item.VideoID == "" || seen[item.VideoID] {
				continue
			}
			seen[item.VideoID] = true
			var parts []string
			if item.Author != "" {
				parts = append(parts, item.Author)
			}
			if item.ViewCount > 0 {
				parts = append(parts, formatViews(item.ViewCount)+" views")
			}
			if item.LengthSeconds > 0 {
				parts = append(parts, formatDuration(item.LengthSeconds))
			}
			if item.PublishedText != "" {
				parts = append(parts, item.PublishedText)
			}
			snippet := strings.Join(parts, " · ")
			if snippet == "" {
				snippet = truncate(item.Description, 300)
			}
			all = append(all, SearchResult{Title: item.Title, URL: "https://invidious.nerdvpn.de/watch?v=" + item.VideoID, Snippet: truncate(snippet, 300), Engine: "invidious", Position: len(all) + 1, Category: "video"})
		}
	}
	return all, nil
}
func newInvidious(config EngineConfig) SearchEngine { return &invidiousEngine{config: config} }

// ── Sogou Videos ────────────────────────────────────────

func newSogouVideos(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "sogou-videos", Category: "video", UserAgent: RandomUserAgent(),
		URL: func(q string, n int) string {
			return "https://v.sogou.com/api/video/shortVideoV2?page=1&pagesize=" + strconv.Itoa(minInt(n, 20)) + "&query=" + url.QueryEscape(q)
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data *struct {
					List []struct{ TitleEsc, URL, Site, Date, Duration string } `json:"list"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.Data == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.Data.List {
				if i >= max || item.TitleEsc == "" || item.URL == "" {
					break
				}
				u := item.URL
				if strings.HasPrefix(u, "/") {
					u = "https://v.sogou.com" + u
				}
				parts := []string{}
				if item.Site != "" {
					parts = append(parts, item.Site)
				}
				if item.Duration != "" {
					parts = append(parts, item.Duration)
				}
				var ts int64
				if item.Date != "" {
					if t, err := time.Parse("2006-01-02", item.Date); err == nil {
						ts = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{Title: item.TitleEsc, URL: u, Snippet: strings.Join(parts, " · "), Engine: "sogou-videos", Position: i + 1, Category: "video", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}

// ── Helper functions for video engines ──────────────────

func formatViews(views int64) string {
	if views >= 1_000_000 {
		return fmt.Sprintf("%.1fM", float64(views)/1_000_000)
	}
	if views >= 1_000 {
		return fmt.Sprintf("%.1fK", float64(views)/1_000)
	}
	return strconv.FormatInt(views, 10)
}

func formatDuration(seconds int) string {
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	if h > 0 {
		return fmt.Sprintf("%d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%d:%02d", m, s)
}

func truncate(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}
