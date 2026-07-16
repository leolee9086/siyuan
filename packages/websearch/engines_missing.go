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
	register("lib-rs", newLibRs)
	register("niconico", newNiconicoSCode)
	register("nvd", newNVD)
	register("repology", newRepology)
}

func newLibRs(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "lib-rs",
		BuildURL: func(query string, _ SearchOptions) string {
			return "https://lib.rs/search?q=" + url.QueryEscape(query)
		},
		Headers: map[string]string{
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
			"Accept":     "text/html",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			return parseLibRsResults(body, max), nil
		},
	})(config)
}

func parseLibRsResults(body string, max int) []SearchResult {
	itemRegex := regexp.MustCompile(`(?is)<a[^>]*href="([^"]+)"[^>]*>.*?<h4[^>]*>(.*?)</h4>.*?<p[^>]*>(.*?)</p>`)
	results := make([]SearchResult, 0, max)
	for _, match := range itemRegex.FindAllStringSubmatch(body, -1) {
		if len(results) >= max {
			break
		}
		href := strings.TrimSpace(match[1])
		title := strings.TrimSpace(StripHTML(match[2]))
		snippet := strings.TrimSpace(StripHTML(match[3]))
		if href == "" || title == "" {
			continue
		}
		if !strings.HasPrefix(href, "http") {
			href = "https://lib.rs" + href
		}
		results = append(results, SearchResult{
			Title: title, URL: href, Snippet: snippet, Engine: "lib-rs",
			Position: len(results) + 1, Category: "code",
		})
	}
	return results
}

func newNiconicoSCode(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "niconico",
		BuildURL: func(query string, _ SearchOptions) string {
			return "https://www.nicovideo.jp/search/" + url.PathEscape(query)
		},
		Headers: map[string]string{
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36",
			"Accept":     "text/html",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			return parseNiconicoResults(body, max), nil
		},
	})(config)
}

func parseNiconicoResults(body string, max int) []SearchResult {
	itemRegex := regexp.MustCompile(`(?is)<li[^>]*data-video-item[^>]*>.*?<a[^>]*class="[^"]*itemThumbWrap[^"]*"[^>]*href="([^"]+)"[^>]*>.*?<span[^>]*class="[^"]*videoLength[^"]*"[^>]*>([\d:]+)</span>.*?<p[^>]*class="[^"]*itemTitle[^"]*"[^>]*>.*?<a[^>]*>(.*?)</a>`)
	results := make([]SearchResult, 0, max)
	for _, match := range itemRegex.FindAllStringSubmatch(body, -1) {
		if len(results) >= max {
			break
		}
		relativeURL := strings.TrimSpace(match[1])
		length := strings.TrimSpace(match[2])
		title := strings.TrimSpace(StripHTML(match[3]))
		if relativeURL == "" || title == "" {
			continue
		}
		videoID := relativeURL
		if match := regexp.MustCompile(`/watch/([a-z0-9]+)`).FindStringSubmatch(relativeURL); len(match) > 1 {
			videoID = match[1]
		}
		results = append(results, SearchResult{
			Title:   fmt.Sprintf("%s (%s)", title, length),
			URL:     "https://www.nicovideo.jp/watch/" + videoID,
			Snippet: "Niconico · " + length, Engine: "niconico",
			Position: len(results) + 1, Category: "video",
		})
	}
	if len(results) == 0 {
		fallback := regexp.MustCompile(`(?is)href="/watch/([a-z0-9]+)"[^>]*>.*?<img[^>]*alt="([^"]+)"`)
		for _, match := range fallback.FindAllStringSubmatch(body, -1) {
			if len(results) >= max {
				break
			}
			title := strings.TrimSpace(match[2])
			if title == "" {
				continue
			}
			results = append(results, SearchResult{
				Title: title, URL: "https://www.nicovideo.jp/watch/" + match[1],
				Snippet: "Niconico video", Engine: "niconico",
				Position: len(results) + 1, Category: "video",
			})
		}
	}
	return results
}

func newNVD(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "nvd", Category: "general", UserAgent: "opencode-search/1.0",
		URL: func(query string, num int) string {
			return "https://nvd.nist.gov/extensions/nudp/services/json/nvd/cve/search/results?resultType=records&keyword=" + url.QueryEscape(query) + "&rowCount=" + strconv.Itoa(minInt(num, 20)) + "&offset=0"
		},
		Headers: map[string]string{"Referer": "https://nvd.nist.gov/vuln/search"},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			return parseNVDResults(data, max)
		},
	})(config)
}

func parseNVDResults(data []byte, max int) ([]SearchResult, error) {
	var payload struct {
		Response []struct {
			Grid struct {
				Vulnerabilities []struct {
					CVE struct {
						ID           string `json:"id"`
						Descriptions []struct {
							Value string `json:"value"`
						} `json:"descriptions"`
						Published string `json:"published"`
						Metrics   struct {
							CVSS []struct {
								Data struct {
									Severity string  `json:"baseSeverity"`
									Score    float64 `json:"baseScore"`
								} `json:"cvssData"`
							} `json:"cvssMetricV31"`
						} `json:"metrics"`
					} `json:"cve"`
				} `json:"vulnerabilities"`
			} `json:"grid"`
		} `json:"response"`
	}
	if err := json.Unmarshal(data, &payload); err != nil {
		return nil, err
	}
	if len(payload.Response) == 0 {
		return []SearchResult{}, nil
	}
	results := make([]SearchResult, 0, max)
	for _, item := range payload.Response[0].Grid.Vulnerabilities {
		if len(results) >= max || item.CVE.ID == "" {
			break
		}
		snippet := ""
		if len(item.CVE.Metrics.CVSS) > 0 {
			metric := item.CVE.Metrics.CVSS[0].Data
			snippet = fmt.Sprintf("CVSS %.1f %s", metric.Score, metric.Severity)
		}
		if len(item.CVE.Descriptions) > 0 {
			snippet = strings.TrimSpace(strings.Trim(snippet+" — "+item.CVE.Descriptions[0].Value, " —"))
		}
		var published int64
		if item.CVE.Published != "" {
			if timestamp, err := time.Parse(time.RFC3339, item.CVE.Published); err == nil {
				published = timestamp.UnixMilli()
			}
		}
		results = append(results, SearchResult{
			Title: item.CVE.ID, URL: "https://nvd.nist.gov/vuln/detail/" + item.CVE.ID,
			Snippet: snippet, Engine: "nvd", Position: len(results) + 1,
			PublishedDate: published, Category: "general",
		})
	}
	return results, nil
}

func newRepology(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "repology", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(query string, _ int) string {
			return "https://repology.org/api/v1/projects/?search=" + url.QueryEscape(query)
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			return parseRepologyResults(data, max)
		},
	})(config)
}

func parseRepologyResults(data []byte, max int) ([]SearchResult, error) {
	var projects map[string][]struct {
		Repo    string `json:"repo"`
		Version string `json:"version"`
		Status  string `json:"status"`
		Summary string `json:"summary"`
	}
	if err := json.Unmarshal(data, &projects); err != nil {
		var list []struct {
			Name    string `json:"name"`
			Version string `json:"version"`
			Summary string `json:"summary"`
		}
		if listErr := json.Unmarshal(data, &list); listErr != nil {
			return nil, err
		}
		results := make([]SearchResult, 0, max)
		for _, item := range list {
			if len(results) >= max || item.Name == "" {
				break
			}
			results = append(results, SearchResult{Title: item.Name, URL: "https://repology.org/project/" + url.PathEscape(item.Name), Snippet: item.Version + " · " + item.Summary, Engine: "repology", Position: len(results) + 1, Category: "code"})
		}
		return results, nil
	}
	results := make([]SearchResult, 0, max)
	for name, packages := range projects {
		if len(results) >= max || len(packages) == 0 {
			break
		}
		newest := packages[0]
		for _, item := range packages {
			if item.Status == "newest" {
				newest = item
				break
			}
		}
		results = append(results, SearchResult{Title: name, URL: "https://repology.org/project/" + url.PathEscape(name), Snippet: newest.Version + " · " + newest.Summary, Engine: "repology", Position: len(results) + 1, Category: "code"})
	}
	return results, nil
}
