// 社交/媒体搜索引擎实现
package websearch

import (
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func init() {
	register("weibo", newWeibo)
	register("zhihu", newZhihu)
	register("xiaohongshu", newXiaohongshu)
	register("reddit", newReddit)
	register("sogou-wechat", newSogouWeChat)
	register("douban", newDouban)
	register("twitter", newTwitter)
	register("mastodon", newMastodon)
	register("lemmy", newLemmy)
	register("discourse", newDiscourse)
	register("boardreader", newBoardreader)
	register("tootfinder", newTootfinder)
	register("bandcamp", newBandcamp)
	register("genius", newGenius)
	register("deezer", newDeezer)
	register("mixcloud", newMixcloud)
	register("soundcloud", newSoundCloud)
	register("spotify", newSpotify)
	register("yandex-music", newYandexMusic)
	register("fyyd", newFyyd)
	register("freesound", newFreesound)
	register("radio-browser", newRadioBrowser)
	register("unsplash", newUnsplash)
	register("pixabay", newPixabay)
	register("pexels", newPexels)
	register("flickr", newFlickr)
	register("pinterest", newPinterest)
	register("deviantart", newDeviantArt)
	register("imgur", newImgur)
	register("pixiv", newPixiv)
	register("500px", new500px)
	register("wallhaven", newWallhaven)
	register("openverse", newOpenverse)
	register("adobe-stock", newAdobeStock)
	register("findthatmeme", newFindThatMeme)
	register("tineye", newTinEye)
	register("google-images", newGoogleImages)
	register("bing-images", newBingImages)
	register("sogou-images", newSogouImages)
	register("naver", newNaver)
	register("startpage", newStartpage)
	register("qwant", newQwant)
	register("yahoo", newYahoo)
	register("yep", newYep)
	register("mojeek", newMojeek)
	register("seznam", newSeznam)
	register("aol", newAol)
	register("gmx", newGmx)
	register("mwmbl", newMwmbl)
	register("grokipedia", newGrokipedia)
	register("sogou", newSogou)
	register("360search", new360Search)
	register("chinaso", newChinaSo)
	register("quark", newQuark)
	register("yandex", newYandex)
}

// ── 微博 ──────────────────────────────────────────────

var weiboResultRegexp = regexp.MustCompile(`<div[^>]*class="[^"]*card-wrap[^"]*"[^>]*>[\s\S]*?<p[^>]*class="[^"]*txt[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)

func newWeibo(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "weibo",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://s.weibo.com/weibo?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			matches := weiboResultRegexp.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= max {
					break
				}
				u := m[1]
				if strings.HasPrefix(u, "/") {
					u = "https://s.weibo.com" + u
				}
				title := StripHTML(m[2])
				if title == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: u, Snippet: "",
					Engine: "weibo", Position: pos, Category: "social",
				})
			}
			return results, nil
		},
	})(config)
}

// ── 知乎 ──────────────────────────────────────────────

func newZhihu(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "zhihu",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.zhihu.com/search?q=" + url.QueryEscape(q) + "&type=content"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/(?:question|answer|zvideo)/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*RichText[^"]*"[^>]*>([\s\S]*?)<\/span>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				if title == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: "https://www.zhihu.com" + m[1], Snippet: "",
					Engine: "zhihu", Position: pos, Category: "social",
				})
			}
			return results, nil
		},
	})(config)
}

// ── 小红书 ─────────────────────────────────────────

func newXiaohongshu(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "xiaohongshu",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.xiaohongshu.com/search_result?keyword=" + url.QueryEscape(q) + "&source=web_search_result_notes"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*class="[^"]*note-item[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= max {
					break
				}
				href := m[1]
				if strings.HasPrefix(href, "/") {
					href = "https://www.xiaohongshu.com" + href
				}
				title := m[2]
				if title == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: href, Snippet: "小红书笔记",
					Engine: "xiaohongshu", Position: pos, Category: "social",
				})
			}
			return results, nil
		},
	})(config)
}

// ── Reddit ────────────────────────────────────────────

func newReddit(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "reddit",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.reddit.com/search/?q=" + url.QueryEscape(q)
		},
		Headers: map[string]string{
			"User-Agent": "opencode-search/1.0 (by /u/opencode)",
			"Accept":     "text/html",
		},
		Parse: func(body string, maxResults int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*id="[^"]*"[^>]*class="[^"]*search-result[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<faceplate-screen-reader-content>([\s\S]*?)<\/faceplate-screen-reader-content>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= maxResults {
					break
				}
				u := m[1]
				if strings.HasPrefix(u, "/r/") {
					u = "https://www.reddit.com" + u
				}
				title := strings.TrimSpace(m[2])
				if title == "" || u == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: u, Snippet: "",
					Engine: "reddit", Position: pos, Category: "social",
				})
			}
			return results, nil
		},
	})(config)
}

// ── 搜狗微信 ──────────────────────────────────────────

func newSogouWeChat(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "sogou-wechat",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://weixin.sogou.com/weixin?query=" + url.QueryEscape(q) + "&type=2"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<li[^>]*id="sogou_vr_[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				u := m[1]
				if !strings.HasPrefix(u, "http") {
					u = "https://weixin.sogou.com" + u
				}
				if title == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: u, Snippet: "微信公众号",
					Engine: "sogou-wechat", Position: pos, Category: "social",
				})
			}
			return results, nil
		},
	})(config)
}

// ── 其余社交/媒体引擎（site-scoped）───────────────────

// ── Douban ─────────────────────────────────────────────

func newDouban(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "douban",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.douban.com/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="result"[^>]*>[\s\S]*?<div[^>]*class="title"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				url := m[1]; if strings.HasPrefix(url, "//") { url = "https:" + url }
				title := StripHTML(m[2])
				if title == "" || url == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: "", Engine: "douban", Position: pos, Category: "social"})
			}
			return results, nil
		},
	})(config)
}

func newTwitter(config EngineConfig) SearchEngine {
	return &twitterEngine{config: config}
}

type twitterEngine struct{ config EngineConfig }

func (e *twitterEngine) Name() string        { return "twitter" }
func (e *twitterEngine) Config() EngineConfig { return e.config }
func (e *twitterEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	nitterInstances := []string{"https://nitter.net", "https://nitter.privacydev.net", "https://nitter.poast.org"}
	for _, instance := range nitterInstances {
		client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
		client.SetHeader("Accept", "text/html")
		url := instance + "/search?q=" + url.QueryEscape(query) + "&f=tweets"
		status, body, err := client.Get(url, nil)
		if err != nil || status < 200 || status >= 400 {
			continue
		}
		if results := parseNitterResults(body, opts.NumResults); len(results) > 0 {
			return results, nil
		}
	}
	return tryTwitterDirect(query, opts.NumResults, e.config.Timeout)
}

func parseNitterResults(body string, maxResults int) []SearchResult {
	var results []SearchResult
	re := regexp.MustCompile(`<div[^>]*class="timeline-item"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>`)
	matches := re.FindAllString(body, -1)
	for _, block := range matches {
		if len(results) >= maxResults {
			break
		}
		userMatch := regexp.MustCompile(`<span[^>]*class="username"[^>]*>([\s\S]*?)<\/span>`).FindStringSubmatch(block)
		username := ""
		if userMatch != nil {
			username = strings.TrimSpace(strings.Replace(userMatch[1], "@", "", 1))
		}
		contentMatch := regexp.MustCompile(`<div[^>]*class="tweet-content"[^>]*>([\s\S]*?)<\/div>`).FindStringSubmatch(block)
		content := ""
		if contentMatch != nil {
			content = StripHTML(contentMatch[1])
		}
		linkMatch := regexp.MustCompile(`<a[^>]*href="/[\w]+/status/(\d+)"`).FindStringSubmatch(block)
		if linkMatch == nil {
			continue
		}
		tweetID := linkMatch[1]
		dateStr := ""
		if dateMatch := regexp.MustCompile(`<a[^>]*class="tweet-date"[^>]*>[\s\S]*?<\/a>`).FindStringSubmatch(block); dateMatch != nil {
			dateStr = StripHTML(dateMatch[1])
		}
		stats := ""
		if sm := regexp.MustCompile(`<div[^>]*class="tweet-stat"[^>]*>[\s\S]*?<\/div>`).FindAllString(block, -1); len(sm) > 0 {
			sp := make([]string, 0, len(sm))
			for _, s := range sm {
				sp = append(sp, StripHTML(s))
			}
			stats = strings.Join(sp, " ")
		}
		title := "Tweet"
		if username != "" {
			title = "@" + username
		}
		snippetParts := []string{content, dateStr, stats}
		snippet := strings.Join(snippetParts, " | ")
		if len(snippet) > 300 {
			snippet = snippet[:300]
		}
		var publishedDate int64
		if rd := ParseRelativeDate(dateStr); rd != nil {
			publishedDate = *rd
		}
		results = append(results, SearchResult{
			Title: title, URL: "https://x.com/" + username + "/status/" + tweetID,
			Snippet: snippet, Engine: "twitter", Position: len(results) + 1, Category: "social",
			PublishedDate: publishedDate,
		})
	}
	return results
}

func tryTwitterDirect(query string, numResults int, timeout int) ([]SearchResult, error) {
	client := NewHTTPClient(time.Duration(timeout) * time.Millisecond)
	client.SetHeader("Accept", "text/html")
	client.SetHeader("Cookie", "guest_id=; gt=1")
	url := "https://x.com/search?q=" + url.QueryEscape(query) + "&src=typed_query&f=live"
	status, body, err := client.Get(url, nil)
	if err != nil || status < 200 || status >= 400 {
		return nil, nil
	}
	re := regexp.MustCompile(`"globalObjects"\s*:\s*(\{[\s\S]*?\})\s*[,}]?\s*\}`)
	if m := re.FindStringSubmatch(body); len(m) > 1 {
		var data map[string]interface{}
		if json.Unmarshal([]byte(m[1]), &data) == nil {
			if tweets, ok := data["tweets"].(map[string]interface{}); ok {
				var results []SearchResult
				for _, tv := range tweets {
					if len(results) >= numResults {
						break
					}
					t, _ := tv.(map[string]interface{})
					if t == nil {
						continue
					}
					fullText, _ := t["full_text"].(string)
					if fullText == "" {
						continue
					}
					screenName, _ := t["user_screen_name"].(string)
					idStr, _ := t["id_str"].(string)
					title := "Tweet"
					if screenName != "" {
						title = "@" + screenName
					}
					snippet := fullText
					if len(snippet) > 300 {
						snippet = snippet[:300]
					}
					var publishedDate int64
					if createdAt, ok := t["created_at"].(string); ok {
						if parsed, err := time.Parse(time.RubyDate, createdAt); err == nil {
							publishedDate = parsed.UnixMilli()
						}
					}
					results = append(results, SearchResult{
						Title: title, URL: "https://x.com/" + screenName + "/status/" + idStr,
						Snippet: snippet, Engine: "twitter", Position: len(results) + 1, Category: "social",
						PublishedDate: publishedDate,
					})
				}
				if len(results) > 0 {
					return results, nil
				}
			}
		}
	}
	return nil, nil
}
// ── Mastodon ───────────────────────────────────────────

func newMastodon(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "mastodon", Category: "social", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://mastodon.social/api/v2/search?q=" + url.QueryEscape(q) + "&resolve=false&type=accounts&limit=" + strconv.Itoa(minInt(n, 40))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Accounts []struct{ URI, Username, DisplayName, Note, CreatedAt string; FollowersCount int `json:"followers_count"` } `json:"accounts"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, a := range resp.Accounts {
				if i >= max || a.URI == "" || a.Username == "" { break }
				displayName := a.DisplayName; if displayName == "" { displayName = a.Username }
				ts, _ := time.Parse(time.RFC3339, a.CreatedAt)
				results = append(results, SearchResult{Title: fmt.Sprintf("%s (%d followers)", displayName, a.FollowersCount), URL: a.URI, Snippet: StripHTML(a.Note), Engine: "mastodon", Position: i + 1, Category: "social", PublishedDate: ts.UnixMilli()})
			}
			return results, nil
		},
	})(config)
}

// ── Lemmy ──────────────────────────────────────────────

func newLemmy(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "lemmy", Category: "social", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://lemmy.ml/api/v3/search?q=" + url.QueryEscape(q) + "&type_=Posts&limit=" + strconv.Itoa(minInt(n, 50)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Posts []struct{ Post *struct{ ApID, Name, Body, Published string } `json:"post"`; Creator *struct{ Name, DisplayName string }; Community *struct{ Title string }; Counts *struct{ Upvotes, Downvotes, Comments int } } `json:"posts"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, p := range resp.Posts {
				if i >= max || p.Post == nil || p.Post.ApID == "" || p.Post.Name == "" { break }
				author := ""; if p.Creator != nil { author = p.Creator.DisplayName; if author == "" { author = p.Creator.Name } }
				community := ""; if p.Community != nil { community = p.Community.Title }
				up, down, cmt := 0, 0, 0; if p.Counts != nil { up, down, cmt = p.Counts.Upvotes, p.Counts.Downvotes, p.Counts.Comments }
				parts := []string{}
				if author != "" { parts = append(parts, "by "+author) }
				if community != "" { parts = append(parts, community) }
				parts = append(parts, fmt.Sprintf("▲%d ▼%d", up, down))
				if cmt > 0 { parts = append(parts, fmt.Sprintf("%d comments", cmt)) }
				var ts int64; if p.Post.Published != "" { if t, err := time.Parse(time.RFC3339, p.Post.Published); err == nil { ts = t.UnixMilli() } }
				results = append(results, SearchResult{Title: p.Post.Name, URL: p.Post.ApID, Snippet: strings.Join(parts, " · "), Engine: "lemmy", Position: i + 1, Category: "social", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}

// ── Discourse ──────────────────────────────────────────

func newDiscourse(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "discourse", Category: "social", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://meta.discourse.org/search.json?q=" + url.QueryEscape(q) + "+order:latest" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Topics []struct{ ID int; Title, CreatedAt string; PostsCount int `json:"posts_count"`; Closed, HasAcceptedAnswer bool `json:"has_accepted_answer"` } `json:"topics"`; Posts []struct{ ID, TopicID int; Username, Blurb string } `json:"posts"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Posts == nil { return nil, nil }
			topicMap := map[int]struct{ Title, CreatedAt string; PostsCount int; Closed, Answered bool }{}
			for _, t := range resp.Topics { topicMap[t.ID] = struct{ Title, CreatedAt string; PostsCount int; Closed, Answered bool }{t.Title, t.CreatedAt, t.PostsCount, t.Closed, t.HasAcceptedAnswer} }
			var results []SearchResult
			for i, p := range resp.Posts {
				if i >= max || p.ID == 0 || p.TopicID == 0 { break }
				t := topicMap[p.TopicID]
				title := t.Title; if title == "" { title = fmt.Sprintf("Post #%d", p.ID) }
				author := p.Username; comments := t.PostsCount
				parts := []string{}
				if author != "" { parts = append(parts, "@"+author) }
				if comments > 1 { parts = append(parts, fmt.Sprintf("%d comments", comments)) }
				if t.Answered { parts = append(parts, "answered") } else if comments > 1 && t.Closed { parts = append(parts, "closed") }
				var ts int64; if t.CreatedAt != "" { if tp, err := time.Parse(time.RFC3339, t.CreatedAt); err == nil { ts = tp.UnixMilli() } }
				results = append(results, SearchResult{Title: title, URL: fmt.Sprintf("https://meta.discourse.org/p/%d", p.ID), Snippet: p.Blurb, Engine: "discourse", Position: i + 1, Category: "social", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}

// ── Boardreader ────────────────────────────────────────

func newBoardreader(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "boardreader",
		BuildURL: func(q string, opts SearchOptions) string { return "https://boardreader.com/search.php?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/span>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); if title == "" || m[1] == "" { continue }
				u := m[1]; if !strings.HasPrefix(u, "http") { u = "https://boardreader.com" + u }
				pos++; results = append(results, SearchResult{Title: title, URL: u, Snippet: StripHTML(m[3]), Engine: "boardreader", Position: pos, Category: "social"})
			}
			return results, nil
		},
	})(config)
}

// ── Tootfinder ─────────────────────────────────────────

func newTootfinder(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "tootfinder", Category: "social", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://tootfinder.app/api/v1/search?q=" + url.QueryEscape(q) + "&count=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ URI, Content, AccountDisplayName, CreatedAt string } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max || r.URI == "" { break }
				title := r.AccountDisplayName; if title == "" { title = "Toot" }
				var ts int64; if r.CreatedAt != "" { if t, err := time.Parse(time.RFC3339, r.CreatedAt); err == nil { ts = t.UnixMilli() } }
				results = append(results, SearchResult{Title: title, URL: r.URI, Snippet: StripHTML(r.Content), Engine: "tootfinder", Position: i + 1, Category: "social", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}

// ── Bandcamp ───────────────────────────────────────────

func newBandcamp(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "bandcamp",
		BuildURL: func(q string, opts SearchOptions) string { return "https://bandcamp.com/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<li[^>]*class="[^"]*searchresult[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*heading[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div[^>]*class="[^"]*subhead[^"]*"[^>]*>([\s\S]*?)<\/div>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); href := m[1]
				if title == "" || href == "" { continue }
				u := href; if !strings.HasPrefix(href, "http") { u = "https://bandcamp.com" + href }
				pos++; results = append(results, SearchResult{Title: title, URL: u, Snippet: StripHTML(m[3]), Engine: "bandcamp", Position: pos, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Genius ─────────────────────────────────────────────

func newGenius(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "genius", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://genius.com/api/search?q=" + url.QueryEscape(q) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Response *struct{ Hits []struct{ Result struct{ Title, URL, PrimaryArtistName, HeaderImageURL string `json:"primary_artist"` } `json:"result"` } `json:"hits"` } `json:"response"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Response == nil { return nil, nil }
			var results []SearchResult
			for i, h := range resp.Response.Hits {
				if i >= max || h.Result.Title == "" || h.Result.URL == "" { break }
				results = append(results, SearchResult{Title: h.Result.Title, URL: h.Result.URL, Snippet: h.Result.PrimaryArtistName, Engine: "genius", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Deezer ─────────────────────────────────────────────

func newDeezer(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "deezer", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.deezer.com/search?q=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 25)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Data []struct{ ID int; Type, Title, Link string; Artist *struct{ Name string } `json:"artist"`; Album *struct{ Title string } `json:"album"` } `json:"data"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, t := range resp.Data {
				if i >= max || t.Type != "track" || t.Title == "" || t.Link == "" { break }
				url := strings.Replace(t.Link, "http://", "https://", 1)
				artist, album := "", ""; if t.Artist != nil { artist = t.Artist.Name }; if t.Album != nil { album = t.Album.Title }
				results = append(results, SearchResult{Title: t.Title, URL: url, Snippet: fmt.Sprintf("%s - %s", artist, album), Engine: "deezer", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Mixcloud ───────────────────────────────────────────

func newMixcloud(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "mixcloud", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.mixcloud.com/search/?q=" + url.QueryEscape(q) + "&type=cloudcast&limit=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Data []struct{ Name, URL, Description string; User *struct{ Username string } `json:"user"` } `json:"data"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Data {
				if i >= max || r.Name == "" || r.URL == "" { break }
				author := ""; if r.User != nil { author = r.User.Username }
				snippet := r.Description; if author != "" { snippet = author + " - " + snippet }
				results = append(results, SearchResult{Title: r.Name, URL: r.URL, Snippet: truncate(snippet, 200), Engine: "mixcloud", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── SoundCloud ─────────────────────────────────────────

func newSoundCloud(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "soundcloud", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api-v2.soundcloud.com/search?q=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 20)) + "&client_id=YOUR_CLIENT_ID" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Collection []struct{ Title, URI, Description string; User *struct{ Username string } `json:"user"`; Duration int } `json:"collection"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, c := range resp.Collection {
				if i >= max || c.Title == "" || c.URI == "" { break }
				author := ""; if c.User != nil { author = c.User.Username }
				results = append(results, SearchResult{Title: c.Title, URL: c.URI, Snippet: author, Engine: "soundcloud", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Spotify ────────────────────────────────────────────

func newSpotify(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "spotify", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.spotify.com/v1/search?q=" + url.QueryEscape(q) + "&type=track,album,artist&limit=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Tracks *struct{ Items []struct{ ID, Name, HREF string; Artists []struct{ Name string } `json:"artists"`; Album *struct{ Name, HREF string } `json:"album"` } `json:"items"` } `json:"tracks"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Tracks == nil { return nil, nil }
			var results []SearchResult
			for i, t := range resp.Tracks.Items {
				if i >= max || t.Name == "" || t.HREF == "" { break }
				artists := []string{}; for _, a := range t.Artists { artists = append(artists, a.Name) }
				results = append(results, SearchResult{Title: t.Name, URL: t.HREF, Snippet: strings.Join(artists, ", "), Engine: "spotify", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Yandex Music ───────────────────────────────────────

func newYandexMusic(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "yandex-music", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.music.yandex.net/search?text=" + url.QueryEscape(q) + "&page=0&type=track" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Result *struct{ Tracks *struct{ Results []struct{ ID, Title string; Artists []struct{ Name string } `json:"artists"`; Albums []struct{ Title string } `json:"albums"` } `json:"results"` } `json:"tracks"` } `json:"result"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Result == nil || resp.Result.Tracks == nil { return nil, nil }
			var results []SearchResult
			for i, t := range resp.Result.Tracks.Results {
				if i >= max || t.Title == "" { break }
				artists := []string{}; for _, a := range t.Artists { artists = append(artists, a.Name) }
				results = append(results, SearchResult{Title: t.Title, URL: fmt.Sprintf("https://music.yandex.com/track/%s", t.ID), Snippet: strings.Join(artists, ", "), Engine: "yandex-music", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Fyyd ───────────────────────────────────────────────

func newFyyd(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "fyyd", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.fyyd.de/0.2/search/podcast?term=" + url.QueryEscape(q) + "&count=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Data []struct{ ID int; Title, URL, Description string } `json:"data"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, d := range resp.Data {
				if i >= max || d.Title == "" { break }
				results = append(results, SearchResult{Title: d.Title, URL: d.URL, Snippet: truncate(d.Description, 200), Engine: "fyyd", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Freesound ──────────────────────────────────────────

func newFreesound(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "freesound", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://freesound.org/apiv2/search/text?query=" + url.QueryEscape(q) + "&page_size=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ ID int; Name, URL, Description string } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max || r.Name == "" { break }
				results = append(results, SearchResult{Title: r.Name, URL: r.URL, Snippet: truncate(r.Description, 200), Engine: "freesound", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Radio Browser ───────────────────────────────────────

func newRadioBrowser(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "radio-browser", Category: "music", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://at1.api.radio-browser.info/json/stations/byname/" + url.QueryEscape(q) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp []struct{ ID, Name, URL, URLResolved, Homepage, Country, Tags, Codec, Language string `json:"url_resolved"`; Votes int }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, s := range resp {
				if i >= max || s.Name == "" { break }
				u := s.URLResolved; if u == "" { u = s.URL }
				results = append(results, SearchResult{Title: s.Name, URL: u, Snippet: fmt.Sprintf("%s · %s · %d votes", s.Country, s.Tags, s.Votes), Engine: "radio-browser", Position: i + 1, Category: "music"})
			}
			return results, nil
		},
	})(config)
}

// ── Image engines ───────────────────────────────────────

func newUnsplash(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "unsplash", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.unsplash.com/search/photos?query=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ ID string; URLs struct{ Regular string } `json:"urls"`; User struct{ Name string } `json:"user"`; Description, LinksHTML string `json:"links"` } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, p := range resp.Results {
				if i >= max || p.ID == "" { break }
				title := p.Description; if title == "" { title = "Unsplash " + p.ID }
				results = append(results, SearchResult{Title: title, URL: p.LinksHTML, Snippet: "Photo by " + p.User.Name, Engine: "unsplash", Position: i + 1, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newPixabay(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "pixabay", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://pixabay.com/api/?key=&q=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 20)) + "&safesearch=true" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Hits []struct{ ID int; PageURL, Tags, User, Type string `json:"pageURL"` } `json:"hits"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, h := range resp.Hits {
				if i >= max || h.ID == 0 { break }
				tag := ""; parts := strings.Split(h.Tags, ","); if len(parts) > 0 { tag = strings.TrimSpace(parts[0]) }
				if tag == "" { tag = fmt.Sprintf("Pixabay %d", h.ID) }
				cat := "image"; if h.Type == "video" { cat = "video" }
				results = append(results, SearchResult{Title: tag, URL: h.PageURL, Snippet: "By " + h.User + " · " + h.Type, Engine: "pixabay", Position: i + 1, Category: cat})
			}
			return results, nil
		},
	})(config)
}

func newPexels(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "pexels", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.pexels.com/v1/search?query=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Photos []struct{ ID int; URL, Alt string; Photographer string; Src struct{ Medium string } `json:"src"` } `json:"photos"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, p := range resp.Photos {
				if i >= max || p.ID == 0 { break }
				results = append(results, SearchResult{Title: p.Alt, URL: p.URL, Snippet: "Photo by " + p.Photographer, Engine: "pexels", Position: i + 1, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newFlickr(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "flickr", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.flickr.com/services/rest/?method=flickr.photos.search&api_key=&text=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 20)) + "&format=json&nojsoncallback=1" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Photos *struct{ Photo []struct{ ID, Title, Owner string; Farm int; Server, Secret string } `json:"photo"` } `json:"photos"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Photos == nil { return nil, nil }
			var results []SearchResult
			for i, p := range resp.Photos.Photo {
				if i >= max || p.ID == "" { break }
				url := fmt.Sprintf("https://www.flickr.com/photos/%s/%s", p.Owner, p.ID)
				results = append(results, SearchResult{Title: p.Title, URL: url, Snippet: "Flickr photo", Engine: "flickr", Position: i + 1, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newPinterest(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "pinterest",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.pinterest.com/search/pins/?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*data-test-id="[^"]*pinWrapper[^"]*"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := m[1]; if title == "" { continue }
				href := m[3]; if !strings.HasPrefix(href, "http") { href = "https://www.pinterest.com" + href }
				pos++; results = append(results, SearchResult{Title: title, URL: href, Snippet: "", Engine: "pinterest", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newDeviantArt(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "deviantart",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.deviantart.com/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<a[^>]*href="([^"]*)"[^>]*class="[^"]*torpedo-thumb-link[^"]*"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := m[2]; href := m[1]; if title == "" || href == "" { continue }
				if !strings.HasPrefix(href, "http") { href = "https://www.deviantart.com" + href }
				pos++; results = append(results, SearchResult{Title: title, URL: href, Snippet: "", Engine: "deviantart", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newImgur(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "imgur", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.imgur.com/3/gallery/search/viral/all/" + strconv.Itoa(minInt(n, 20)) + "?q=" + url.QueryEscape(q) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Data []struct{ ID, Title, Link string; ImagesCount int `json:"images_count"`; Cover string } `json:"data"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, d := range resp.Data {
				if i >= max || d.ID == "" { break }
				results = append(results, SearchResult{Title: d.Title, URL: d.Link, Snippet: "Imgur image", Engine: "imgur", Position: i + 1, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newPixiv(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "pixiv",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.pixiv.net/en/search?word=" + url.QueryEscape(q) + "&mode=all&order=date" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<a[^>]*href="/en/artworks/(\d+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := m[2]; if title == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: "https://www.pixiv.net/en/artworks/" + m[1], Snippet: "", Engine: "pixiv", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func new500px(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "500px",
		BuildURL: func(q string, opts SearchOptions) string { return "https://500px.com/search?q=" + url.QueryEscape(q) + "&type=photos" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/photo/\d+)"[^>]*>[\s\S]*?<img[^>]*alt="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := m[2]; if title == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: "https://500px.com" + m[1], Snippet: "", Engine: "500px", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newWallhaven(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "wallhaven", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://wallhaven.cc/api/v1/search?q=" + url.QueryEscape(q) + "&page=1" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Data []struct{ ID, URL string } `json:"data"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, d := range resp.Data {
				if i >= max || d.ID == "" { break }
				results = append(results, SearchResult{Title: "Wallhaven " + d.ID, URL: d.URL, Snippet: "Wallhaven wallpaper", Engine: "wallhaven", Position: i + 1, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newOpenverse(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "openverse", Category: "image", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.openverse.engineering/v1/images/?q=" + url.QueryEscape(q) + "&page_size=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ ID, Title, URL, Creator, Thumbnail string } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max || r.ID == "" { break }
				results = append(results, SearchResult{Title: r.Title, URL: r.URL, Snippet: "By " + r.Creator, Engine: "openverse", Position: i + 1, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newAdobeStock(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "adobe-stock",
		BuildURL: func(q string, opts SearchOptions) string { return "https://stock.adobe.com/de/Ajax/Search?k=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(20, 20)) + "&order=relevance&search_page=1&search_type=pagination" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var raw struct{ Items map[string]struct{ Title, ContentURL string `json:"content_url"`; Author, Format string; AssetType string `json:"asset_type"`; ContentOriginalWidth, ContentOriginalHeight int `json:"content_original_width"` } }
			if err := json.Unmarshal([]byte(body), &raw); err != nil { return nil, nil }
			var results []SearchResult; pos := 0
			for _, item := range raw.Items {
				if len(results) >= max || item.ContentURL == "" || item.Title == "" { break }
				pos++; results = append(results, SearchResult{Title: item.Title, URL: item.ContentURL, Snippet: fmt.Sprintf("%s · %s", item.AssetType, item.Author), Engine: "adobe-stock", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newFindThatMeme(config EngineConfig) SearchEngine {
	return &findThatMemeEngine{config: config}
}

type findThatMemeEngine struct{ config EngineConfig }
func (e *findThatMemeEngine) Name() string        { return "findthatmeme" }
func (e *findThatMemeEngine) Config() EngineConfig { return e.config }
func (e *findThatMemeEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	body := fmt.Sprintf(`{"search":"%s","offset":0}`, query)
	status, resp, err := client.PostJSON("https://findthatmeme.com/api/v1/search", body, nil)
	if err != nil || status < 200 || status >= 400 { return nil, nil }
	var items []struct{ ImagePath, SourcePageURL, SourceSite string `json:"source_page_url"`; MemeFileSize int64 `json:"meme_file_size"` }
	if err := json.Unmarshal([]byte(resp), &items); err != nil { return nil, nil }
	var results []SearchResult
	for i, item := range items {
		if i >= opts.NumResults || item.SourcePageURL == "" { break }
		snippet := ""; if item.MemeFileSize > 0 { snippet = formatBytes(item.MemeFileSize) }
		results = append(results, SearchResult{Title: item.SourceSite, URL: item.SourcePageURL, Snippet: snippet, Engine: "findthatmeme", Position: i + 1, Category: "image"})
	}
	return results, nil
}

func formatBytes(b int64) string {
	if b >= 1048576 { return fmt.Sprintf("%.1f MB", float64(b)/1048576) }
	if b >= 1024 { return fmt.Sprintf("%.1f KB", float64(b)/1024) }
	return fmt.Sprintf("%d B", b)
}

func newTinEye(config EngineConfig) SearchEngine {
	return &tinEyeEngine{config: config}
}

type tinEyeEngine struct{ config EngineConfig }
func (e *tinEyeEngine) Name() string        { return "tineye" }
func (e *tinEyeEngine) Config() EngineConfig { return e.config }
func (e *tinEyeEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	status, resp, err := client.Get("https://api.tineye.com/rest/search/?q="+url.QueryEscape(query), map[string]string{"Accept": "application/json"})
	if err != nil || status < 200 || status >= 400 { return nil, nil }
	var data struct{ Results []struct{ ImageURL, PageURL string `json:"image_url"` } `json:"results"` }
	if err := json.Unmarshal([]byte(resp), &data); err != nil { return nil, nil }
	var results []SearchResult
	for i, r := range data.Results {
		if i >= opts.NumResults || r.PageURL == "" { break }
		title := r.ImageURL; if len(title) > 100 { title = title[:100] }
		results = append(results, SearchResult{Title: title, URL: r.PageURL, Snippet: "TinEye reverse image search", Engine: "tineye", Position: i + 1, Category: "image"})
	}
	return results, nil
}

func newGoogleImages(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "google-images",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.google.com/search?tbm=isch&q=" + url.QueryEscape(q) },
		Headers: map[string]string{"Cookie": "CONSENT=YES+"},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := m[2]; if title == "" || m[1] == "" || strings.HasPrefix(m[1], "data:") { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: m[1], Snippet: "", Engine: "google-images", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

func newBingImages(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "bing-images",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.bing.com/images/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			results, _ := parseBingResults(body, max)
			for i := range results { results[i].Engine = "bing-images"; results[i].Category = "image" }
			return results, nil
		},
	})(config)
}

func newSogouImages(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "sogou-images",
		BuildURL: func(q string, opts SearchOptions) string { return "https://pic.sogou.com/pics?query=" + url.QueryEscape(q) + "&mode=1" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := m[2]; if title == "" || m[1] == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: m[1], Snippet: "", Engine: "sogou-images", Position: pos, Category: "image"})
			}
			return results, nil
		},
	})(config)
}

// ── Search engines ──────────────────────────────────────

func newNaver(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "naver",
		BuildURL: func(q string, opts SearchOptions) string { return "https://search.naver.com/search.naver?where=web&query=" + url.QueryEscape(q) + "&start=1" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<li[^>]*class="[^"]*bx[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*link_tit[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); if title == "" || m[1] == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: m[1], Snippet: "", Engine: "naver", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newStartpage(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "startpage",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.startpage.com/do/search?q=" + url.QueryEscape(q) + "&cat=web&language=english" },
		Headers: map[string]string{
			"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Accept-Language": "en-US,en;q=0.9",
			"Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*w-gl__result[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*w-gl__result-url[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*w-gl__result-title[^"]*"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*w-gl__description[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "startpage", Position: pos})
			}
			// 对应 TS fallbackRegex
			if len(results) == 0 {
				fbRe := regexp.MustCompile(`<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>`)
				for _, m := range fbRe.FindAllStringSubmatch(body, -1) {
					if len(results) >= max { break }
					title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" || strings.Contains(url, "startpage.com") { continue }
					pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: "", Engine: "startpage", Position: pos})
				}
			}
			return results, nil
		},
	})(config)
}

func newQwant(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "qwant", Category: "general", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://api.qwant.com/v3/search/web?q=" + url.QueryEscape(q) + "&count=" + strconv.Itoa(minInt(n, 20)) + "&locale=en_US&offset=0&device=desktop&safesearch=0&tgp=1&display=true&llm=true"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Data *struct{ Result *struct{ Items *struct{ Mainline []struct{ Type string; Items []struct{ Title, URL, Desc string; Date int64 } } `json:"mainline"` } `json:"items"` } `json:"result"` } `json:"data"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Data == nil || resp.Data.Result == nil || resp.Data.Result.Items == nil { return nil, nil }
			var results []SearchResult
			for _, section := range resp.Data.Result.Items.Mainline {
				if section.Type != "web" { continue }
				for _, item := range section.Items {
					if len(results) >= max || item.Title == "" || item.URL == "" { break }
					results = append(results, SearchResult{Title: item.Title, URL: item.URL, Snippet: item.Desc, Engine: "qwant", Position: len(results) + 1, Category: "general", PublishedDate: item.Date * 1000})
				}
			}
			return results, nil
		},
	})(config)
}

func newYahoo(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "yahoo",
		BuildURL: func(q string, opts SearchOptions) string { return "https://search.yahoo.com/search?p=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*algo-sr[^"]*"[^>]*>[\s\S]*?<h3[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); u := m[1]; if title == "" || u == "" { continue }
				if ru := regexp.MustCompile(`/RU=([^/]+)/RK`).FindStringSubmatch(u); len(ru) > 1 { if decoded, err := url.QueryUnescape(ru[1]); err == nil { u = decoded } }
				pos++; results = append(results, SearchResult{Title: title, URL: u, Snippet: "", Engine: "yahoo", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newYep(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "yep",
		BuildURL: func(q string, opts SearchOptions) string { return "https://yep.com/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://yep.com" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "yep", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newMojeek(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "mojeek",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.mojeek.com/search?q=" + url.QueryEscape(q) + "&s=6" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<p[^>]*class="[^"]*teaser[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if strings.HasPrefix(url, "/") { url = "https://www.mojeek.com" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "mojeek", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newSeznam(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "seznam",
		BuildURL: func(q string, opts SearchOptions) string { return "https://search.seznam.cz/?q=" + url.QueryEscape(q) },
		Headers: map[string]string{
			"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			"Accept-Language": "cs,en;q=0.9",
			"Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://search.seznam.cz" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "seznam", Position: pos})
			}
			// 备用模式：宽松匹配 h2/h3
			if len(results) == 0 {
				fbRe := regexp.MustCompile(`<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<h[23][^>]*>([\s\S]*?)<\/h[23]>`)
				for _, m := range fbRe.FindAllStringSubmatch(body, -1) {
					if len(results) >= max { break }
					title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" || strings.Contains(url, "seznam.cz") { continue }
					pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: "", Engine: "seznam", Position: pos})
				}
			}
			return results, nil
		},
	})(config)
}

func newAol(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "aol",
		BuildURL: func(q string, opts SearchOptions) string { return "https://search.aol.com/aol/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*algo[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*fz-ms[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://search.aol.com" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "aol", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newGmx(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "gmx",
		BuildURL: func(q string, opts SearchOptions) string { return "https://suche.gmx.net/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*algo[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*fz-ms[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://suche.gmx.net" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "gmx", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newMwmbl(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "mwmbl", Category: "general", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.mwmbl.me/search?q=" + url.QueryEscape(q) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ Title, URL, Snippet string } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max || r.Title == "" || r.URL == "" { break }
				results = append(results, SearchResult{Title: r.Title, URL: r.URL, Snippet: StripHTML(r.Snippet), Engine: "mwmbl", Position: i + 1})
			}
			return results, nil
		},
	})(config)
}

func newGrokipedia(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "grokipedia", Category: "general", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://grokipedia.com/api/full-text-search?query=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 20)) + "&offset=0" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ Slug, Title, Snippet string } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max || r.Slug == "" || r.Title == "" { break }
				results = append(results, SearchResult{Title: r.Title, URL: "https://grokipedia.com/page/" + r.Slug, Snippet: StripHTML(r.Snippet), Engine: "grokipedia", Position: i + 1})
			}
			return results, nil
		},
	})(config)
}

func newSogou(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "sogou",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.sogou.com/web?query=" + url.QueryEscape(q) + "&page=1" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<(?:div|li)[^>]*class="(?:rb|vrwrap(?:[^"]*)?)"[^>]*>[\s\S]*?<h3[^>]*class="[^"]*(?:pt|vr-title)[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if strings.HasPrefix(url, "/link?url=") { urlM := regexp.MustCompile(`data-url="([^"]+)"`).FindStringSubmatch(body); if len(urlM) > 1 { url = urlM[1] } }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: "", Engine: "sogou", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func new360Search(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "360search",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.so.com/s?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<(?:li|div)[^>]*class="(?:res-list|result)"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: "", Engine: "360search", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newChinaSo(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "chinaso",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.chinaso.com/search/?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://www.chinaso.com" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "chinaso", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newQuark(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "quark",
		BuildURL: func(q string, opts SearchOptions) string { return "https://quark.sm.cn/s?q=" + url.QueryEscape(q) + "&from=smor&safe=1" },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*result[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://quark.sm.cn" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: StripHTML(m[3]), Engine: "quark", Position: pos})
			}
			return results, nil
		},
	})(config)
}

func newYandex(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "yandex",
		BuildURL: func(q string, opts SearchOptions) string { return "https://yandex.com/search/site/?text=" + url.QueryEscape(q) + "&tmpl_version=releases&web=1&frame=1&searchid=3131712" },
		Headers: map[string]string{
			"User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
			"Accept-Language": "en-US,en;q=0.9",
			"Accept":          "text/html,application/xhtml+xml",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			// 对应 TS: li.serp-item → a.b-serp-item__title-link → span → div.b-serp-item__text
			re := regexp.MustCompile(`<li[^>]*class="[^"]*serp-item[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*b-serp-item__title-link[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				snippet := ""
				// 提取摘要: div.b-serp-item__text
				if sm := regexp.MustCompile(`<div[^>]*class="[^"]*b-serp-item__text[^"]*"[^>]*>([\s\S]*?)<\/div>`).FindStringSubmatch(m[0]); len(sm) > 1 {
					snippet = StripHTML(sm[1])
					if len(snippet) > 300 { snippet = snippet[:300] }
				}
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: snippet, Engine: "yandex", Position: pos})
			}
			return results, nil
		},
	})(config)
}
