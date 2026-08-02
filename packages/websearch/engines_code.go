// 代码/技术搜索引擎实现
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
	register("github", newGitHub)
	register("github-code", newGitHubCode)
	register("github-issues", newGitHubIssues)
	register("github-repo-files", newGitHubRepoFiles)
	register("gitlab", newGitLab)
	register("huggingface", newHuggingFace)
	register("gitea", newGitea)
	register("sourcehut", newSourceHut)
	register("npm", newNPM)
	register("pypi", newPyPI)
	register("pypi-html", newPyPI)
	register("crates", newCrates)
	register("hex", newHex)
	register("dockerhub", newDockerHub)
	register("packagist", newPackagist)
	register("rubygems", newRubyGems)
	register("pub-dev", newPubDev)
	register("mankier", newMankier)
	register("hoogle", newHoogle)
	register("metacpan", newMetacpan)
	register("archlinux", newArchLinux)
	register("alpinelinux", newAlpineLinux)
	register("voidlinux", newVoidLinux)
	register("fdroid", newFDroid)
	register("mdn", newMDN)
	register("docsrs", newDocsRs)
	register("react-docs", newReactDocs)
	register("vue-docs", newVueDocs)
	register("python-docs", newPythonDocs)
	register("pkg-go-dev", newPkgGoDev)
	register("microsoft-learn", newMicrosoftLearn)
	register("stackexchange", newStackExchange)
}

// ── GitHub ────────────────────────────────────────────

func newGitHub(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "github", Category: "code",
		UserAgent: "opencode-search/1.0",
		// GitHub's repository search API is publicly callable. A token is
		// optional and only increases the rate limit, matching s-code.
		RequiresKey: false,
		URL: func(q string, n int) string {
			return "https://api.github.com/search/repositories?q=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 50)) + "&sort=stars&order=desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Items []struct {
					FullName    string `json:"full_name"`
					HTMLURL     string `json:"html_url"`
					Description string `json:"description"`
					Stars       int    `json:"stargazers_count"`
					Language    string `json:"language"`
				} `json:"items"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.Items {
				if i >= max {
					break
				}
				snippet := item.Description
				if snippet == "" {
					snippet = "⭐ " + strconv.Itoa(item.Stars)
				} else if item.Stars > 0 {
					snippet += " | ⭐ " + strconv.Itoa(item.Stars)
				}
				results = append(results, SearchResult{
					Title: item.FullName, URL: item.HTMLURL, Snippet: snippet,
					Engine: "github", Position: i + 1, Category: "code",
				})
			}
			return results, nil
		},
	})(config)
}

func newNPM(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "npm", Category: "code",
		URL: func(q string, n int) string {
			return "https://registry.npmjs.org/-/v1/search?text=" + url.QueryEscape(q) + "&size=" + strconv.Itoa(minInt(n, 50))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Objects []struct {
					Package struct {
						Name        string `json:"name"`
						Version     string `json:"version"`
						Description string `json:"description"`
						Links       struct {
							Npm string `json:"npm"`
						} `json:"links"`
					} `json:"package"`
				} `json:"objects"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, o := range resp.Objects {
				if i >= max {
					break
				}
				pkg := o.Package
				snippet := pkg.Version
				if pkg.Description != "" {
					snippet += " — " + pkg.Description
				}
				results = append(results, SearchResult{
					Title: pkg.Name, URL: pkg.Links.Npm, Snippet: snippet,
					Engine: "npm", Position: i + 1, Category: "code",
				})
			}
			return results, nil
		},
	})(config)
}
func newPackagist(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{Name: "packagist", Category: "code",
		URL: func(q string, n int) string {
			return "https://packagist.org/search.json?q=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 50))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r struct {
				Results []struct {
					Name, URL, Description string
					Downloads, Favers      int
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &r); err != nil {
				return nil, err
			}
			var res []SearchResult
			for i, p := range r.Results {
				if i >= max {
					break
				}
				res = append(res, SearchResult{Title: p.Name, URL: p.URL, Snippet: p.Description + " · ⬇" + strconv.Itoa(p.Downloads) + " · ⭐" + strconv.Itoa(p.Favers), Engine: "packagist", Position: i + 1, Category: "code"})
			}
			return res, nil
		},
	})(config)
}
func newRubyGems(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{Name: "rubygems", Category: "code",
		URL: func(q string, n int) string {
			return "https://rubygems.org/api/v1/search.json?query=" + url.QueryEscape(q)
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r []struct {
				Name       string `json:"name"`
				ProjectURI string `json:"project_uri"`
				Info       string `json:"info"`
				Downloads  int    `json:"downloads"`
				Version    string `json:"version"`
			}
			if err := json.Unmarshal(data, &r); err != nil {
				return nil, err
			}
			var res []SearchResult
			for i, g := range r {
				if i >= max {
					break
				}
				res = append(res, SearchResult{Title: g.Name + " " + g.Version, URL: g.ProjectURI, Snippet: g.Info[:minInt(len(g.Info), 120)] + " · ⬇" + strconv.Itoa(g.Downloads), Engine: "rubygems", Position: i + 1, Category: "code"})
			}
			return res, nil
		},
	})(config)
}
func newPubDev(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{Name: "pub-dev", Category: "code",
		URL: func(q string, n int) string { return "https://pub.dev/api/search?q=" + url.QueryEscape(q) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r struct {
				Packages []struct{ Package string } `json:"packages"`
			}
			if err := json.Unmarshal(data, &r); err != nil || r.Packages == nil {
				return nil, nil
			}
			var res []SearchResult
			for i, p := range r.Packages {
				if i >= max {
					break
				}
				res = append(res, SearchResult{Title: p.Package, URL: "https://pub.dev/packages/" + p.Package, Snippet: "Dart/Flutter package", Engine: "pub-dev", Position: i + 1, Category: "code"})
			}
			return res, nil
		},
	})(config)
}
func newMankier(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{Name: "mankier", Category: "code",
		URL: func(q string, n int) string { return "https://www.mankier.com/api/v2/mans/?q=" + url.QueryEscape(q) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r struct {
				Results []struct{ Name, URL, Description string } `json:"results"`
			}
			if err := json.Unmarshal(data, &r); err != nil || r.Results == nil {
				return nil, nil
			}
			var res []SearchResult
			for i, m := range r.Results {
				if i >= max {
					break
				}
				s := m.Description
				if s == "" {
					s = "man page: " + m.Name
				}
				res = append(res, SearchResult{Title: m.Name, URL: m.URL, Snippet: s, Engine: "mankier", Position: i + 1, Category: "code"})
			}
			return res, nil
		},
	})(config)
}
func newHoogle(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{Name: "hoogle", Category: "code",
		URL: func(q string, n int) string {
			return "https://hoogle.haskell.org/?hoogle=" + url.QueryEscape(q) + "&mode=json"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r []struct {
				Name, URL, Docs string
				Package         struct{ Name string }
			}
			if err := json.Unmarshal(data, &r); err != nil {
				return nil, nil
			}
			var res []SearchResult
			for i, h := range r {
				if i >= max {
					break
				}
				s := h.Docs[:minInt(len(h.Docs), 120)] + " · " + h.Package.Name
				res = append(res, SearchResult{Title: h.Name, URL: h.URL, Snippet: s, Engine: "hoogle", Position: i + 1, Category: "code"})
			}
			return res, nil
		},
	})(config)
}
func newStackExchange(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{Name: "stackexchange", Category: "code",
		URL: func(q string, n int) string {
			return "https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=" + url.QueryEscape(q) + "&site=stackoverflow&pagesize=" + strconv.Itoa(minInt(n, 20)) + "&filter=withbody"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r struct {
				Items []struct {
					Title, Link                                 string
					Score, AnswerCount, ViewCount, CreationDate int
				} `json:"items"`
			}
			if err := json.Unmarshal(data, &r); err != nil || r.Items == nil {
				return nil, nil
			}
			var res []SearchResult
			for i, item := range r.Items {
				if i >= max {
					break
				}
				if item.Title == "" || item.Link == "" {
					continue
				}
				res = append(res, SearchResult{Title: StripHTML(item.Title), URL: item.Link, Snippet: "⭐" + strconv.Itoa(item.Score) + " · 💬" + strconv.Itoa(item.AnswerCount) + " · 👁" + strconv.Itoa(item.ViewCount), Engine: "stackexchange", Position: i + 1, Category: "code", PublishedDate: int64(item.CreationDate) * 1000})
			}
			return res, nil
		},
	})(config)
}
func newPyPI(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name:     "pypi",
		Category: "code",
		URL: func(q string, n int) string {
			return "https://pypi.org/pypi/" + url.PathEscape(strings.TrimSpace(q)) + "/json"
		},
		Parse: func(data []byte, maxResults int) ([]SearchResult, error) {
			var response struct {
				Info struct {
					Name       string `json:"name"`
					Version    string `json:"version"`
					Summary    string `json:"summary"`
					PackageURL string `json:"package_url"`
				} `json:"info"`
			}
			if err := json.Unmarshal(data, &response); err != nil {
				return nil, err
			}
			if maxResults < 1 || response.Info.Name == "" || response.Info.PackageURL == "" {
				return []SearchResult{}, nil
			}
			return []SearchResult{{
				Title: response.Info.Name + " v" + response.Info.Version,
				URL:   response.Info.PackageURL, Snippet: response.Info.Summary,
				Engine: "pypi", Position: 1, Category: "code",
			}}, nil
		},
	})(config)
}
func newCrates(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "crates", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://crates.io/api/v1/crates?q=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 50))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Crates []struct {
					Name             string   `json:"name"`
					Description      string   `json:"description"`
					NewestVersion    string   `json:"newest_version"`
					MaxVersion       string   `json:"max_version"`
					MaxStableVersion string   `json:"max_stable_version"`
					Keywords         []string `json:"keywords"`
					UpdatedAt        string   `json:"updated_at"`
					Downloads        int64    `json:"downloads"`
				} `json:"crates"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			var results []SearchResult
			for _, c := range resp.Crates {
				if len(results) >= max {
					break
				}
				// 对应 TS: if (!crate.name) continue（不是 break）
				if c.Name == "" {
					continue
				}
				// 对应 TS: newest_version || max_version || max_stable_version
				version := c.NewestVersion
				if version == "" {
					version = c.MaxVersion
				}
				if version == "" {
					version = c.MaxStableVersion
				}
				// 对应 TS 标题: name vVERSION
				title := c.Name
				if version != "" {
					title += " v" + version
				}
				// 对应 TS snippet 格式: [vX · N downloads · keywords] description
				parts := make([]string, 0, 3)
				if version != "" {
					parts = append(parts, "v"+version)
				}
				if c.Downloads > 0 {
					parts = append(parts, fmt.Sprintf("%d downloads", c.Downloads))
				}
				if len(c.Keywords) > 0 {
					topK := 3
					if len(c.Keywords) < 3 {
						topK = len(c.Keywords)
					}
					parts = append(parts, strings.Join(c.Keywords[:topK], ", "))
				}
				snippet := c.Description
				if len(parts) > 0 {
					snippet = "[" + strings.Join(parts, " · ") + "] " + c.Description
				}
				if len(snippet) > 300 {
					snippet = snippet[:300]
				}
				var pubDate int64
				if c.UpdatedAt != "" {
					if t, err := time.Parse(time.RFC3339, c.UpdatedAt); err == nil {
						pubDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: title, URL: "https://crates.io/crates/" + c.Name,
					Snippet: snippet, Engine: "crates",
					Position: len(results) + 1, Category: "code",
					PublishedDate: pubDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newHex(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "hex", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://hex.pm/api/packages?search=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 20))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp []struct {
				Name          string                        `json:"name"`
				LatestVersion string                        `json:"latest_version"`
				Meta          *struct{ Description string } `json:"meta"`
				Downloads     *struct{ All int64 }          `json:"downloads"`
				InsertedAt    string                        `json:"inserted_at"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			var results []SearchResult
			for i, item := range resp {
				if i >= max || item.Name == "" {
					break
				}
				snippet := ""
				if item.Meta != nil && item.Meta.Description != "" {
					snippet = item.Meta.Description
				}
				if item.Downloads != nil && item.Downloads.All > 0 {
					if snippet != "" {
						snippet += " · "
					}
					snippet += strconv.FormatInt(item.Downloads.All, 10) + " downloads"
				}
				title := item.Name
				if item.LatestVersion != "" {
					title += " v" + item.LatestVersion
				}
				var publishedDate int64
				if item.InsertedAt != "" {
					if parsed, err := time.Parse(time.RFC3339, item.InsertedAt); err == nil {
						publishedDate = parsed.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: title, URL: "https://hex.pm/packages/" + item.Name,
					Snippet: snippet, Engine: "hex", Position: i + 1, Category: "code",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newDockerHub(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "dockerhub", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://hub.docker.com/v2/repositories/library/" + url.QueryEscape(q) + "/?page_size=" + strconv.Itoa(minInt(n, 20))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r struct {
				Results []struct {
					Name, RepoName, ShortDescription string
					PullCount, StarCount             int
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &r); err != nil || r.Results == nil {
				return nil, nil
			}
			var res []SearchResult
			for i, p := range r.Results {
				if i >= max {
					break
				}
				name := p.RepoName
				if name == "" {
					name = p.Name
				}
				if name == "" {
					continue
				}
				snippet := p.ShortDescription
				if snippet == "" {
					snippet = strconv.Itoa(p.PullCount) + " pulls"
				}
				res = append(res, SearchResult{
					Title: name, URL: "https://hub.docker.com/r/" + name, Snippet: snippet,
					Engine: "dockerhub", Position: i + 1, Category: "code",
				})
			}
			return res, nil
		},
	})(config)
}
func newMetacpan(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "metacpan", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://fastapi.metacpan.org/v1/module/_search?q=" + url.QueryEscape(q) + "&size=" + strconv.Itoa(minInt(n, 20)) + "&from=0"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				HITS *struct {
					HITS []struct {
						Source struct {
							Name        string `json:"name"`
							Description string `json:"description"`
							URL         string `json:"url"`
							Author      string `json:"author"`
							Abstract    string `json:"abstract"`
							Release     string `json:"release"`
						} `json:"_source"`
					} `json:"hits"`
				} `json:"hits"`
			}
			if err := json.Unmarshal(data, &resp); err != nil || resp.HITS == nil {
				if err != nil {
					return nil, err
				}
				return []SearchResult{}, nil
			}
			results := make([]SearchResult, 0, minInt(max, len(resp.HITS.HITS)))
			for i, h := range resp.HITS.HITS {
				if i >= max || h.Source.Name == "" {
					break
				}
				snippet := h.Source.Abstract
				if snippet == "" {
					snippet = h.Source.Description
				}
				results = append(results, SearchResult{Title: h.Source.Name + " (" + h.Source.Release + ")", URL: "https://metacpan.org/pod/" + h.Source.Name, Snippet: snippet, Engine: "metacpan", Position: i + 1, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newArchLinux(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "archlinux",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://archlinux.org/packages/?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/packages/[^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" || !strings.HasPrefix(href, "/packages/") {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: "https://archlinux.org" + href, Snippet: "Arch Linux package", Engine: "archlinux", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newAlpineLinux(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "alpinelinux",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://pkgs.alpinelinux.org/packages?name=" + url.QueryEscape(q) + "&branch=edge&arch=x86_64"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/package/[^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" || !strings.HasPrefix(href, "/package/") {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: "https://pkgs.alpinelinux.org" + href, Snippet: "Alpine Linux package", Engine: "alpinelinux", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newVoidLinux(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "voidlinux",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://voidlinux.org/packages/?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<small[^>]*>[\s\S]*?<\/small>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: href, Snippet: "Void Linux package", Engine: "voidlinux", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newFDroid(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name:     "fdroid",
		BuildURL: func(q string, opts SearchOptions) string { return "https://f-droid.org/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/packages/[^"]*)"[^>]*>[\s\S]*?<h[^>]*>([\s\S]*?)<\/h`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: "https://f-droid.org" + href, Snippet: "F-Droid app", Engine: "fdroid", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newMDN(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "mdn",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://developer.mozilla.org/en-US/search?q=" + url.QueryEscape(q) + "&locale=en-US"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/en-US/docs/[^"]*)"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: "https://developer.mozilla.org" + href, Snippet: "MDN Web Docs", Engine: "mdn", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newDocsRs(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "docsrs", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://docs.rs/releases/search?query=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 20))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Crates []struct{ Name, Version, Description string } `json:"crates"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, c := range resp.Crates {
				if i >= max || c.Name == "" {
					break
				}
				results = append(results, SearchResult{Title: c.Name + " " + c.Version, URL: "https://docs.rs/" + c.Name + "/latest", Snippet: c.Description, Engine: "docsrs", Position: i + 1, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newReactDocs(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name:     "react-docs",
		BuildURL: func(q string, opts SearchOptions) string { return "https://react.dev/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="(/[^"]*)"[^>]*>[\s\S]*?<h[^>]*>([\s\S]*?)<\/h`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" {
					continue
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: "https://react.dev" + href, Snippet: "React docs", Engine: "react-docs", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newVueDocs(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name:     "vue-docs",
		BuildURL: func(q string, opts SearchOptions) string { return "https://vuejs.org/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<h[^>]*>([\s\S]*?)<\/h`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" {
					continue
				}
				if !strings.HasPrefix(href, "http") {
					href = "https://vuejs.org" + href
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: href, Snippet: "Vue.js docs", Engine: "vue-docs", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newPythonDocs(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "python-docs",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://docs.python.org/3/search.html?q=" + url.QueryEscape(q)
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/span>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max {
					break
				}
				title := StripHTML(m[2])
				href := m[1]
				if title == "" || href == "" {
					continue
				}
				if !strings.HasPrefix(href, "http") {
					href = "https://docs.python.org" + href
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: href, Snippet: "Python docs", Engine: "python-docs", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newPkgGoDev(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "pkg-go-dev", BuildURL: func(q string, opts SearchOptions) string {
			return "https://pkg.go.dev/search?q=" + url.QueryEscape(q) + "&m=package"
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult
			pos := 0
			re := regexp.MustCompile(`<div[^>]*class="[^"]*SearchSnippet[^"]*"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>[\s\S]*?<p[^>]*class="[^"]*SearchSnippet-synopsis[^"]*"[^>]*>([\s\S]*?)<\/p>`)
			for _, match := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max || len(match) < 4 {
					break
				}
				href := strings.TrimSpace(match[1])
				title := StripHTML(match[2])
				if href == "" || title == "" {
					continue
				}
				if !strings.HasPrefix(href, "http") {
					href = "https://pkg.go.dev" + href
				}
				pos++
				results = append(results, SearchResult{Title: title, URL: href, Snippet: StripHTML(match[3]), Engine: "pkg-go-dev", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newMicrosoftLearn(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "microsoft-learn", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://learn.microsoft.com/api/search?search=" + url.QueryEscape(q) + "&locale=en-us&$top=" + strconv.Itoa(minInt(n, 10)) + "&$skip=0&partnerId=LearnSite"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Results []struct {
					URL, Title, Description string
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			var results []SearchResult
			pos := 0
			for _, item := range resp.Results {
				if len(results) >= max || item.URL == "" || item.Title == "" {
					break
				}
				pos++
				results = append(results, SearchResult{Title: item.Title, URL: item.URL, Snippet: item.Description, Engine: "microsoft-learn", Position: pos, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newGitHubCode(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "github-code", Category: "code",
		UserAgent: "opencode-search/1.0", RequiresKey: true,
		URL: func(q string, n int) string {
			return "https://api.github.com/search/code?q=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 50)) + "&sort=indexed&order=desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Items []struct {
					Name     string `json:"name"`
					Path     string `json:"path"`
					HTMLURL  string `json:"html_url"`
					Language string `json:"language"`
					Repo     struct {
						FullName string `json:"full_name"`
						HTMLURL  string `json:"html_url"`
					} `json:"repository"`
					TextMatches []struct {
						Fragment string `json:"fragment"`
					} `json:"text_matches"`
				} `json:"items"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			var results []SearchResult
			for i, item := range resp.Items {
				if i >= max {
					break
				}
				if item.Repo.FullName == "" || item.Path == "" {
					continue
				}
				fragments := make([]string, 0)
				for _, tm := range item.TextMatches {
					if tm.Fragment != "" {
						fragments = append(fragments, tm.Fragment)
					}
				}
				snippet := "File in " + item.Repo.FullName
				if len(fragments) > 0 {
					snippet = strings.Join(fragments, "\n...\n")
					if len(snippet) > 400 {
						snippet = snippet[:400]
					}
				}
				if item.Language != "" {
					snippet = "[" + item.Language + "] " + snippet
				}
				results = append(results, SearchResult{
					Title: item.Repo.FullName + ": " + item.Path, URL: item.HTMLURL,
					Snippet: snippet, Engine: "github-code", Position: i + 1, Category: "code",
				})
			}
			return results, nil
		},
	})(config)
}
func newGitHubIssues(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "github-issues", Category: "code", UserAgent: "opencode-search/1.0", RequiresKey: true,
		URL: func(q string, n int) string {
			return "https://api.github.com/search/issues?q=" + url.QueryEscape(q) + "+type:issue&per_page=" + strconv.Itoa(minInt(n, 50)) + "&sort=relevance&order=desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Items []struct {
					Title    string `json:"title"`
					HTMLURL  string `json:"html_url"`
					State    string `json:"state"`
					Comments int    `json:"comments"`
					User     *struct {
						Login string `json:"login"`
					} `json:"user"`
					CreatedAt string `json:"created_at"`
				} `json:"items"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			results := make([]SearchResult, 0, minInt(max, len(resp.Items)))
			for i, item := range resp.Items {
				if i >= max || item.Title == "" || item.HTMLURL == "" {
					break
				}
				author := ""
				if item.User != nil {
					author = "@" + item.User.Login
				}
				var ts int64
				if item.CreatedAt != "" {
					if t, err := time.Parse(time.RFC3339, item.CreatedAt); err == nil {
						ts = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{Title: item.Title, URL: item.HTMLURL, Snippet: fmt.Sprintf("%s · %s · %d comments", author, item.State, item.Comments), Engine: "github-issues", Position: i + 1, Category: "code", PublishedDate: ts})
			}
			return results, nil
		},
	})(config)
}
func newGitHubRepoFiles(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "github-repo-files", Category: "code", UserAgent: "opencode-search/1.0", RequiresKey: true,
		URL: func(q string, n int) string {
			return "https://api.github.com/search/repositories?q=" + url.QueryEscape(q) + "+in:name&per_page=" + strconv.Itoa(minInt(n, 20)) + "&sort=stars&order=desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Items []struct {
					FullName      string `json:"full_name"`
					HTMLURL       string `json:"html_url"`
					Description   string `json:"description"`
					DefaultBranch string `json:"default_branch"`
					Stars         int    `json:"stargazers_count"`
				} `json:"items"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.Items {
				if i >= max || item.FullName == "" {
					break
				}
				results = append(results, SearchResult{Title: item.FullName, URL: item.HTMLURL, Snippet: fmt.Sprintf("⭐%d · %s", item.Stars, item.Description), Engine: "github-repo-files", Position: i + 1, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newGitLab(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "gitlab", Category: "code",
		UserAgent: "opencode-search/1.0",
		// 对应 TS: PRIVATE-TOKEN header（不是 Authorization Bearer）
		RequiresKey: true, APIKeyHeader: "PRIVATE-TOKEN",
		URL: func(q string, n int) string {
			return "https://gitlab.com/api/v4/projects?search=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 50)) + "&order_by=star_count&sort=desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp []struct {
				Name         string   `json:"name"`
				PathWithNS   string   `json:"path_with_namespace"`
				WebURL       string   `json:"web_url"`
				Desc         string   `json:"description"`
				Stars        int      `json:"star_count"`
				Forks        int      `json:"forks_count"`
				LastActivity string   `json:"last_activity_at"`
				Topics       []string `json:"topics"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			var results []SearchResult
			for _, p := range resp {
				if len(results) >= max {
					break
				}
				// 对应 TS: if (!url || !name) continue（不是 break！）
				name := p.PathWithNS
				if name == "" {
					name = p.Name
				}
				if p.WebURL == "" || name == "" {
					continue
				}
				// 对应 TS: snippet 格式
				parts := make([]string, 0, 4)
				if p.Stars > 0 {
					parts = append(parts, strconv.Itoa(p.Stars)+" stars")
				}
				if p.Forks > 0 {
					parts = append(parts, strconv.Itoa(p.Forks)+" forks")
				}
				if len(p.Topics) > 0 {
					topCount := 3
					if len(p.Topics) < 3 {
						topCount = len(p.Topics)
					}
					parts = append(parts, strings.Join(p.Topics[:topCount], ", "))
				}
				snippet := ""
				if len(parts) > 0 {
					snippet = "[" + strings.Join(parts, " · ") + "] " + p.Desc
				} else {
					snippet = p.Desc
				}
				if len(snippet) > 300 {
					snippet = snippet[:300]
				}
				var pubDate int64
				if p.LastActivity != "" {
					if t, err := time.Parse(time.RFC3339, p.LastActivity); err == nil {
						pubDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: "⭐" + strconv.Itoa(p.Stars) + " " + name,
					URL:   p.WebURL, Snippet: snippet,
					Engine: "gitlab", Position: len(results) + 1, Category: "code",
					PublishedDate: pubDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newHuggingFace(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "huggingface", Category: "code",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://huggingface.co/api/models?search=" + url.QueryEscape(q) + "&direction=-1"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp []struct {
				ID           string `json:"id"`
				Likes        int    `json:"likes"`
				Downloads    int    `json:"downloads"`
				Description  string `json:"description"`
				PipelineTag  string `json:"pipeline_tag"`
				LibraryName  string `json:"library_name"`
				CreatedAt    string `json:"createdAt"`
				LastModified string `json:"lastModified"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, err
			}
			var results []SearchResult
			for i, e := range resp {
				if i >= max || e.ID == "" {
					break
				}
				parts := make([]string, 0, 4)
				if e.Description != "" {
					parts = append(parts, e.Description)
				}
				if e.LibraryName != "" {
					parts = append(parts, "Library: "+e.LibraryName)
				}
				if e.PipelineTag != "" {
					parts = append(parts, e.PipelineTag)
				}
				parts = append(parts, "❤️ "+strconv.Itoa(e.Likes)+" ⬇ "+strconv.Itoa(e.Downloads))
				modified := e.LastModified
				if modified == "" {
					modified = e.CreatedAt
				}
				var publishedDate int64
				if modified != "" {
					if parsed, err := time.Parse(time.RFC3339, modified); err == nil {
						publishedDate = parsed.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: e.ID, URL: "https://huggingface.co/" + e.ID,
					Snippet: strings.Join(parts, " · "), Engine: "huggingface",
					Position: i + 1, Category: "code",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}
func newGitea(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "gitea", Category: "code", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://gitea.com/api/v1/repos/search?q=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 20)) + "&sort=stars&order=desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data []struct {
					FullName    string `json:"full_name"`
					HTMLURL     string `json:"html_url"`
					Description string `json:"description"`
					Stars       int    `json:"stargazers_count"`
					Forks       int    `json:"forks_count"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resp.Data {
				if i >= max || r.FullName == "" {
					break
				}
				results = append(results, SearchResult{Title: r.FullName, URL: r.HTMLURL, Snippet: fmt.Sprintf("%s · ⭐%d 🍴%d", r.Description, r.Stars, r.Forks), Engine: "gitea", Position: i + 1, Category: "code"})
			}
			return results, nil
		},
	})(config)
}
func newSourceHut(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "sourcehut",
		BuildURL: func(q string, opts SearchOptions) string {
			return "https://sr.ht/projects?search=" + url.QueryEscape(q) + "&sort=recently-updated"
		},
		Headers: map[string]string{
			"User-Agent": "opencode-search/1.0 (bot; +https://opencode.ai)",
			"Accept":     "text/html",
			"Referer":    "https://sr.ht/",
		},
		Parse: func(body string, max int) ([]SearchResult, error) {
			results := make([]SearchResult, 0, max)
			eventRe := regexp.MustCompile(`<div[^>]*class="[^"]*event[^"]*"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?[\s\S]*?<\/div>\s*<\/div>`)
			for _, m := range eventRe.FindAllStringSubmatch(body, -1) {
				if len(results) >= max || len(m) < 2 {
					break
				}
				header := m[1]
				links := regexp.MustCompile(`<a[^>]*href="/([^"]+)"[^>]*>([^<]+)<\/a>`).FindAllStringSubmatch(header, -1)
				if len(links) < 2 {
					continue
				}
				username := strings.TrimPrefix(strings.TrimSpace(links[0][1]), "~")
				project := strings.TrimSpace(links[1][2])
				if username == "" || project == "" {
					continue
				}
				snippet := "SourceHut project by ~" + username
				if len(m) > 2 && strings.TrimSpace(m[2]) != "" {
					snippet = StripHTML(m[2])
				}
				results = append(results, SearchResult{Title: "~" + username + "/" + project, URL: "https://sr.ht/~" + username + "/" + project, Snippet: snippet, Engine: "sourcehut", Position: len(results) + 1, Category: "code"})
			}
			if len(results) == 0 {
				fallbackRe := regexp.MustCompile(`<a[^>]*href="/(~[^"/]+/[^"/]+)"[^>]*>([^<]+)<\/a>`)
				for _, m := range fallbackRe.FindAllStringSubmatch(body, -1) {
					if len(results) >= max || len(m) < 3 {
						break
					}
					results = append(results, SearchResult{Title: m[1] + " - " + strings.TrimSpace(m[2]), URL: "https://sr.ht/" + m[1], Snippet: "SourceHut project", Engine: "sourcehut", Position: len(results) + 1, Category: "code"})
				}
			}
			return results, nil
		},
	})(config)
}
