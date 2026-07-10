// 视频搜索引擎实现
package websearch

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
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
											title := nestedStr(vr, "title", "runs", "0", "text")
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

// ── Bilibili ──────────────────────────────────────────

func newBilibili(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "bilibili", Category: "video",
		UserAgent: RandomUserAgent(),
		URL: func(q string, n int) string {
			return "https://api.bilibili.com/x/web-interface/search/type?keyword=" + url.QueryEscape(q) + "&search_type=video&page=1&page_size=" + strconv.Itoa(minInt(n, 20))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data *struct {
					Result []struct {
						Title  string `json:"title"`
						Arcurl string `json:"arcurl"`
						Desc   string `json:"description"`
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
				results = append(results, SearchResult{
					Title: UnescapeHTML(r.Title), URL: r.Arcurl,
					Snippet: r.Desc, Engine: "bilibili", Position: i + 1, Category: "video",
				})
			}
			return results, nil
		},
	})(config)
}

// ── 其余视频引擎（site-scoped）────────────────────────

func newVimeo(config EngineConfig) SearchEngine        { return newSiteScopedEngine("vimeo.com", "vimeo")(config) }
func newDailymotion(config EngineConfig) SearchEngine   { return newSiteScopedEngine("dailymotion.com", "dailymotion")(config) }
func newRumble(config EngineConfig) SearchEngine        { return newSiteScopedEngine("rumble.com", "rumble")(config) }
func newOdysee(config EngineConfig) SearchEngine        { return newSiteScopedEngine("odysee.com", "odysee")(config) }
func newBitchute(config EngineConfig) SearchEngine      { return newSiteScopedEngine("bitchute.com", "bitchute")(config) }
func newAcfun(config EngineConfig) SearchEngine         { return newSiteScopedEngine("acfun.cn", "acfun")(config) }
func newIqiyi(config EngineConfig) SearchEngine         { return newSiteScopedEngine("iqiyi.com", "iqiyi")(config) }
func newNiconico(config EngineConfig) SearchEngine      { return newSiteScopedEngine("nicovideo.jp", "nicovideo")(config) }
func newPeerTube(config EngineConfig) SearchEngine      { return newSiteScopedEngine("peertube.tv", "peertube")(config) }
func newSepiaSearch(config EngineConfig) SearchEngine   { return newSiteScopedEngine("sepiasearch.org", "sepiasearch")(config) }
func newGoogleVideos(config EngineConfig) SearchEngine  { return newSiteScopedEngine("video.google.com", "google-videos")(config) }
func newBingVideos(config EngineConfig) SearchEngine    { return newSiteScopedEngine("bing.com/videos", "bing-videos")(config) }
func newPiped(config EngineConfig) SearchEngine         { return newSiteScopedEngine("piped.video", "piped")(config) }
func newInvidious(config EngineConfig) SearchEngine     { return newSiteScopedEngine("invidious.io", "invidious")(config) }
func newSogouVideos(config EngineConfig) SearchEngine   { return newSiteScopedEngine("v.sogou.com", "sogou-videos")(config) }
