package websearch

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestDebugZeroResults 调试返回 0 结果但未超时的引擎
func TestDebugZeroResults(t *testing.T) {
	resultsDir := filepath.Join(".", "test_results", "debug")
	os.MkdirAll(resultsDir, 0755)

	// 需要调试的引擎
	engines := []string{
		"unsplash", "pexels", "ansa", "pubmed", "odysee",
	}

	for _, name := range engines {
		t.Run(name, func(t *testing.T) {
			factory, ok := GlobalEngineRegistry.Get(name)
			if !ok {
				t.Skip("not registered")
			}

			engine := factory(EngineConfig{Name: name, Weight: 1.0, Timeout: 15000, MaxResults: 5})

			// 测试多个查询
			queries := []string{"test", "nature", "technology"}

			for _, q := range queries {
				start := time.Now()
				results, err := engine.Search(q, SearchOptions{NumResults: 3}, nil)
				duration := time.Since(start).Milliseconds()

				// 保存原始响应
				report := fmt.Sprintf("Query: %s\nDuration: %dms\nError: %v\nResults: %d\n\n",
					q, duration, err, len(results))
				for i, r := range results {
					report += fmt.Sprintf("  [%d] Title: %s\n  URL: %s\n  Snippet: %s\n\n",
						i+1, r.Title, r.URL, r.Snippet)
				}

				filename := filepath.Join(resultsDir, fmt.Sprintf("%s_%s.txt", name, q))
				os.WriteFile(filename, []byte(report), 0644)

				t.Logf("[%s] q=%q: %d results (%dms) err=%v", name, q, len(results), duration, err)

				if len(results) > 0 {
					j, _ := json.MarshalIndent(results, "", "  ")
					os.WriteFile(filepath.Join(resultsDir, fmt.Sprintf("%s_%s.json", name, q)), j, 0644)
				}
			}
		})
	}
}
