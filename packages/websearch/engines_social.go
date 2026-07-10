// 社交/媒体搜索引擎实现
package websearch

import (
	"encoding/json"
	"net/url"
	"regexp"
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

func newDouban(config EngineConfig) SearchEngine       { return newSiteScopedEngine("douban.com", "douban")(config) }
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
func newMastodon(config EngineConfig) SearchEngine      { return newSiteScopedEngine("mastodon.social", "mastodon")(config) }
func newLemmy(config EngineConfig) SearchEngine         { return newSiteScopedEngine("lemmy.world", "lemmy")(config) }
func newDiscourse(config EngineConfig) SearchEngine     { return newSiteScopedEngine("discourse.org", "discourse")(config) }
func newBoardreader(config EngineConfig) SearchEngine   { return newSiteScopedEngine("boardreader.com", "boardreader")(config) }
func newTootfinder(config EngineConfig) SearchEngine    { return newSiteScopedEngine("tootfinder.app", "tootfinder")(config) }
func newBandcamp(config EngineConfig) SearchEngine      { return newSiteScopedEngine("bandcamp.com", "bandcamp")(config) }
func newGenius(config EngineConfig) SearchEngine        { return newSiteScopedEngine("genius.com", "genius")(config) }
func newDeezer(config EngineConfig) SearchEngine        { return newSiteScopedEngine("deezer.com", "deezer")(config) }
func newMixcloud(config EngineConfig) SearchEngine      { return newSiteScopedEngine("mixcloud.com", "mixcloud")(config) }
func newSoundCloud(config EngineConfig) SearchEngine    { return newSiteScopedEngine("soundcloud.com", "soundcloud")(config) }
func newSpotify(config EngineConfig) SearchEngine       { return newSiteScopedEngine("open.spotify.com", "spotify")(config) }
func newYandexMusic(config EngineConfig) SearchEngine   { return newSiteScopedEngine("music.yandex.com", "yandex-music")(config) }
func newFyyd(config EngineConfig) SearchEngine          { return newSiteScopedEngine("fyyd.de", "fyyd")(config) }
func newFreesound(config EngineConfig) SearchEngine     { return newSiteScopedEngine("freesound.org", "freesound")(config) }
func newRadioBrowser(config EngineConfig) SearchEngine  { return newSiteScopedEngine("radio-browser.info", "radio-browser")(config) }
func newUnsplash(config EngineConfig) SearchEngine      { return newSiteScopedEngine("unsplash.com", "unsplash")(config) }
func newPixabay(config EngineConfig) SearchEngine       { return newSiteScopedEngine("pixabay.com", "pixabay")(config) }
func newPexels(config EngineConfig) SearchEngine        { return newSiteScopedEngine("pexels.com", "pexels")(config) }
func newFlickr(config EngineConfig) SearchEngine        { return newSiteScopedEngine("flickr.com", "flickr")(config) }
func newPinterest(config EngineConfig) SearchEngine     { return newSiteScopedEngine("pinterest.com", "pinterest")(config) }
func newDeviantArt(config EngineConfig) SearchEngine    { return newSiteScopedEngine("deviantart.com", "deviantart")(config) }
func newImgur(config EngineConfig) SearchEngine         { return newSiteScopedEngine("imgur.com", "imgur")(config) }
func newPixiv(config EngineConfig) SearchEngine         { return newSiteScopedEngine("pixiv.net", "pixiv")(config) }
func new500px(config EngineConfig) SearchEngine         { return newSiteScopedEngine("500px.com", "500px")(config) }
func newWallhaven(config EngineConfig) SearchEngine     { return newSiteScopedEngine("wallhaven.cc", "wallhaven")(config) }
func newOpenverse(config EngineConfig) SearchEngine     { return newSiteScopedEngine("openverse.org", "openverse")(config) }
func newAdobeStock(config EngineConfig) SearchEngine    { return newSiteScopedEngine("stock.adobe.com", "adobe-stock")(config) }
func newFindThatMeme(config EngineConfig) SearchEngine  { return newSiteScopedEngine("findthatmeme.com", "findthatmeme")(config) }
func newTinEye(config EngineConfig) SearchEngine        { return newSiteScopedEngine("tineye.com", "tineye")(config) }
func newGoogleImages(config EngineConfig) SearchEngine  { return newSiteScopedEngine("google.com/images", "google-images")(config) }
func newBingImages(config EngineConfig) SearchEngine    { return newSiteScopedEngine("bing.com/images", "bing-images")(config) }
func newSogouImages(config EngineConfig) SearchEngine   { return newSiteScopedEngine("pic.sogou.com", "sogou-images")(config) }
func newNaver(config EngineConfig) SearchEngine         { return newSiteScopedEngine("naver.com", "naver")(config) }
func newStartpage(config EngineConfig) SearchEngine     { return newSiteScopedEngine("startpage.com", "startpage")(config) }
func newQwant(config EngineConfig) SearchEngine         { return newSiteScopedEngine("qwant.com", "qwant")(config) }
func newYahoo(config EngineConfig) SearchEngine         { return newSiteScopedEngine("search.yahoo.com", "yahoo")(config) }
func newYep(config EngineConfig) SearchEngine           { return newSiteScopedEngine("yep.com", "yep")(config) }
func newMojeek(config EngineConfig) SearchEngine        { return newSiteScopedEngine("mojeek.com", "mojeek")(config) }
func newSeznam(config EngineConfig) SearchEngine        { return newSiteScopedEngine("seznam.cz", "seznam")(config) }
func newAol(config EngineConfig) SearchEngine           { return newSiteScopedEngine("aol.com", "aol")(config) }
func newGmx(config EngineConfig) SearchEngine           { return newSiteScopedEngine("gmx.net", "gmx")(config) }
func newMwmbl(config EngineConfig) SearchEngine         { return newSiteScopedEngine("mwmbl.org", "mwmbl")(config) }
func newGrokipedia(config EngineConfig) SearchEngine    { return newSiteScopedEngine("groki.pedia", "grokipedia")(config) }
func newSogou(config EngineConfig) SearchEngine         { return newSiteScopedEngine("sogou.com", "sogou")(config) }
func new360Search(config EngineConfig) SearchEngine     { return newSiteScopedEngine("so.com", "360search")(config) }
func newChinaSo(config EngineConfig) SearchEngine       { return newSiteScopedEngine("chinaso.com", "chinaso")(config) }
func newQuark(config EngineConfig) SearchEngine         { return newSiteScopedEngine("quark.cn", "quark")(config) }
func newYandex(config EngineConfig) SearchEngine        { return newSiteScopedEngine("yandex.com", "yandex")(config) }
