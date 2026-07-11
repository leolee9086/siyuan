package websearch

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// testResult 记录单个引擎的测试结果
type testResult struct {
	Engine         string         `json:"engine"`
	Success        bool           `json:"success"`
	ResultsCount   int            `json:"resultsCount"`
	StatusCode     int            `json:"statusCode,omitempty"`
	Error          string         `json:"error,omitempty"`
	Results        []SearchResult `json:"results,omitempty"`
	DurationMs     int64          `json:"durationMs"`
}

// TestAllEnginesIntegration 对所有已注册引擎进行实际网络调用测试
// 结果保存到 test_results/ 目录供人工审查
func TestAllEnginesIntegration(t *testing.T) {
	engines := GlobalEngineRegistry.List()
	t.Logf("Total registered engines: %d", len(engines))

	resultsDir := filepath.Join(".", "test_results")
	os.MkdirAll(resultsDir, 0755)

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

	var allResults []testResult
	passCount, failCount, zeroCount := 0, 0, 0

	for i, name := range engines {
		factory, ok := GlobalEngineRegistry.Get(name)
		if !ok {
			continue
		}

		engine := factory(EngineConfig{
			Name: name, Weight: 1.0, Timeout: 15000, MaxResults: 5,
		})

		start := time.Now()
		results, err := engine.Search("test search", SearchOptions{NumResults: 3}, nil)
		duration := time.Since(start).Milliseconds()

		tr := testResult{
			Engine:     name,
			DurationMs: duration,
		}

		firstTitle := "-"
		if err != nil {
			tr.Error = err.Error()
			tr.Success = false
			failCount++
		} else if results == nil {
			tr.Error = "nil results"
			tr.Success = false
			failCount++
		} else {
			tr.ResultsCount = len(results)
			tr.Results = results
			tr.Success = len(results) > 0
			if len(results) > 0 {
				firstTitle = truncateStr(results[0].Title, 60)
				if firstTitle == "" {
					firstTitle = "(empty title)"
				}
			}
			if tr.Success {
				passCount++
			} else {
				zeroCount++
			}
		}

		allResults = append(allResults, tr)

		statusIcon := "✅"
		if !tr.Success && tr.Error != "" {
			statusIcon = "❌"
		} else if !tr.Success {
			statusIcon = "⚠️" // 0 results but no error
		}

		fmt.Fprintf(summaryFile, "| %d | %s | %s | %d | %d | %s |\n",
			i+1, name, statusIcon, tr.ResultsCount, tr.DurationMs, firstTitle)

		if tr.Success {
			t.Logf("[%3d/%d] ✅ %-30s %d results %4dms  %s",
				i+1, len(engines), name, tr.ResultsCount, tr.DurationMs, firstTitle)
		} else if tr.Error != "" {
			t.Logf("[%3d/%d] ❌ %-30s %4dms  ERROR: %v",
				i+1, len(engines), name, tr.DurationMs, truncateStr(tr.Error, 80))
		} else {
			t.Logf("[%3d/%d] ⚠️ %-30s 0 results %4dms",
				i+1, len(engines), name, tr.DurationMs)
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
	fmt.Fprintf(summaryFile, "- Success rate: %.1f%%\n", float64(passCount)/float64(len(allResults))*100)

	t.Logf("\n=== Summary ===\nTotal: %d, Passed: %d, ZeroResults: %d, Failed: %d, Rate: %.1f%%\nResults: %s",
		len(allResults), passCount, zeroCount, failCount, float64(passCount)/float64(len(allResults))*100, resultsDir)
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
		{"general", "hello world", []string{"duckduckgo", "bing", "brave", "google", "baidu", "startpage", "qwant", "seznam", "mwmbl", "yandex"}},
		{"academic", "machine learning 2025", []string{"arxiv", "wikipedia", "semantic-scholar", "crossref", "openalex", "openlibrary", "pubmed", "zenodo", "openaire-publications"}},
		{"code", "react hooks", []string{"github", "npm", "stackexchange", "gitlab", "huggingface", "pypi", "crates", "hex", "packagist", "rubygems"}},
		{"social", "technology news", []string{"reddit", "mastodon", "lemmy", "discourse", "bandcamp", "genius", "deezer", "fyyd", "radio-browser", "tootfinder"}},
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

			for _, engineName := range batch.engines {
				factory, ok := GlobalEngineRegistry.Get(engineName)
				if !ok {
					fmt.Fprintf(batchFile, "| %s | NOT_REGISTERED | - | - | - |\n", engineName)
					continue
				}

				engine := factory(EngineConfig{
					Name: engineName, Weight: 1.0, Timeout: 10000, MaxResults: 5,
				})

				start := time.Now()
				results, err := engine.Search(batch.query, SearchOptions{NumResults: 3}, nil)
				duration := time.Since(start).Milliseconds()

				if err != nil {
					fmt.Fprintf(batchFile, "| %s | ERROR | - | %d | %v |\n", engineName, duration, truncateStr(err.Error(), 60))
					t.Logf("[%s] ❌ %s: %v (%dms)", batch.name, engineName, err, duration)
					continue
				}

				if len(results) == 0 {
					fmt.Fprintf(batchFile, "| %s | ZERO_RESULTS | 0 | %d | - |\n", engineName, duration)
					t.Logf("[%s] ⚠️ %s: 0 results (%dms)", batch.name, engineName, duration)
					continue
				}

				firstTitle := truncateStr(results[0].Title, 60)
				if strings.TrimSpace(firstTitle) == "" {
					firstTitle = "(empty title)"
				}

				fmt.Fprintf(batchFile, "| %s | OK | %d | %d | %s |\n", engineName, len(results), duration, firstTitle)
				t.Logf("[%s] ✅ %s: %d results (%dms) — %s", batch.name, engineName, len(results), duration, firstTitle)

				// 保存每个引擎的详细 JSON 结果
				detail := struct {
					Engine   string         `json:"engine"`
					Query    string         `json:"query"`
					Duration int64          `json:"durationMs"`
					Results  []SearchResult `json:"results"`
				}{engineName, batch.query, duration, results}
				j, _ := json.MarshalIndent(detail, "", "  ")
				os.WriteFile(filepath.Join(resultsDir, fmt.Sprintf("%s_%s.json", batch.name, engineName)), j, 0644)
			}
		})
	}
}

func truncateStr(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}
