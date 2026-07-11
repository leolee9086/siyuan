// 学术搜索引擎实现
package websearch

import (
	"encoding/json"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func init() {
	register("arxiv", newArxiv)
	register("semantic-scholar", newSemanticScholar)
	register("wikipedia", newWikipedia)
	register("google-scholar", newGoogleScholar)
	register("crossref", newCrossref)
	register("pubmed", newPubMed)
	register("openalex", newOpenAlex)
	register("core", newCore)
	register("openlibrary", newOpenLibrary)
	register("goodreads", newGoodreads)
	register("zenodo", newZenodo)
	register("ads", newAds)
	register("pdbe", newPdbe)
	register("scanr", newScanr)
	register("openaire-publications", newOpenAirePublications)
	register("annas-archive", newAnnasArchive)
	register("moviepilot", newMoviepilot)
	register("wikidata", newWikidata)
	register("wikicommons", newWikimediaCommons)
}

// ── Arxiv ─────────────────────────────────────────────

func newArxiv(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "arxiv", Category: "academic",
		URL: func(q string, n int) string {
			return "http://export.arxiv.org/api/query?search_query=all:" + url.QueryEscape(q) + "&max_results=" + strconv.Itoa(minInt(n, 50)) + "&sortBy=relevance&sortOrder=descending"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			body := string(data)
			var results []SearchResult
			re := regexp.MustCompile(`<entry>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<id>([\s\S]*?)<\/id>[\s\S]*?<summary>([\s\S]*?)<\/summary>`)
			matches := re.FindAllStringSubmatch(body, -1)
			for i, m := range matches {
				if i >= max {
					break
				}
				results = append(results, SearchResult{
					Title: StripHTML(m[1]), URL: strings.TrimSpace(m[2]),
					Snippet: StripHTML(m[3]), Engine: "arxiv", Position: i + 1, Category: "academic",
				})
			}
			return results, nil
		},
	})(config)
}

// ── Semantic Scholar ──────────────────────────────────

func newSemanticScholar(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "semantic-scholar", Category: "academic",
		URL: func(q string, n int) string {
			return "https://api.semanticscholar.org/graph/v1/paper/search?query=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 50)) + "&fields=title,url,publicationDate,authors,abstract"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Data []struct {
					Title           string `json:"title"`
					URL             string `json:"url"`
					PublicationDate string `json:"publicationDate"`
					Abstract        string `json:"abstract"`
				} `json:"data"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			var results []SearchResult
			for i, p := range resp.Data {
				if i >= max {
					break
				}
				if p.Title == "" || p.URL == "" {
					continue
				}
				var publishedDate int64
				if p.PublicationDate != "" {
					if t, err := time.Parse("2006-01-02", p.PublicationDate); err == nil {
						publishedDate = t.UnixMilli()
					}
				}
				results = append(results, SearchResult{
					Title: p.Title, URL: p.URL, Snippet: p.Abstract,
					Engine: "semantic-scholar", Position: i + 1, Category: "academic",
					PublishedDate: publishedDate,
				})
			}
			return results, nil
		},
	})(config)
}

// ── Wikipedia ─────────────────────────────────────────

func newWikipedia(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "wikipedia", Category: "encyclopedia",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=" + url.QueryEscape(q) + "&srlimit=" + strconv.Itoa(minInt(n, 50)) + "&format=json&origin=*"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Query *struct {
					Search []struct {
						Title   string `json:"title"`
						Snippet string `json:"snippet"`
						PageID  int    `json:"pageid"`
					} `json:"search"`
				} `json:"query"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			if resp.Query == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, s := range resp.Query.Search {
				if i >= max {
					break
				}
				results = append(results, SearchResult{
					Title: s.Title, URL: "https://en.wikipedia.org/wiki/" + url.QueryEscape(strings.ReplaceAll(s.Title, " ", "_")),
					Snippet: StripHTML(s.Snippet), Engine: "wikipedia", Position: i + 1, Category: "encyclopedia",
				})
			}
			return results, nil
		},
	})(config)
}

// ── Google Scholar ────────────────────────────────────

func newGoogleScholar(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "google-scholar",
		BuildURL: func(q string, opts SearchOptions) string {
			hl := "en"
			if opts.Lang != "" {
				hl = strings.Split(strings.Split(opts.Lang, "-")[0], "_")[0]
			}
			return "https://scholar.google.com/scholar?q=" + url.QueryEscape(q) + "&hl=" + hl + "&num=" + strconv.Itoa(minInt(opts.NumResults, 10))
		},
		Headers: map[string]string{"Cookie": "CONSENT=YES+"},
		Parse: func(body string, maxResults int) ([]SearchResult, error) {
			if len(body) < 2000 && strings.Contains(body, "/sorry/") {
				return nil, nil
			}
			return parseGoogleScholarResults(body, maxResults)
		},
	})(config)
}

// ── Crossref ──────────────────────────────────────────

func newCrossref(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "crossref", Category: "academic",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://api.crossref.org/works?query=" + url.QueryEscape(q) + "&rows=" + strconv.Itoa(minInt(n, 50))
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Message *struct {
					Items []struct {
						DOI    string   `json:"DOI"`
						Title  []string `json:"title"`
						Author []struct {
							Given  string `json:"given"`
							Family string `json:"family"`
						} `json:"author"`
						ContainerTitle []string    `json:"container-title"`
						Type          string      `json:"type"`
						Published     interface{} `json:"published"`
						URL           string      `json:"URL"`
					} `json:"items"`
				} `json:"message"`
			}
			if err := json.Unmarshal(data, &resp); err != nil {
				return nil, nil
			}
			if resp.Message == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, item := range resp.Message.Items {
				if i >= max {
					break
				}
				if item.Type == "component" {
					continue
				}
				title := ""
				if len(item.Title) > 0 {
					title = item.Title[0]
				}
				if title == "" && len(item.ContainerTitle) > 0 {
					title = item.ContainerTitle[0]
				}
				if title == "" {
					continue
				}
				u := item.URL
				if u == "" && item.DOI != "" {
					u = "https://doi.org/" + item.DOI
				}
				if u == "" {
					continue
				}
				authors := make([]string, 0, 3)
				for _, a := range item.Author {
					if len(authors) >= 3 {
						break
					}
					authors = append(authors, strings.TrimSpace(a.Given+" "+a.Family))
				}
				parts := make([]string, 0, 4)
				if len(authors) > 0 {
					parts = append(parts, strings.Join(authors, ", "))
				}
				if len(item.ContainerTitle) > 0 {
					parts = append(parts, item.ContainerTitle[0])
				}
				if item.Type != "" {
					parts = append(parts, item.Type)
				}
				if item.DOI != "" {
					parts = append(parts, "DOI: "+item.DOI)
				}
				results = append(results, SearchResult{
					Title: title, URL: u, Snippet: strings.Join(parts, " · "),
					Engine: "crossref", Position: i + 1, Category: "academic",
				})
			}
			return results, nil
		},
	})(config)
}

// ── 占位实现（通过 DuckDuckGo site: 搜索）─────────────

func newPubMed(config EngineConfig) SearchEngine { return &pubmedEngine{config: config} }

type pubmedEngine struct{ config EngineConfig }
func (e *pubmedEngine) Name() string        { return "pubmed" }
func (e *pubmedEngine) Config() EngineConfig { return e.config }
func (e *pubmedEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	status, body, err := client.Get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term="+url.QueryEscape(query)+"&retmax="+strconv.Itoa(minInt(opts.NumResults, 50))+"&retmode=json&sort=relevance", map[string]string{"Accept": "application/json"})
	if err != nil || status < 200 || status >= 400 { return nil, nil }
	var resp struct{ ESearchResult *struct{ IDList []string `json:"idlist"`; Count string } `json:"esearchresult"` }
	if err := json.Unmarshal([]byte(body), &resp); err != nil || resp.ESearchResult == nil { return nil, nil }
	var results []SearchResult
	for i, id := range resp.ESearchResult.IDList {
		if i >= opts.NumResults { break }
		results = append(results, SearchResult{Title: "PubMed ID: " + id, URL: "https://pubmed.ncbi.nlm.nih.gov/" + id + "/", Snippet: "Total results: " + resp.ESearchResult.Count, Engine: "pubmed", Position: i + 1, Category: "academic"})
	}
	return results, nil
}
func newOpenAlex(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "openalex", Category: "academic",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://api.openalex.org/works?search=" + url.QueryEscape(q) + "&per_page=" + strconv.Itoa(minInt(n, 50)) + "&sort=relevance_score:desc"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct {
				Results []struct {
					Title        string `json:"title"`
					ID           string `json:"id"`
					DOI          string `json:"doi"`
					PubDate      string `json:"publication_date"`
					CitedByCount int    `json:"cited_by_count"`
					Authorships  []struct {
						Author *struct{ DisplayName string `json:"display_name"` } `json:"author"`
					} `json:"authorships"`
					PrimaryLocation *struct {
						LandingPageURL string `json:"landing_page_url"`
					} `json:"primary_location"`
				} `json:"results"`
			}
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, w := range resp.Results {
				if i >= max || w.Title == "" { break }
				url := w.ID
				if w.PrimaryLocation != nil && w.PrimaryLocation.LandingPageURL != "" { url = w.PrimaryLocation.LandingPageURL }
				doi := ""
				if w.DOI != "" { doi = "DOI: " + strings.TrimPrefix(w.DOI, "https://doi.org/") }
				authors := make([]string, 0, 3)
				for _, a := range w.Authorships {
					if len(authors) >= 3 { break }
					if a.Author != nil && a.Author.DisplayName != "" { authors = append(authors, a.Author.DisplayName) }
				}
				parts := make([]string, 0, 3)
				if len(authors) > 0 { parts = append(parts, strings.Join(authors, ", ")) }
				if doi != "" { parts = append(parts, doi) }
				if w.CitedByCount > 0 { parts = append(parts, strconv.Itoa(w.CitedByCount)+" citations") }
				var publishedDate int64
				if w.PubDate != "" { if t, err := time.Parse("2006-01-02", w.PubDate); err == nil { publishedDate = t.UnixMilli() } }
				results = append(results, SearchResult{Title: w.Title, URL: url, Snippet: strings.Join(parts, " · "), Engine: "openalex", Position: i + 1, Category: "academic", PublishedDate: publishedDate})
			}
			return results, nil
		},
	})(config)
}
func newCore(config EngineConfig) SearchEngine { return &coreEngine{config: config} }

type coreEngine struct{ config EngineConfig }
func (e *coreEngine) Name() string        { return "core" }
func (e *coreEngine) Config() EngineConfig { return e.config }
func (e *coreEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
	status, body, err := client.Get("https://api.core.ac.uk/v3/search/works?q="+url.QueryEscape(query)+"&limit="+strconv.Itoa(minInt(opts.NumResults, 50)), map[string]string{"Accept": "application/json"})
	if err != nil || status < 200 || status >= 400 { return nil, nil }
	var resp struct{ Results []struct{ Title, DownloadURL, Doi, PublishedDate string `json:"downloadUrl"`; Authors []struct{ Name string } `json:"authors"` } `json:"results"` }
	if err := json.Unmarshal([]byte(body), &resp); err != nil { return nil, nil }
	var results []SearchResult
	for i, r := range resp.Results {
		if i >= opts.NumResults || r.Title == "" { break }
		authors := []string{}; for _, a := range r.Authors { authors = append(authors, a.Name) }
		url := r.DownloadURL; if url == "" && r.Doi != "" { url = "https://doi.org/" + r.Doi }
		var ts int64; if r.PublishedDate != "" { if t, err := time.Parse("2006-01-02", r.PublishedDate); err == nil { ts = t.UnixMilli() } }
		results = append(results, SearchResult{Title: r.Title, URL: url, Snippet: strings.Join(authors, ", "), Engine: "core", Position: i + 1, Category: "academic", PublishedDate: ts})
	}
	return results, nil
}
func newOpenLibrary(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "openlibrary", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://openlibrary.org/search.json?q=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 50)) + "&fields=*"
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var r struct{ Docs []struct{ Key, Title string; AuthorName []string `json:"author_name"`; FirstPublishYear int `json:"first_publish_year"`; Isbn []string `json:"isbn"` } `json:"docs"` }
			if err := json.Unmarshal(data, &r); err != nil || r.Docs == nil { return nil, nil }
			var res []SearchResult
			for i, b := range r.Docs {
				if i >= max || b.Title == "" || b.Key == "" { break }
				year := ""; if b.FirstPublishYear > 0 { year = strconv.Itoa(b.FirstPublishYear) }
				parts := make([]string, 0, 3)
				if len(b.AuthorName) > 0 { parts = append(parts, strings.Join(b.AuthorName[:minInt(3, len(b.AuthorName))], ", ")) }
				if year != "" { parts = append(parts, year) }
				if len(b.Isbn) > 0 { parts = append(parts, "ISBN: "+b.Isbn[0]) }
				var publishedDate int64
				if b.FirstPublishYear > 0 { if t, err := time.Parse("2006-01-02", strconv.Itoa(b.FirstPublishYear)+"-01-01"); err == nil { publishedDate = t.UnixMilli() } }
				title := b.Title; if year != "" { title += " (" + year + ")" }
				res = append(res, SearchResult{Title: title, URL: "https://openlibrary.org" + b.Key, Snippet: strings.Join(parts, " · "), Engine: "openlibrary", Position: i + 1, Category: "academic", PublishedDate: publishedDate})
			}
			return res, nil
		},
	})(config)
}
func newGoodreads(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "goodreads",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.goodreads.com/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<a[^>]*class="bookTitle"[^>]*href="([^"]*)"[^>]*>[\s\S]*?<span[^>]*itemprop="name"[^>]*>([\s\S]*?)<\/span>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); url := m[1]; if title == "" || url == "" { continue }
				if !strings.HasPrefix(url, "http") { url = "https://www.goodreads.com" + url }
				pos++; results = append(results, SearchResult{Title: title, URL: url, Snippet: "Goodreads book", Engine: "goodreads", Position: pos, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newZenodo(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "zenodo", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://zenodo.org/api/records?q=" + url.QueryEscape(q) + "&size=" + strconv.Itoa(minInt(n, 50)) + "&sort=mostrecent" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ HITS *struct{ HITS []struct{ ID int; Metadata struct{ Title, Description, DOI string } `json:"metadata"`; Links struct{ Self string } `json:"links"` } `json:"hits"` } `json:"hits"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.HITS == nil { return nil, nil }
			var results []SearchResult
			for i, h := range resp.HITS.HITS {
				if i >= max || h.Metadata.Title == "" { break }
				url := h.Links.Self; if url == "" && h.Metadata.DOI != "" { url = "https://doi.org/" + h.Metadata.DOI }
				results = append(results, SearchResult{Title: h.Metadata.Title, URL: url, Snippet: truncate(h.Metadata.Description, 200), Engine: "zenodo", Position: i + 1, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newAds(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "ads", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://api.adsabs.harvard.edu/v1/search/query?q=" + url.QueryEscape(q) + "&rows=" + strconv.Itoa(minInt(n, 50)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Response *struct{ Docs []struct{ Title []string `json:"title"`; Bibcode, URL, Abstract string } `json:"docs"` } `json:"response"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Response == nil { return nil, nil }
			var results []SearchResult
			for i, d := range resp.Response.Docs {
				if i >= max || len(d.Title) == 0 || d.Title[0] == "" { break }
				results = append(results, SearchResult{Title: d.Title[0], URL: d.URL, Snippet: truncate(d.Abstract, 200), Engine: "ads", Position: i + 1, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newPdbe(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "pdbe", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://www.ebi.ac.uk/pdbe/api/search/pdb/elasticsearch?q=" + url.QueryEscape(q) + "&size=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ HITS *struct{ HITS []struct{ ID string `json:"_id"`; Source struct{ Title, Description string `json:"title"` } `json:"_source"` } `json:"hits"` } `json:"hits"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.HITS == nil { return nil, nil }
			var results []SearchResult
			for i, h := range resp.HITS.HITS {
				if i >= max || h.ID == "" { break }
				results = append(results, SearchResult{Title: h.Source.Title, URL: "https://www.ebi.ac.uk/pdbe/entry/pdb/" + h.ID, Snippet: truncate(h.Source.Description, 200), Engine: "pdbe", Position: i + 1, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newScanr(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "scanr", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://scanr.io/api/search?q=" + url.QueryEscape(q) + "&rows=" + strconv.Itoa(minInt(n, 20)) },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Results []struct{ Title, URL, Abstract string } `json:"results"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, r := range resp.Results {
				if i >= max || r.Title == "" { break }
				results = append(results, SearchResult{Title: r.Title, URL: r.URL, Snippet: truncate(r.Abstract, 200), Engine: "scanr", Position: i + 1, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newOpenAirePublications(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "openaire-publications", Category: "academic",
		UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string {
			return "https://api.openaire.eu/search/publications?format=json&size=" + strconv.Itoa(minInt(n, 50)) + "&title=" + url.QueryEscape(q)
		},
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var raw interface{}
			if err := json.Unmarshal(data, &raw); err != nil {
				return nil, nil
			}
			m, _ := raw.(map[string]interface{})
			if m == nil {
				return nil, nil
			}
			resp, _ := m["response"].(map[string]interface{})
			if resp == nil {
				return nil, nil
			}
			resultsObj, _ := resp["results"].(map[string]interface{})
			if resultsObj == nil {
				return nil, nil
			}
			resultsArr, _ := resultsObj["result"].([]interface{})
			if resultsArr == nil {
				return nil, nil
			}
			var results []SearchResult
			for i, r := range resultsArr {
				if i >= max {
					break
				}
				rm, _ := r.(map[string]interface{})
				if rm == nil {
					continue
				}
				metadata, _ := rm["metadata"].(map[string]interface{})
				if metadata == nil {
					continue
				}
				entity, _ := metadata["oaf:entity"].(map[string]interface{})
				if entity == nil {
					continue
				}
				oafResult, _ := entity["oaf:result"].(map[string]interface{})
				if oafResult == nil {
					continue
				}
				title := ""
				if titleArr, ok := oafResult["title"].([]interface{}); ok && len(titleArr) > 0 {
					if t, ok := titleArr[0].(map[string]interface{}); ok {
						if s, ok := t["$"].(string); ok {
							title = s
						}
					}
				}
				if title == "" {
					title = "Untitled"
				}
				desc := ""
				if descArr, ok := oafResult["description"].([]interface{}); ok && len(descArr) > 0 {
					if d, ok := descArr[0].(map[string]interface{}); ok {
						if s, ok := d["$"].(string); ok {
							desc = s
						}
					}
				}
				url := ""
				if children, ok := oafResult["children"].(map[string]interface{}); ok {
					if instance, ok := children["instance"].(map[string]interface{}); ok {
						if webresource, ok := instance["webresource"].(map[string]interface{}); ok {
							if urlArr, ok := webresource["url"].([]interface{}); ok && len(urlArr) > 0 {
								if u, ok := urlArr[0].(map[string]interface{}); ok {
									if s, ok := u["$"].(string); ok {
										url = s
									}
								}
							}
						}
					}
				}
				snippet := desc
				if len(snippet) > 150 {
					snippet = snippet[:150]
				}
				results = append(results, SearchResult{
					Title: title, URL: url, Snippet: snippet,
					Engine: "openaire-publications", Position: i + 1, Category: "academic",
				})
			}
			return results, nil
		},
	})(config)
}
func newAnnasArchive(config EngineConfig) SearchEngine { return &annasArchiveEngine{config: config} }

type annasArchiveEngine struct{ config EngineConfig }
func (e *annasArchiveEngine) Name() string        { return "annas-archive" }
func (e *annasArchiveEngine) Config() EngineConfig { return e.config }
func (e *annasArchiveEngine) Search(query string, opts SearchOptions, headers map[string]string) ([]SearchResult, error) {
	mirrors := []string{"https://annas-archive.gl", "https://annas-archive.vg", "https://annas-archive.pk", "https://annas-archive.gd"}
	for _, base := range mirrors {
		client := NewHTTPClient(time.Duration(e.config.Timeout) * time.Millisecond)
		status, body, err := client.Get(base+"/search?q="+url.QueryEscape(query)+"&page=1", nil)
		if err != nil || status < 200 || status >= 400 { continue }
		var results []SearchResult; pos := 0
		re := regexp.MustCompile(`<div[^>]*class="[^"]*flex[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>[\s\S]*?<a[^>]*class="[^"]*js-vim-focus[^"]*"[^>]*>([\s\S]*?)<\/a>`)
		for _, m := range re.FindAllStringSubmatch(body, -1) {
			if len(results) >= opts.NumResults { break }
			title := StripHTML(m[2]); href := m[1]; if title == "" || href == "" { continue }
			if strings.HasPrefix(href, "/") { href = base + href }
			pos++; results = append(results, SearchResult{Title: title, URL: href, Snippet: "Anna's Archive book", Engine: "annas-archive", Position: pos})
		}
		if len(results) > 0 { return results, nil }
	}
	return nil, nil
}
func newMoviepilot(config EngineConfig) SearchEngine {
	return newHTMLScraperEngine(htmlScraperConfig{
		Name: "moviepilot",
		BuildURL: func(q string, opts SearchOptions) string { return "https://www.moviepilot.de/search?q=" + url.QueryEscape(q) },
		Parse: func(body string, max int) ([]SearchResult, error) {
			var results []SearchResult; pos := 0
			re := regexp.MustCompile(`<a[^>]*class="[^"]*title[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>`)
			for _, m := range re.FindAllStringSubmatch(body, -1) {
				if len(results) >= max { break }
				title := StripHTML(m[2]); href := m[1]; if title == "" || href == "" { continue }
				if !strings.HasPrefix(href, "http") { href = "https://www.moviepilot.de" + href }
				pos++; results = append(results, SearchResult{Title: title, URL: href, Snippet: "", Engine: "moviepilot", Position: pos, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newWikidata(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "wikidata", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" + url.QueryEscape(q) + "&limit=" + strconv.Itoa(minInt(n, 50)) + "&language=en&format=json" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Search []struct{ ID, Title, URL, Description string; Match *struct{ Text string } `json:"match"` } `json:"search"` }
			if err := json.Unmarshal(data, &resp); err != nil { return nil, nil }
			var results []SearchResult
			for i, s := range resp.Search {
				if i >= max || s.ID == "" { break }
				results = append(results, SearchResult{Title: s.Title, URL: "https://www.wikidata.org/wiki/" + s.ID, Snippet: s.Description, Engine: "wikidata", Position: i + 1, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
func newWikimediaCommons(config EngineConfig) SearchEngine {
	return newJSONAPIEngine(jsonAPIConfig{
		Name: "wikicommons", Category: "academic", UserAgent: "opencode-search/1.0",
		URL: func(q string, n int) string { return "https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=" + url.QueryEscape(q) + "&srlimit=" + strconv.Itoa(minInt(n, 50)) + "&format=json&origin=*" },
		Parse: func(data []byte, max int) ([]SearchResult, error) {
			var resp struct{ Query *struct{ Search []struct{ Title, Snippet string } `json:"search"` } `json:"query"` }
			if err := json.Unmarshal(data, &resp); err != nil || resp.Query == nil { return nil, nil }
			var results []SearchResult
			for i, s := range resp.Query.Search {
				if i >= max || s.Title == "" { break }
				results = append(results, SearchResult{Title: s.Title, URL: "https://commons.wikimedia.org/wiki/" + url.QueryEscape(strings.ReplaceAll(s.Title, " ", "_")), Snippet: StripHTML(s.Snippet), Engine: "wikicommons", Position: i + 1, Category: "academic"})
			}
			return results, nil
		},
	})(config)
}
