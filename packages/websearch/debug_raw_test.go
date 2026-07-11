package websearch

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

// TestDebugRawResponses 直接打印 HTTP 响应体，诊断引擎返回 0 结果的原因
func TestDebugRawResponses(t *testing.T) {
	resultsDir := filepath.Join(".", "test_results", "raw")
	os.MkdirAll(resultsDir, 0755)

	tests := []struct {
		name string
		url  string
	}{
		{"unsplash", "https://api.unsplash.com/search/photos?query=test&per_page=3"},
		{"pexels", "https://api.pexels.com/v1/search?query=test&per_page=3"},
		{"ansa", "https://www.ansa.it/ricerca.html?q=test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := http.NewRequest("GET", tt.url, nil)
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

			client := &http.Client{}
			resp, err := client.Do(req)
			if err != nil {
				t.Logf("URL: %s", tt.url)
				t.Logf("ERROR: %v", err)
				return
			}
			defer resp.Body.Close()

			body, _ := io.ReadAll(resp.Body)
			snippet := string(body)
			if len(snippet) > 2000 {
				snippet = snippet[:2000]
			}

			t.Logf("URL: %s", tt.url)
			t.Logf("Status: %d", resp.StatusCode)
			t.Logf("Content-Length: %d", len(body))
			t.Logf("Headers: %v", resp.Header)
			t.Logf("Body:\n%s", snippet)

			// 保存完整响应
			filename := filepath.Join(resultsDir, tt.name+".html")
			os.WriteFile(filename, body, 0644)
			t.Logf("Saved raw response to: %s", filename)

			// 检查常见问题
			if resp.StatusCode == 403 {
				t.Log("→ 403 Forbidden: need API key or blocked")
			} else if resp.StatusCode == 401 {
				t.Log("→ 401 Unauthorized: need API key")
			} else if len(body) < 100 {
				t.Log("→ Response too short, likely error")
			}
		})
	}
}

// TestProxyWorking 测试代理是否真正工作
func TestProxyWorking(t *testing.T) {
	proxyURL := os.Getenv("HTTP_PROXY")
	if proxyURL == "" {
		proxyURL = os.Getenv("https_proxy")
	}
	t.Logf("HTTP_PROXY=%q", os.Getenv("HTTP_PROXY"))
	t.Logf("HTTPS_PROXY=%q", os.Getenv("HTTPS_PROXY"))

	proxy, err := url.Parse("http://127.0.0.1:7890")
	if err != nil {
		t.Fatal(err)
	}

	client := &http.Client{
		Transport: &http.Transport{
			Proxy: http.ProxyURL(proxy),
		},
	}

	resp, err := client.Get("https://www.google.com")
	if err != nil {
		t.Fatalf("Proxy test FAILED: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	t.Logf("Google via proxy: status=%d, body_len=%d", resp.StatusCode, len(body))
}
