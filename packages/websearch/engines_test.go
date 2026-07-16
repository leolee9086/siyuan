package websearch

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// testResult 记录单个引擎的测试结果
type testResult struct {
	Engine              string         `json:"engine"`
	Success             bool           `json:"success"`
	RequiresCredentials bool           `json:"requiresCredentials,omitempty"`
	ResultsCount        int            `json:"resultsCount"`
	StatusCode          int            `json:"statusCode,omitempty"`
	Error               string         `json:"error,omitempty"`
	Results             []SearchResult `json:"results,omitempty"`
	DurationMs          int64          `json:"durationMs"`
}

// TestAllEnginesIntegration 对所有已注册引擎进行实际网络调用测试
// 结果保存到测试临时目录供人工审查，避免污染版本控制目录。
func TestAllEnginesIntegration(t *testing.T) {
	engines := GlobalEngineRegistry.List()
	t.Logf("Total registered engines: %d", len(engines))

	resultsDir := t.TempDir()

	sumPath := filepath.Join(resultsDir, "SUMMARY.md")
	summaryFile, err := os.Create(sumPath)
	if err != nil {
		t.Fatal(err)
	}
	defer summaryFile.Close()

	fmt.Fprintf(summaryFile, "# WebSearch Engine Integration Test Results\n\n")
	fmt.Fprintf(summaryFile, "Date: %s\n\n", time.Now().Format(time.RFC3339))
	fmt.Fprintf(summaryFile, "| # | Engine | Status | Results | Time(ms) | First Title |\n")
	fmt.Fprintf(summaryFile, "|---|--------|--------|---------|----------|-------------|\n")

	allResults := make([]testResult, len(engines))
	testProxy := explicitTestProxy()
	sem := make(chan struct{}, MAX_CONCURRENCY)
	var wg sync.WaitGroup
	for i, name := range engines {
		wg.Add(1)
		go func(index int, engineName string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			factory, ok := GlobalEngineRegistry.Get(engineName)
			if !ok {
				allResults[index] = testResult{Engine: engineName, Error: "not_registered"}
				return
			}
			engine := factory(EngineConfig{Name: engineName, Weight: 1.0, Timeout: 15000, MaxResults: 5, Proxy: testProxy})
			if engine.Config().RequiresKey && strings.TrimSpace(engine.Config().APIKey) == "" {
				allResults[index] = testResult{Engine: engineName, RequiresCredentials: true, Error: "requires_credentials"}
				return
			}
			allResults[index] = runIntegrationEngine(engine, "test search")
		}(i, name)
	}
	wg.Wait()

	passCount, failCount, zeroCount, credentialCount := 0, 0, 0, 0
	for i, tr := range allResults {
		firstTitle := "-"
		if len(tr.Results) > 0 {
			firstTitle = truncateStr(tr.Results[0].Title, 60)
			if firstTitle == "" {
				firstTitle = "(empty title)"
			}
		}
		if tr.RequiresCredentials {
			credentialCount++
			fmt.Fprintf(summaryFile, "| %d | %s | 🔐 | - | - | requires_credentials |\n", i+1, tr.Engine)
			t.Logf("[%3d/%d] 🔐 %-30s requires_credentials", i+1, len(engines), tr.Engine)
			continue
		}
		if tr.Success {
			passCount++
		} else if tr.Error == "" {
			zeroCount++
		} else {
			failCount++
		}
		statusIcon := "✅"
		if !tr.Success && tr.Error != "" {
			statusIcon = "❌"
		} else if !tr.Success {
			statusIcon = "⚠️"
		}
		fmt.Fprintf(summaryFile, "| %d | %s | %s | %d | %d | %s |\n", i+1, tr.Engine, statusIcon, tr.ResultsCount, tr.DurationMs, firstTitle)
		if tr.Success {
			t.Logf("[%3d/%d] ✅ %-30s %d results %4dms  %s", i+1, len(engines), tr.Engine, tr.ResultsCount, tr.DurationMs, firstTitle)
		} else if tr.Error != "" {
			t.Logf("[%3d/%d] ❌ %-30s %4dms  ERROR: %v", i+1, len(engines), tr.Engine, tr.DurationMs, truncateStr(tr.Error, 80))
		} else {
			t.Logf("[%3d/%d] ⚠️ %-30s 0 results %4dms", i+1, len(engines), tr.Engine, tr.DurationMs)
		}
	}

	// 写 JSON 详细结果
	jsonData, _ := json.MarshalIndent(allResults, "", "  ")
	os.WriteFile(filepath.Join(resultsDir, "results.json"), jsonData, 0644)

	fmt.Fprintf(summaryFile, "\n## Summary\n\n")
	fmt.Fprintf(summaryFile, "- Total engines: %d\n", len(allResults))
	fmt.Fprintf(summaryFile, "- ✅ Passed (with results): %d\n", passCount)
	fmt.Fprintf(summaryFile, "- ⚠️ Zero results (no error): %d\n", zeroCount)
	fmt.Fprintf(summaryFile, "- ❌ Failed (error): %d\n", failCount)
	fmt.Fprintf(summaryFile, "- 🔐 Requires credentials: %d\n", credentialCount)
	fmt.Fprintf(summaryFile, "- Success rate: %.1f%%\n", float64(passCount)/float64(len(allResults))*100)

	t.Logf("\n=== Summary ===\nTotal: %d, Passed: %d, ZeroResults: %d, Failed: %d, Rate: %.1f%%\nResults: %s",
		len(allResults), passCount, zeroCount, failCount, float64(passCount)/float64(len(allResults))*100, resultsDir)
}

// TestSCodeWorkingEnginesIntegration verifies the explicit working-engine
// baseline documented by s-code through the same real HTTP path used by the
// shared Go service. It is opt-in because it performs external requests.
func TestSCodeWorkingEnginesIntegration(t *testing.T) {
	if os.Getenv("WEBSEARCH_RUN_REAL_NETWORK") != "1" {
		t.Skip("set WEBSEARCH_RUN_REAL_NETWORK=1 to run the s-code baseline")
	}
	proxyURL := os.Getenv("WEBSEARCH_TEST_PROXY")
	if proxyURL == "" {
		t.Fatal("WEBSEARCH_TEST_PROXY must be set to the caller-provided proxy endpoint")
	}
	baseline := []struct {
		name  string
		query string
	}{
		{name: "github", query: "React 19 new features"},
		{name: "crates", query: "fast JSON parser Rust"},
		{name: "imdb", query: "Inception movie"},
		{name: "bilibili", query: "React 19 new features"},
		{name: "stackexchange", query: "Python requests library"},
		{name: "hackernews", query: "latest technology"},
	}
	for _, item := range baseline {
		t.Run(item.name, func(t *testing.T) {
			factory, ok := GlobalEngineRegistry.Get(item.name)
			if !ok {
				t.Fatalf("engine is not registered")
			}
			engine := factory(EngineConfig{
				Name: item.name, Timeout: 30000, MaxResults: 5,
				Proxy: NewExplicitProxy(proxyURL, proxyURL),
			})
			if engine.Config().RequiresKey {
				t.Fatalf("s-code baseline engine unexpectedly requires credentials")
			}
			result := runIntegrationEngine(engine, item.query)
			if !result.Success {
				t.Fatalf("real baseline probe failed after %dms: %s", result.DurationMs, result.Error)
			}
			t.Logf("%d results in %dms", result.ResultsCount, result.DurationMs)
		})
	}
}

func explicitTestProxy() ProxyConfig {
	proxyURL := os.Getenv("WEBSEARCH_TEST_PROXY")
	if proxyURL == "" {
		return NewProxyConfig()
	}
	return NewExplicitProxy(proxyURL, proxyURL)
}

func runIntegrationEngine(engine SearchEngine, query string) testResult {
	result := testResult{Engine: engine.Name()}
	started := time.Now()
	type outcome struct {
		results []SearchResult
		err     error
	}
	outcomeCh := make(chan outcome, 1)
	go func() {
		results, err := engine.Search(query, SearchOptions{NumResults: 3}, nil)
		outcomeCh <- outcome{results: results, err: err}
	}()
	timeout := time.Duration(engine.Config().Timeout) * time.Millisecond
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	select {
	case outcome := <-outcomeCh:
		result.DurationMs = time.Since(started).Milliseconds()
		if outcome.err != nil {
			result.Error = outcome.err.Error()
			return result
		}
		if outcome.results == nil {
			result.Error = "nil results"
			return result
		}
		result.Results = outcome.results
		result.ResultsCount = len(outcome.results)
		result.Success = len(outcome.results) > 0
		return result
	case <-time.After(timeout + 2*time.Second):
		result.DurationMs = time.Since(started).Milliseconds()
		result.Error = (&TimeoutError{Engine: engine.Name(), Message: "integration probe exceeded hard timeout"}).Error()
		return result
	}
}

// TestEngineBatches 分批次测试引擎组
func TestEngineBatches(t *testing.T) {
	if testing.Short() {
		t.Skip("short mode")
	}

	resultsDir := filepath.Join(".", "test_results", "batches")
	os.MkdirAll(resultsDir, 0755)

	batches := []struct {
		name    string
		query   string
		engines []string
	}{
		{name: "general", query: "hello world", engines: []string{"duckduckgo", "bing", "brave", "google", "baidu", "startpage", "qwant", "seznam", "mwmbl", "yandex"}},
		{name: "academic", query: "machine learning 2025", engines: []string{"arxiv", "wikipedia", "semantic-scholar", "crossref", "openalex", "openlibrary", "pubmed", "zenodo", "openaire-publications"}},
		{name: "code", query: "react hooks", engines: []string{"github", "npm", "stackexchange", "gitlab", "huggingface", "pypi", "crates", "hex", "packagist", "rubygems"}},
		{name: "social", query: "technology news", engines: []string{"reddit", "mastodon", "lemmy", "discourse", "bandcamp", "genius", "deezer", "fyyd", "radio-browser", "tootfinder"}},
		{"video", "music video", []string{"youtube", "bilibili", "dailymotion", "vimeo", "rumble", "odysee", "peertube", "sepiasearch", "piped", "invidious"}},
		{"news", "latest technology", []string{"hackernews", "reuters", "bbc-news", "theguardian", "techcrunch", "theverge", "arstechnica", "tagesschau", "ansa", "yahoo-news"}},
		{"image", "nature photography", []string{"unsplash", "pixabay", "pexels", "flickr", "openclipart", "artic", "wallhaven", "findthatmeme", "deviantart"}},
		{"finance", "apple stock", []string{"coingecko", "yahoo-finance", "wttr", "open-meteo"}},
		{"dictionary", "etymology", []string{"jisho", "etymonline", "emojipedia", "dictzone", "duden"}},
		{"shopping", "wireless mouse", []string{"ebay", "amazon-us", "amazon-cn", "jd", "taobao", "smzdm"}},
		{"entertainment", "stranger things", []string{"imdb", "steam", "rawg", "tvmaze", "rottentomatoes", "igdb"}},
		{"china", "人工智能", []string{"baidu", "sogou", "360search", "chinaso", "quark", "weibo", "zhihu", "xiaohongshu", "douban"}},
	}

	for _, batch := range batches {
		t.Run(batch.name, func(t *testing.T) {
			batchFile, err := os.Create(filepath.Join(resultsDir, batch.name+".md"))
			if err != nil {
				t.Fatal(err)
			}
			defer batchFile.Close()

			fmt.Fprintf(batchFile, "# Batch: %s\n\nQuery: `%s`\n\n", batch.name, batch.query)
			fmt.Fprintf(batchFile, "| Engine | Status | Results | Time(ms) | First Result |\n")
			fmt.Fprintf(batchFile, "|--------|--------|---------|----------|-------------|\n")

			var mu sync.Mutex
			var wg sync.WaitGroup
			sem := make(chan struct{}, 5) // 每批最多 5 个并发

			for _, engineName := range batch.engines {
				factory, ok := GlobalEngineRegistry.Get(engineName)
				if !ok {
					fmt.Fprintf(batchFile, "| %s | NOT_REGISTERED | - | - | - |\n", engineName)
					t.Errorf("[%s] %s is not registered", batch.name, engineName)
					continue
				}

				engine := factory(EngineConfig{
					Name: engineName, Weight: 1.0, Timeout: 10000, MaxResults: 5,
				})
				if engine.Config().RequiresKey && strings.TrimSpace(engine.Config().APIKey) == "" {
					fmt.Fprintf(batchFile, "| %s | REQUIRES_CREDENTIALS | - | - | - |\n", engineName)
					t.Logf("[%s] 🔐 %s: requires_credentials", batch.name, engineName)
					continue
				}

				wg.Add(1)
				sem <- struct{}{}

				query := batch.query
				if engineName == "huggingface" {
					query = "text generation"
				} else if engineName == "pypi" {
					query = "requests"
				}
				go func(eng SearchEngine, name, query string) {
					defer wg.Done()
					defer func() { <-sem }()

					start := time.Now()
					results, err := eng.Search(query, SearchOptions{NumResults: 3}, nil)
					duration := time.Since(start).Milliseconds()

					mu.Lock()
					defer mu.Unlock()

					if err != nil {
						fmt.Fprintf(batchFile, "| %s | ERROR | - | %d | %v |\n", name, duration, truncateStr(err.Error(), 60))
						t.Errorf("[%s] %s: %v (%dms)", batch.name, name, err, duration)
						return
					}

					if len(results) == 0 {
						fmt.Fprintf(batchFile, "| %s | ZERO_RESULTS | 0 | %d | - |\n", name, duration)
						t.Errorf("[%s] %s: 0 results (%dms)", batch.name, name, duration)
						return
					}

					firstTitle := truncateStr(results[0].Title, 60)
					if strings.TrimSpace(firstTitle) == "" {
						firstTitle = "(empty title)"
					}

					fmt.Fprintf(batchFile, "| %s | OK | %d | %d | %s |\n", name, len(results), duration, firstTitle)
					t.Logf("[%s] ✅ %s: %d results (%dms) — %s", batch.name, name, len(results), duration, firstTitle)

					// 保存每个引擎的详细 JSON 结果
					detail := struct {
						Engine   string         `json:"engine"`
						Query    string         `json:"query"`
						Duration int64          `json:"durationMs"`
						Results  []SearchResult `json:"results"`
					}{name, query, duration, results}
					j, _ := json.MarshalIndent(detail, "", "  ")
					os.WriteFile(filepath.Join(resultsDir, fmt.Sprintf("%s_%s.json", batch.name, name)), j, 0644)
				}(engine, engineName, query)
			}

			wg.Wait()
		})
	}
}

func truncateStr(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}
