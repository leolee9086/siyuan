// 购物/新闻/娱乐/其他引擎
package websearch

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func init() {
	// 购物
	register("ebay", newEbay)
	register("smzdm", newSmzdm)
	register("jd", newJd)
	register("taobao", newTaobao)
	register("pdd", newPdd)
	register("amazon-cn", newAmazonCn)
	register("amazon-us", newAmazonUs)
	register("suning", newSuning)
	register("gome", newGome)
	register("vip", newVip)
	register("yipin", newYipin)
	register("dangdang", newDangdang)
	register("kaola", newKaola)

	// 新闻
	register("bing-news", newBingNews)
	register("google-news", newGoogleNews)
	register("reuters", newReuters)
	register("yahoo-news", newYahooNews)
	register("bbc-news", newBBCNews)
	register("theguardian", newTheGuardian)
	register("techcrunch", newTechCrunch)
	register("theverge", newTheVerge)
	register("arstechnica", newArsTechnica)
	register("tagesschau", newTagesschau)
	register("ansa", newAnsa)
	register("hackernews", newHackerNews)

	// 娱乐/游戏
	register("imdb", newIMDb)
	register("rottentomatoes", newRottenTomatoes)
	register("steam", newSteam)
	register("igdb", newIgdb)
	register("rawg", newRawg)
	register("tvmaze", newTvMaze)
	register("9gag", new9GAG)
	register("frinkiac", newFrinkiac)
	register("steam", newSteam)

	// 金融/天气
	register("coingecko", newCoinGecko)
	register("yahoo-finance", newYahooFinance)
	register("fred", newFred)
	register("wttr", newWttr)
	register("open-meteo", newOpenMeteo)
	register("openweather", newOpenWeather)

	// 翻译/词典
	register("dictzone", newDictzone)
	register("duden", newDuden)
	register("jisho", newJisho)
	register("lingva", newLingva)
	register("libretranslate", newLibreTranslate)
	register("deepl", newDeepL)
	register("etymonline", newEtymonline)
	register("emojipedia", newEmojipedia)

	// 图标/素材
	register("openclipart", newOpenClipArt)
	register("uxwing", newUxwing)
	register("flaticon", newFlaticon)
	register("devicons", newDevicons)
	register("lucide", newLucide)
	register("material-icons", newMaterialIcons)
	register("cara", newCara)
	register("1x", new1x)
	register("artic", newArtic)
	register("ipernity", newIpernity)
	register("loc", newLoc)
	register("selfhst", newSelfhst)

	// 其它
	register("nominatim", newNominatim)
	register("podchaser", newPodchaser)
	register("z-library", newZLibrary)
	register("apple-app-store", newAppleAppStore)
	register("apkmirror", newApkMirror)
	register("google-play", newGooglePlay)
	register("marginalia", newMarginalia)
	register("currency-convert", newCurrencyConvert)
	register("artstation", newArtStation)
	register("wiby", newWiby)
	register("encyclosearch", newEncyclosearch)
	register("openfoodfacts", newOpenFoodFacts)
	register("musicbrainz", newMusicBrainz)
	register("mediawiki", newMediaWiki)
	register("senscritique", newSensCritique)
	register("context7", newContext7)
}

// ── eBay ──────────────────────────────────────────────

func newEbay(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "ebay",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.ebay.com/sch/i.html?_nkw=" + url.QueryEscape(q) + "&_sacat=0"
		},
		Parse: parseEbayResults,
	})(config)
}

func parseEbayResults(body string, maxResults int) ([]SearchResult, error) {
	var results []SearchResult
	pos := 0
	re := regexp.MustCompile(`<li[^>]*class="[^"]*s-item[^"]*"[^>]*>[\s\S]*?<a[^>]*class="[^"]*s-item__link[^"]*"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*s-item__title[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*s-item__price[^"]*"[^>]*>([\s\S]*?)<\/span>`)
	matches := re.FindAllStringSubmatch(body, -1)
	for _, m := range matches {
		if len(results) >= maxResults {
			break
		}
		u := strings.TrimSpace(m[1])
		title := StripHTML(m[2])
		price := StripHTML(m[3])
		if title == "" || u == "" || title == "Shop on eBay" {
			continue
		}
		snippet := "eBay"
		if price != "" {
			snippet = price + " · eBay"
		}
		pos++
		results = append(results, SearchResult{
			Title: title, URL: u, Snippet: snippet,
			Engine: "ebay", Position: pos, Category: "shopping",
		})
	}
	if len(results) == 0 {
		fbRe := regexp.MustCompile(`href="(https:\/\/www\.ebay\.com\/itm\/[^"]*)"[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>`)
		fmatches := fbRe.FindAllStringSubmatch(body, -1)
		for _, m := range fmatches {
			if len(results) >= maxResults {
				break
			}
			title := strings.TrimSpace(m[2])
			if title == "" {
				continue
			}
			pos++
			results = append(results, SearchResult{
				Title: title, URL: m[1], Snippet: "eBay item",
				Engine: "ebay", Position: pos, Category: "shopping",
			})
		}
	}
	return results, nil
}

// ── Steam ─────────────────────────────────────────────

func newSteam(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "steam", Category: "video",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://store.steampowered.com/api/storesearch/?term=" + url.QueryEscape(q) + "&cc=us&l=en"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Items []struct {
					ID        int    `json:"id"`
					Name     string `json:"name"`
					Price    *struct {
						Currency string `json:"currency"`
						Final    int    `json:"final"`
					} `json:"price"`
					Platforms map[string]bool `json:"platforms"`
				} `json:"items"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.Items {
				if i >= max || item.Name == "" {
					break
				}
				parts := make([]string, 0, 2)
				if item.Price != nil {
					parts = append(parts, "$"+strconv.FormatFloat(float64(item.Price.Final)/100, 'f', 2, 64)+" "+item.Price.Currency)
				}
				platParts := make([]string, 0, len(item.Platforms))
				for p, v := range item.Platforms {
					if v {
						platParts = append(platParts, p)
					}
				}
				if len(platParts) > 0 {
					parts = append(parts, strings.Join(platParts, ", "))
				}
				snippet := "Steam game"
				if len(parts) > 0 {
					snippet = strings.Join(parts, " · ")
				}
				results = append(results, SearchResult{
					Title: item.Name, URL: "https://store.steampowered.com/app/" + strconv.Itoa(item.ID),
					Snippet: snippet, Engine: "steam", Position: i + 1, Category: "video",
				})
			}
			return results, nil
		},
	})(config)
}

// ── IMDb ──────────────────────────────────────────────

func newIMDb(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "imdb", Category: "video",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			normalized := strings.NewReplacer(" ", "_").Replace(strings.ToLower(q))
			letter := "a"
			if len(normalized) > 0 {
				letter = string(normalized[0])
			}
			return "https://v2.sg.media-imdb.com/suggestion/" + letter + "/" + url.QueryEscape(normalized) + ".json"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				D []struct {
					ID   string `json:"id"`
					L    string `json:"l"`
					Q    string `json:"q,omitempty"`
					Y    int    `json:"y,omitempty"`
					S    string `json:"s,omitempty"`
				} `json:"d"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			catMap := map[string]string{"nm": "name", "tt": "title", "kw": "keyword", "co": "company", "ep": "episode"}
			var results []SearchResult
			for _, entry := range resp.D {
				if len(results) >= max {
					break
				}
				catPrefix := ""
				if len(entry.ID) >= 2 {
					catPrefix = entry.ID[:2]
				}
				cat, ok := catMap[catPrefix]
				if !ok {
					continue
				}
				title := entry.L
				if entry.Q != "" {
					title += " (" + entry.Q + ")"
				}
				if title == "" {
					continue
				}
				parts := make([]string, 0, 3)
				if entry.S != "" {
					parts = append(parts, entry.S)
				}
				if entry.Y > 0 {
					parts = append(parts, strconv.Itoa(entry.Y))
				}
				var publishedDate int64
				if entry.Y > 0 {
					publishedDate = time.Date(entry.Y, 1, 1, 0, 0, 0, 0, time.UTC).UnixMilli()
				}
				results = append(results, SearchResult{
					Title: title, URL: "https://www.imdb.com/" + cat + "/" + entry.ID,
					Snippet: strings.Join(parts, " · "), Engine: "imdb",
					Position: len(results) + 1, Category: "video",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}

// ── 其余引擎（site-scoped）───────────────────────────

func newSmzdm(config EngineConfig) SearchEngine         { return newSiteScopedEngine("smzdm.com", "smzdm")(config) }
func newJd(config EngineConfig) SearchEngine            { return newSiteScopedEngine("jd.com", "jd")(config) }
func newTaobao(config EngineConfig) SearchEngine        { return newSiteScopedEngine("taobao.com", "taobao")(config) }
func newPdd(config EngineConfig) SearchEngine           { return newSiteScopedEngine("pinduoduo.com", "pdd")(config) }
func newAmazonCn(config EngineConfig) SearchEngine      { return newSiteScopedEngine("amazon.cn", "amazon-cn")(config) }
func newAmazonUs(config EngineConfig) SearchEngine      { return newSiteScopedEngine("amazon.com", "amazon-us")(config) }
func newSuning(config EngineConfig) SearchEngine        { return newSiteScopedEngine("suning.com", "suning")(config) }
func newGome(config EngineConfig) SearchEngine          { return newSiteScopedEngine("gome.com.cn", "gome")(config) }
func newVip(config EngineConfig) SearchEngine           { return newSiteScopedEngine("vip.com", "vip")(config) }
func newYipin(config EngineConfig) SearchEngine         { return newSiteScopedEngine("1688.com", "yipin")(config) }
func newDangdang(config EngineConfig) SearchEngine      { return newSiteScopedEngine("dangdang.com", "dangdang")(config) }
func newKaola(config EngineConfig) SearchEngine         { return newSiteScopedEngine("kaola.com", "kaola")(config) }
func newBingNews(config EngineConfig) SearchEngine      { return newSiteScopedEngine("bing.com/news", "bing-news")(config) }
func newGoogleNews(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "google-news",
		BuildURL: func(q string, opts SearchOptions) string {
			ceid := "US:en"
			hl := "en"
			if opts.Lang != "" {
				shortLang := strings.Split(strings.Split(opts.Lang, "-")[0], "_")[0]
				ceidMap := map[string]string{"zh": "CN:zh-Hans", "en": "US:en", "ja": "JP:ja", "ko": "KR:ko", "de": "DE:de", "fr": "FR:fr", "es": "ES:es", "pt": "BR:pt-419", "it": "IT:it", "ru": "RU:ru", "ar": "SA:ar"}
				if v, ok := ceidMap[shortLang]; ok {
					ceid = v
				}
				hl = shortLang
			}
			gl := strings.Split(ceid, ":")[0]
			return "https://news.google.com/search?q=" + url.QueryEscape(q) + "&hl=" + hl + "&gl=" + gl + "&ceid=" + url.QueryEscape(ceid) + "&tbm=nws"
		},
		Parse: func(body string, maxResults int) ([]SearchResult, error) {
			var results []SearchResult
			// CAPTCHA 检测（与 google-news.ts isGoogleCaptcha 对齐）
			if len(body) < 2000 && strings.Contains(body, "/sorry/") {
				return nil, nil
			}
			re := regexp.MustCompile(`<div[^>]*jslog[^>]*data-n-tid[^>]*>[\s\S]*?<\/div>`)
			matches := re.FindAllString(body, -1)
			for _, block := range matches {
				if len(results) >= maxResults {
					break
				}
				hrefMatch := regexp.MustCompile(`<a[^>]*target="_blank"[^>]*href="([^"]*)"`).FindStringSubmatch(block)
				if hrefMatch == nil {
					continue
				}
				url := hrefMatch[1]
				if strings.HasPrefix(url, "./") {
					url = "https://news.google.com" + url[1:]
				}
				jslogMatch := regexp.MustCompile(`jslog="([^"]*)"`).FindStringSubmatch(block)
				if jslogMatch != nil {
					parts := strings.Split(jslogMatch[1], ";")
					if len(parts) > 1 {
						b64Parts := strings.Split(parts[len(parts)-1], ":")
						if len(b64Parts) > 1 {
							b64Data := strings.TrimSpace(b64Parts[len(b64Parts)-1])
							padded := b64Data + strings.Repeat("=", (4-len(b64Data)%4)%4)
							if decoded, err := base64.StdEncoding.DecodeString(padded); err == nil {
								var jsonData []interface{}
								if json.Unmarshal(decoded, &jsonData) == nil && len(jsonData) > 0 {
									if last, ok := jsonData[len(jsonData)-1].(string); ok && strings.HasPrefix(last, "http") {
										url = last
									}
								}
							}
						}
					}
				}
				titleMatch := regexp.MustCompile(`<h4[^>]*>([\s\S]*?)<\/h4>`).FindStringSubmatch(block)
				if titleMatch == nil {
					continue
				}
				title := StripHTML(titleMatch[1])
				if title == "" {
					continue
				}
				pubDate := ""
				if pm := regexp.MustCompile(`<time[^>]*>([\s\S]*?)<\/time>`).FindStringSubmatch(block); pm != nil {
					pubDate = strings.TrimSpace(pm[1])
				}
				pubOrigin := ""
				if om := regexp.MustCompile(`<div[^>]*class="vr1PYe"[^>]*>([\s\S]*?)<\/div>`).FindStringSubmatch(block); om != nil {
					pubOrigin = strings.TrimSpace(om[1])
				}
				snippet := strings.TrimSpace(pubOrigin + " / " + pubDate)
				var publishedDate int64
				if rd := ParseRelativeDate(pubDate); rd != nil {
					publishedDate = *rd
				}
				results = append(results, SearchResult{
					Title: title, URL: url, Snippet: snippet,
					Engine: "google-news", Position: len(results) + 1, Category: "news",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newReuters(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "reuters", Category: "news",
		UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		URL: func(q string, n int) string {
			args, _ := json.Marshal(map[string]interface{}{
				"keyword": q, "offset": 0, "orderby": "relevance",
				"size": minInt(n, 20), "website": "reuters",
			})
			return "https://www.reuters.com/pf/api/v3/content/fetch/articles-by-search-v2?query=" + url.QueryEscape(string(args))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Result *struct {
					Articles []struct {
						CanonicalURL string `json:"canonical_url"`
						Web          string `json:"web"`
						Description  string `json:"description"`
						DisplayTime  string `json:"display_time"`
						Kicker       *struct{ Name string } `json:"kicker"`
					} `json:"articles"`
				} `json:"result"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.Result == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, a := range resp.Result.Articles {
				if i >= max || a.CanonicalURL == "" || a.Web == "" {
					break
				}
				snippet := a.Description
				if snippet == "" && a.Kicker != nil {
					snippet = a.Kicker.Name
				}
				if snippet == "" {
					snippet = "Reuters news"
				}
				var publishedDate int64
				if a.DisplayTime != "" {
					if t, err := time.Parse(time.RFC3339, a.DisplayTime); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: a.Web, URL: "https://www.reuters.com" + a.CanonicalURL,
					Snippet: snippet, Engine: "reuters", Position: i + 1, Category: "news",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newYahooNews(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "yahoo-news",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://news.search.yahoo.com/search?p=" + url.QueryEscape(q)
		},
		Parse: func(body string, maxResults int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<li[^>]*>[\s\S]*?<h4[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h4>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= maxResults {
					break
				}
				url := strings.TrimSpace(m[1])
				title := StripHTML(m[2])
				snippet := StripHTML(m[3])
				if title == "" || url == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: url, Snippet: snippet,
					Engine: "yahoo-news", Position: pos, Category: "news",
				})
			}
			return results, nil
		},
	})(config)
}
func newBBCNews(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "bbc-news",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.bbc.co.uk/search?q=" + url.QueryEscape(q) + "&d=news"
		},
		Parse: func(body string, maxResults int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/news/[^"]+)"[^>]*>([^<]+)<\/a>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= maxResults {
					break
				}
				title := StripHTML(m[2])
				if len(title) < 5 {
					continue
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: "https://www.bbc.co.uk" + m[1], Snippet: "BBC News",
					Engine: "bbc-news", Position: pos, Category: "news",
				})
			}
			return results, nil
		},
	})(config)
}
func newTheGuardian(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "theguardian", Category: "news",
		RequiresKey: true, APIKeyEnv: "GUARDIAN_API_KEY",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			key := os.Getenv("GUARDIAN_API_KEY")
			if key == "" {
				key = "test"
			}
			return "https://content.guardianapis.com/search?q=" + url.QueryEscape(q) + "&page-size=" + strconv.Itoa(minInt(n, 20)) + "&api-key=" + key + "&show-fields=trailText,byline,publication"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Response *struct {
					Results []struct {
						WebTitle          string `json:"webTitle"`
						WebURL            string `json:"webUrl"`
						WebPublicationDate string `json:"webPublicationDate"`
						Fields            *struct {
							TrailText string `json:"trailText"`
							Byline    string `json:"byline"`
						} `json:"fields"`
					} `json:"results"`
				} `json:"response"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.Response == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resp.Response.Results {
				if i >= max || r.WebTitle == "" {
					break
				}
				snippet := "The Guardian"
				if r.Fields != nil {
					if r.Fields.TrailText != "" {
						snippet = r.Fields.TrailText
					} else if r.Fields.Byline != "" {
						snippet = r.Fields.Byline
					}
				}
				var publishedDate int64
				if r.WebPublicationDate != "" {
					if t, err := time.Parse(time.RFC3339, r.WebPublicationDate); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: r.WebTitle, URL: r.WebURL, Snippet: snippet,
					Engine: "theguardian", Position: i + 1, Category: "news",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newTechCrunch(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "techcrunch", Category: "news",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://techcrunch.com/wp-json/wp/v2/posts?search=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 20)) + "&_embed"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var posts []struct {
				Title   *struct{ Rendered string } `json:"title"`
				Link    string `json:"link"`
				Excerpt *struct{ Rendered string } `json:"excerpt"`
				Date    string `json:"date"`
				Embedded *struct {
					WpTerm [][]struct{ Name string } `json:"wp:term"`
				} `json:"_embedded"`
			}
			if err := json.Unmarshal(data, &posts); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, p := range posts {
				if i >= max {
					break
				}
				title := ""
				if p.Title != nil {
					title = StripHTML(p.Title.Rendered)
				}
				if title == "" || p.Link == "" {
					continue
				}
				snippet := ""
				if p.Excerpt != nil {
					snippet = StripHTML(p.Excerpt.Rendered)
				}
				if len(snippet) > 150 {
					snippet = snippet[:150]
				}
				if p.Embedded != nil && len(p.Embedded.WpTerm) > 0 {
					cats := make([]string, 0, len(p.Embedded.WpTerm[0]))
					for _, t := range p.Embedded.WpTerm[0] {
						cats = append(cats, t.Name)
					}
					if snippet != "" {
						snippet += " · "
					}
					snippet += strings.Join(cats, ", ")
				}
				var publishedDate int64
				if p.Date != "" {
					if t, err := time.Parse(time.RFC3339, p.Date); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: title, URL: p.Link, Snippet: snippet,
					Engine: "techcrunch", Position: i + 1, Category: "news",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newTheVerge(config EngineConfig) SearchEngine      { return newSiteScopedEngine("theverge.com", "theverge")(config) }
func newArsTechnica(config EngineConfig) SearchEngine   { return newSiteScopedEngine("arstechnica.com", "arstechnica")(config) }
func newTagesschau(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "tagesschau", Category: "news",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://www.tagesschau.de/api2u/search?searchText=" + url.QueryEscape(q) + "&pageSize=" + strconv.Itoa(minInt(n, 10)) + "&resultPage=0"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				SearchResults []struct {
					Title         string `json:"title"`
					Type          string `json:"type"`
					Date          string `json:"date"`
					FirstSentence string `json:"firstSentence"`
					ShareURL      string `json:"shareURL"`
					Detailsweb    string `json:"detailsweb"`
				} `json:"searchResults"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.SearchResults {
				if i >= max || item.Title == "" {
					break
				}
				url := item.ShareURL
				if url == "" {
					url = item.Detailsweb
				}
				if url == "" {
					url = "https://www.tagesschau.de/"
				}
				itemType := item.Type
				if itemType == "" {
					itemType = "story"
				}
				prefix := "NEWS"
				if itemType == "video" {
					prefix = "VIDEO"
				}
				snippet := item.FirstSentence
				if snippet != "" {
					snippet = "[" + prefix + "] " + snippet
				} else {
					snippet = "[" + prefix + "]"
				}
				var publishedDate int64
				if item.Date != "" {
					if t, err := time.Parse(time.RFC3339, item.Date); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: item.Title, URL: url, Snippet: snippet,
					Engine: "tagesschau", Position: i + 1, Category: "news",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newAnsa(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "ansa",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://www.ansa.it/ricerca?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, maxResults int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<article[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<img[^>]*src="[^"]*"[^>]*alt="([^"]*)"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/article>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for _, m := range matches {
				if len(results) >= maxResults {
					break
				}
				href := strings.TrimSpace(m[1])
				title := strings.TrimSpace(m[2])
				snippet := StripHTML(m[3])
				if title == "" || href == "" {
					continue
				}
				if strings.HasPrefix(href, "/") {
					href = "https://www.ansa.it" + href
				} else if !strings.HasPrefix(href, "http") {
					href = "https://www.ansa.it/" + href
				}
				if snippet == "" {
					snippet = "ANSA news"
				}
				pos++
				results = append(results, SearchResult{
					Title: title, URL: href, Snippet: snippet,
					Engine: "ansa", Position: pos, Category: "news",
				})
			}
			return results, nil
		},
	})(config)
}
func newHackerNews(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "hackernews", Category: "news",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://hn.algolia.com/api/v1/search?query=" + url.QueryEscape(q) + "&hitsPerPage=" + strconv.Itoa(minInt(n, 50))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Hits []struct {
					Title     string `json:"title"`
					URL       string `json:"url"`
					ObjectID  string `json:"objectID"`
					Points    int    `json:"points"`
					Author    string `json:"author"`
					CreatedAt string `json:"created_at"`
				} `json:"hits"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, h := range resp.Hits {
				if i >= max {
					break
				}
				title := h.Title
				if title == "" {
					title = "HN post"
				}
				url := h.URL
				if url == "" {
					url = "https://news.ycombinator.com/item?id=" + h.ObjectID
				}
				snippet := strconv.Itoa(h.Points) + " points by " + h.Author
				var publishedDate int64
				if h.CreatedAt != "" {
					if t, err := time.Parse(time.RFC3339, h.CreatedAt); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: title, URL: url, Snippet: snippet,
					Engine: "hackernews", Position: i + 1, Category: "news",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newRottenTomatoes(config EngineConfig) SearchEngine { return newSiteScopedEngine("rottentomatoes.com", "rottentomatoes")(config) }
func newIgdb(config EngineConfig) SearchEngine          { return newSiteScopedEngine("igdb.com", "igdb")(config) }
func newRawg(config EngineConfig) SearchEngine           { return newSiteScopedEngine("rawg.io", "rawg")(config) }
func newTvMaze(config EngineConfig) SearchEngine        { return newSiteScopedEngine("tvmaze.com", "tvmaze")(config) }
func new9GAG(config EngineConfig) SearchEngine          { return newSiteScopedEngine("9gag.com", "9gag")(config) }
func newFrinkiac(config EngineConfig) SearchEngine      { return newSiteScopedEngine("frinkiac.com", "frinkiac")(config) }
func newCoinGecko(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "coingecko", Category: "finance",
		URL: func(q string, n int) string {
			return "https://api.coingecko.com/api/v3/search?query=" + url.QueryEscape(q)
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Coins []struct {
					ID     string `json:"id"`
					Name   string `json:"name"`
					Symbol string `json:"symbol"`
					Rank   *int   `json:"market_cap_rank"`
				} `json:"coins"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, c := range resp.Coins {
				if i >= max {
					break
				}
				snippet := c.ID
				if c.Rank != nil {
					snippet = "Market cap rank #" + strconv.Itoa(*c.Rank)
				}
				results = append(results, SearchResult{
					Title: c.Name + " (" + strings.ToUpper(c.Symbol) + ")",
					URL: "https://www.coingecko.com/en/coins/" + c.ID,
					Snippet: snippet, Engine: "coingecko", Position: i + 1, Category: "finance",
				})
			}
			return results, nil
		},
	})(config)
}
func newYahooFinance(config EngineConfig) SearchEngine  { return newSiteScopedEngine("finance.yahoo.com", "yahoo-finance")(config) }
func newFred(config EngineConfig) SearchEngine          { return newSiteScopedEngine("fred.stlouisfed.org", "fred")(config) }
func newWttr(config EngineConfig) SearchEngine          { return newSiteScopedEngine("wttr.in", "wttr")(config) }
func newOpenMeteo(config EngineConfig) SearchEngine {
	return &openMeteoEngine{config: config}
}

type openMeteoEngine struct{ config EngineConfig }

func (e *openMeteoEngine) Name() string        { return "open-meteo" }
func (e *openMeteoEngine) Config() EngineConfig { return e.config }

var wmoCodes = map[int]string{
	0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
	45: "Fog", 48: "Depositing rime fog",
	51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
	61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
	71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
	80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
	95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
}

func (e *openMeteoEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	timeout := time.Duration(e.config.Timeout) * time.Millisecond

	// Step 1: 地理编码
	geoURL := fmt.Sprintf("https://geocoding-api.open-meteo.com/v1/search?name=%s&count=1&language=en&format=json", url.QueryEscape(query))
	geoClient := NewHTTPClient(timeout)
	geoClient.SetHeader("Accept", "application/json")
	geoStatus, geoBody, err := geoClient.Get(geoURL, nil)
	if err != nil || geoStatus < 200 || geoStatus >= 400 {
		return nil, nil
	}
	var geoResp struct {
		Results []struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
			Name      string  `json:"name"`
		} `json:"results"`
	}
	if err := json.Unmarshal([]byte(geoBody), &geoResp); err != nil || len(geoResp.Results) == 0 {
		return nil, nil
	}
	loc := geoResp.Results[0]

	// Step 2: 天气预报
	weatherURL := fmt.Sprintf("https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&forecast_days=3&timeformat=unixtime&timezone=auto&format=json",
		loc.Latitude, loc.Longitude)
	weatherClient := NewHTTPClient(timeout)
	weatherClient.SetHeader("Accept", "application/json")
	wStatus, wBody, err := weatherClient.Get(weatherURL, nil)
	if err != nil || wStatus < 200 || wStatus >= 400 {
		return nil, nil
	}
	var weatherResp struct {
		Current *struct {
			Temperature2m      float64 `json:"temperature_2m"`
			ApparentTemperature float64 `json:"apparent_temperature"`
			Humidity            float64 `json:"relative_humidity_2m"`
			WeatherCode         int     `json:"weather_code"`
			WindSpeed           float64 `json:"wind_speed_10m"`
		} `json:"current"`
	}
	if err := json.Unmarshal([]byte(wBody), &weatherResp); err != nil || weatherResp.Current == nil {
		return nil, nil
	}
	cur := weatherResp.Current
	condition := "Unknown"
	if c, ok := wmoCodes[cur.WeatherCode]; ok {
		condition = c
	}
	locName := loc.Name
	if locName == "" {
		locName = query
	}
	snippet := fmt.Sprintf("%.0f°C (feels like %.0f°C) · %s · Humidity: %.0f%% · Wind: %.0f km/h",
		cur.Temperature2m, cur.ApparentTemperature, condition, cur.Humidity, cur.WindSpeed)
	return []SearchResult{{
		Title:    fmt.Sprintf("Weather in %s: %.0f°C - %s", locName, cur.Temperature2m, condition),
		URL:      "https://open-meteo.com/",
		Snippet:  snippet,
		Engine:   "open-meteo",
		Position: 1,
		Category: "weather",
	}}, nil
}
func newOpenWeather(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "openweather", Category: "weather",
		RequiresKey: true, APIKeyEnv: "OPENWEATHER_API_KEY",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			key := os.Getenv("OPENWEATHER_API_KEY")
			return "https://api.openweathermap.org/data/2.5/weather?q=" + url.QueryEscape(q) + "&appid=" + key + "&units=metric&lang=zh_cn"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Name string `json:"name"`
				Sys  struct {
					Country string `json:"country"`
				} `json:"sys"`
				Weather []struct {
					Description string `json:"description"`
				} `json:"weather"`
				Main struct {
					Temp     float64 `json:"temp"`
					FeelsLike float64 `json:"feels_like"`
					Humidity int     `json:"humidity"`
					TempMin  float64 `json:"temp_min"`
					TempMax  float64 `json:"temp_max"`
				} `json:"main"`
				Wind struct {
					Speed float64 `json:"speed"`
				} `json:"wind"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.Name == "" {
				return nil, nil
			}
			weatherDesc := ""
			if len(resp.Weather) > 0 {
				weatherDesc = resp.Weather[0].Description
			}
			title := resp.Name
			if resp.Sys.Country != "" {
				title += ", " + resp.Sys.Country
			}
			if weatherDesc != "" {
				title += " · " + weatherDesc
			}
			snippet := fmt.Sprintf("🌡 %.0f°C (feels %.0f°) · Min %.0f° / Max %.0f° · Humidity %d%% · Wind %.1f m/s",
				resp.Main.Temp, resp.Main.FeelsLike, resp.Main.TempMin, resp.Main.TempMax, resp.Main.Humidity, resp.Wind.Speed)
			return []SearchResult{{
				Title: title, URL: "https://openweathermap.org/city/" + url.QueryEscape(resp.Name),
				Snippet: snippet, Engine: "openweather", Position: 1, Category: "weather",
			}}, nil
		},
	})(config)
}
func newDictzone(config EngineConfig) SearchEngine      { return newSiteScopedEngine("dictzone.com", "dictzone")(config) }
func newDuden(config EngineConfig) SearchEngine         { return newSiteScopedEngine("duden.de", "duden")(config) }
func newJisho(config EngineConfig) SearchEngine         { return newSiteScopedEngine("jisho.org", "jisho")(config) }
func newLingva(config EngineConfig) SearchEngine        { return newSiteScopedEngine("lingva.ml", "lingva")(config) }
func newLibreTranslate(config EngineConfig) SearchEngine { return newSiteScopedEngine("libretranslate.com", "libretranslate")(config) }
func newDeepL(config EngineConfig) SearchEngine         { return newSiteScopedEngine("deepl.com", "deepl")(config) }
func newEtymonline(config EngineConfig) SearchEngine    { return newSiteScopedEngine("etymonline.com", "etymonline")(config) }
func newEmojipedia(config EngineConfig) SearchEngine    { return newSiteScopedEngine("emojipedia.org", "emojipedia")(config) }
func newOpenClipArt(config EngineConfig) SearchEngine   { return newSiteScopedEngine("openclipart.org", "openclipart")(config) }
func newUxwing(config EngineConfig) SearchEngine        { return newSiteScopedEngine("uxwing.com", "uxwing")(config) }
func newFlaticon(config EngineConfig) SearchEngine      { return newSiteScopedEngine("flaticon.com", "flaticon")(config) }
func newDevicons(config EngineConfig) SearchEngine      { return newSiteScopedEngine("devicons.com", "devicons")(config) }
func newLucide(config EngineConfig) SearchEngine        { return newSiteScopedEngine("lucide.dev", "lucide")(config) }
func newMaterialIcons(config EngineConfig) SearchEngine { return newSiteScopedEngine("fonts.google.com/icons", "material-icons")(config) }
func newCara(config EngineConfig) SearchEngine          { return newSiteScopedEngine("cara.app", "cara")(config) }
func new1x(config EngineConfig) SearchEngine            { return newSiteScopedEngine("1x.com", "1x")(config) }
func newArtic(config EngineConfig) SearchEngine         { return newSiteScopedEngine("artic.edu", "artic")(config) }
func newIpernity(config EngineConfig) SearchEngine      { return newSiteScopedEngine("ipernity.com", "ipernity")(config) }
func newLoc(config EngineConfig) SearchEngine           { return newSiteScopedEngine("loc.gov", "loc")(config) }
func newSelfhst(config EngineConfig) SearchEngine       { return newSiteScopedEngine("selfhst.com", "selfhst")(config) }
func newNominatim(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "nominatim", Category: "map",
		UserAgent: "opencode-search/1.0 (nominatim)",
		URL: func(q string, n int) string {
			return "https://nominatim.openstreetmap.org/search?q=" + url.QueryEscape(q) + "&format=json&limit=" + strconv.Itoa(minInt(n, 20))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp []struct {
				PlaceID     int    `json:"place_id"`
				DisplayName string `json:"display_name"`
				Lat         string `json:"lat"`
				Lon         string `json:"lon"`
				Type        string `json:"type"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, p := range resp {
				if i >= max {
					break
				}
				title := p.DisplayName
				if idx := strings.Index(p.DisplayName, ","); idx > 0 {
					title = p.DisplayName[:idx]
				}
				results = append(results, SearchResult{
					Title: title, URL: "https://www.openstreetmap.org/?mlat=" + p.Lat + "&mlon=" + p.Lon,
					Snippet: p.DisplayName + " · type: " + p.Type,
					Engine: "nominatim", Position: i + 1, Category: "map",
				})
			}
			return results, nil
		},
	})(config)
}
func newMarginalia(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "marginalia", Category: "general",
		URL: func(q string, n int) string {
			return "https://api.marginalia.nu/search?query=" + url.QueryEscape(q) + "&count=" + strconv.Itoa(minInt(n, 20)) + "&index=0"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Results []struct {
					Title       string `json:"title"`
					URL         string `json:"url"`
					Description string `json:"description"`
					PubDate     string `json:"pubDate"`
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max {
					break
				}
				title := r.Title
				if title == "" {
					title = r.URL
				}
				var publishedDate int64
				if r.PubDate != "" {
					if t, err := time.Parse(time.RFC3339, r.PubDate); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: title, URL: r.URL, Snippet: r.Description,
					Engine: "marginalia", Position: i + 1, PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newPodchaser(config EngineConfig) SearchEngine     { return newSiteScopedEngine("podchaser.com", "podchaser")(config) }
func newZLibrary(config EngineConfig) SearchEngine      { return newSiteScopedEngine("z-lib.org", "z-library")(config) }
func newAppleAppStore(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "apple-app-store", Category: "software",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://itunes.apple.com/search?term=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 20)) + "&entity=software"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Results []struct {
					TrackName      string  `json:"trackName"`
					TrackViewURL   string  `json:"trackViewUrl"`
					SellerName     string  `json:"sellerName"`
					FormattedPrice string  `json:"formattedPrice"`
					AvgRating      float64 `json:"averageUserRating"`
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, a := range resp.Results {
				if i >= max || a.TrackName == "" {
					break
				}
				price := a.FormattedPrice
				if price == "" {
					price = "Free"
				}
				rating := "?"
				if a.AvgRating > 0 {
					rating = strconv.FormatFloat(a.AvgRating, 'f', 1, 64)
				}
				results = append(results, SearchResult{
					Title: a.TrackName, URL: a.TrackViewURL,
					Snippet: a.SellerName + " · " + price + " · ⭐" + rating,
					Engine: "apple-app-store", Position: i + 1, Category: "software",
				})
			}
			return results, nil
		},
	})(config)
}
func newApkMirror(config EngineConfig) SearchEngine     { return newSiteScopedEngine("apkmirror.com", "apkmirror")(config) }
func newGooglePlay(config EngineConfig) SearchEngine    { return newSiteScopedEngine("play.google.com", "google-play")(config) }
func newCurrencyConvert(config EngineConfig) SearchEngine { return newSiteScopedEngine("xe.com", "currency-convert")(config) }
func newArtStation(config EngineConfig) SearchEngine    { return newSiteScopedEngine("artstation.com", "artstation")(config) }
func newWiby(config EngineConfig) SearchEngine          { return newSiteScopedEngine("wiby.me", "wiby")(config) }
func newEncyclosearch(config EngineConfig) SearchEngine { return newSiteScopedEngine("encyclosearch.org", "encyclosearch")(config) }
func newOpenFoodFacts(config EngineConfig) SearchEngine { return newSiteScopedEngine("openfoodfacts.org", "openfoodfacts")(config) }
func newMusicBrainz(config EngineConfig) SearchEngine   { return newSiteScopedEngine("musicbrainz.org", "musicbrainz")(config) }
func newMediaWiki(config EngineConfig) SearchEngine {
	wikiHost := "en.wikipedia.org"
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "mediawiki", Category: "general",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://" + wikiHost + "/w/api.php?action=query&list=search&srsearch=" + url.QueryEscape(q) + "&srlimit=" + strconv.Itoa(minInt(n, 50)) + "&format=json&origin=*"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Query *struct {
					Search []struct {
						Title     string `json:"title"`
						Snippet   string `json:"snippet"`
						Timestamp string `json:"timestamp"`
					} `json:"search"`
				} `json:"query"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.Query == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resp.Query.Search {
				if i >= max || r.Title == "" {
					break
				}
				encodedTitle := url.PathEscape(strings.ReplaceAll(r.Title, " ", "_"))
				var publishedDate int64
				if r.Timestamp != "" {
					if t, err := time.Parse(time.RFC3339, r.Timestamp); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: r.Title, URL: "https://" + wikiHost + "/wiki/" + encodedTitle,
					Snippet: StripHTML(r.Snippet), Engine: "mediawiki",
					Position: i + 1, PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newSensCritique(config EngineConfig) SearchEngine  { return newSiteScopedEngine("senscritique.com", "senscritique")(config) }
func newContext7(config EngineConfig) SearchEngine      { return newSiteScopedEngine("context7.com", "context7")(config) }
