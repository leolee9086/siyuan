package websearch

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

type failingReader struct{}

func (failingReader) Read([]byte) (int, error) {
	return 0, io.ErrUnexpectedEOF
}

func TestHTTPClientRetriesUnexpectedEOF(t *testing.T) {
	var attempts atomic.Int32
	client := NewHTTPClient(time.Second)
	client.client.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		if attempts.Add(1) == 1 {
			return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(failingReader{})}, nil
		}
		return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader("ok"))}, nil
	})

	status, body, err := client.Get("https://example.com", nil)
	if err != nil {
		t.Fatal(err)
	}
	if status != http.StatusOK || body != "ok" || attempts.Load() != 2 {
		t.Fatalf("status=%d body=%q attempts=%d", status, body, attempts.Load())
	}
}

func TestHTTPClientRetriesTransientServerStatus(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if attempts.Add(1) == 1 {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte("temporary"))
			return
		}
		_, _ = w.Write([]byte("ok"))
	}))
	defer server.Close()

	client := NewHTTPClient(time.Second)
	status, body, err := client.Get(server.URL, nil)
	if err != nil {
		t.Fatal(err)
	}
	if status != http.StatusOK || body != "ok" || attempts.Load() != 2 {
		t.Fatalf("status=%d body=%q attempts=%d", status, body, attempts.Load())
	}
}

func TestHTTPClientDoesNotUseEnvironmentProxy(t *testing.T) {
	oldHTTP, hadHTTP := os.LookupEnv("HTTP_PROXY")
	oldHTTPS, hadHTTPS := os.LookupEnv("HTTPS_PROXY")
	defer func() {
		if hadHTTP {
			_ = os.Setenv("HTTP_PROXY", oldHTTP)
		} else {
			_ = os.Unsetenv("HTTP_PROXY")
		}
		if hadHTTPS {
			_ = os.Setenv("HTTPS_PROXY", oldHTTPS)
		} else {
			_ = os.Unsetenv("HTTPS_PROXY")
		}
	}()
	_ = os.Setenv("HTTP_PROXY", "http://127.0.0.1:7890")
	_ = os.Setenv("HTTPS_PROXY", "http://127.0.0.1:7890")

	client := NewHTTPClient(time.Second)
	transport, ok := client.client.Transport.(*http.Transport)
	if !ok {
		t.Fatalf("unexpected transport type %T", client.client.Transport)
	}
	if transport.Proxy != nil {
		t.Fatal("NewHTTPClient must not inherit ProxyFromEnvironment")
	}
}

func TestUseProxyRequiresCallerEndpoint(t *testing.T) {
	client := NewHTTPClient(time.Second)
	if err := client.UseProxy(NewAutoDetectProxy()); err == nil || !strings.Contains(err.Error(), "provided explicitly") {
		t.Fatalf("unexpected automatic proxy result: %v", err)
	}

	proxy := NewExplicitProxy("http://127.0.0.1:7890", "http://127.0.0.1:7890")
	if err := client.UseProxy(proxy); err != nil {
		t.Fatal(err)
	}
	for _, scheme := range []string{"http", "https"} {
		browserClient := client.browserClient[scheme]
		if browserClient == nil || browserClient.GetProxy() != proxy.HTTP {
			t.Fatalf("scheme=%s did not retain caller proxy: %#v", scheme, browserClient)
		}
	}
}

func TestJSONAPIEngineReportsProtocolFailures(t *testing.T) {
	tests := []struct {
		name string
		body string
		code int
		want string
	}{
		{name: "http status", body: `{}`, code: http.StatusTooManyRequests, want: "HTTP 429"},
		{name: "invalid JSON", body: `{`, code: http.StatusOK, want: "parsing failed"},
		{name: "empty response", body: "", code: http.StatusOK, want: "empty response"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(test.code)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()

			engine := newJSONAPIEngine(jsonAPIConfig{
				Name: "contract", URL: func(string, int) string { return server.URL },
				Parse: func(data []byte, _ int) ([]SearchResult, error) {
					if string(data) != `{}` {
						return nil, errors.New("invalid JSON")
					}
					return []SearchResult{}, nil
				},
			})(EngineConfig{Name: "contract", Timeout: 1000})
			_, err := engine.Search("query", SearchOptions{NumResults: 3}, nil)
			if err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("error=%v, want substring %q", err, test.want)
			}
		})
	}
}

func TestEngineHTTPClientAppliesConfiguredBaseURLAndHeaders(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/search" {
			t.Errorf("path=%q, want /api/search", r.URL.Path)
		}
		if r.URL.Query().Get("q") != "query" {
			t.Errorf("query=%q, want query", r.URL.Query().Get("q"))
		}
		if r.Header.Get("X-Engine-Test") != "configured" {
			t.Errorf("X-Engine-Test=%q, want configured", r.Header.Get("X-Engine-Test"))
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"items":[{"title":"result","url":"https://example.com"}]}`))
	}))
	defer server.Close()

	engine := newJSONAPIEngine(jsonAPIConfig{
		Name: "configured",
		URL:  func(string, int) string { return "https://upstream.invalid/search?q=query" },
		Parse: func(data []byte, _ int) ([]SearchResult, error) {
			if !strings.Contains(string(data), `"items"`) {
				return nil, errors.New("unexpected fixture")
			}
			return []SearchResult{{Title: "result", URL: "https://example.com"}}, nil
		},
	})(EngineConfig{
		Name:    "configured",
		Timeout: 1000,
		BaseURL: server.URL + "/api",
		Headers: map[string]string{"X-Engine-Test": "configured"},
	})
	results, err := engine.Search("query", SearchOptions{NumResults: 1}, nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 1 || results[0].Title != "result" {
		t.Fatalf("unexpected results: %#v", results)
	}
}

func TestGoogleScholarParserSplitsBlocksWithoutUnsupportedRegexpFeatures(t *testing.T) {
	body := `<div class="gs_ri"><h3><a href="https://example.com/one">First paper</a></h3><div class="gs_a">A Author - 2024</div><div class="gs_rs">First abstract</div></div>` +
		`<div class="gs_ri"><h3><a href="https://example.com/two">Second paper</a></h3><div class="gs_a">B Author - 2023</div><div class="gs_rs">Second abstract</div></div>`
	results, err := parseGoogleScholarResults(body, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 || results[0].Title != "First paper" || results[1].Title != "Second paper" {
		t.Fatalf("unexpected Google Scholar results: %#v", results)
	}
}

func TestSogouParserMatchesScodeResultContracts(t *testing.T) {
	body := `<div class="vrwrap" data-url="https://example.com/redirected">` +
		`<h3 class="vr-title"><a href="/link?url=opaque">First <em>result</em> &amp; details</a></h3>` +
		`<div class="ft">A <b>useful</b> snippet</div><cite>2026-07-17</cite></div></div>` +
		`<div class="rb"><h3 class="pt"><a href="https://example.com/direct">Second result</a></h3>` +
		`<div class="ft">Second snippet</div></div></div>`

	results, err := parseSogouResults(body, 5)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 2 {
		t.Fatalf("got %d results, want 2: %#v", len(results), results)
	}
	if results[0].Title != "First result & details" || results[0].URL != "https://example.com/redirected" ||
		results[0].Snippet != "A useful snippet" || results[0].PublishedDate == 0 {
		t.Fatalf("unexpected first Sogou result: %#v", results[0])
	}
	if results[1].Title != "Second result" || results[1].URL != "https://example.com/direct" {
		t.Fatalf("unexpected second Sogou result: %#v", results[1])
	}
}

func TestSogouParserReportsCaptchaAndNonNilEmptyResults(t *testing.T) {
	_, err := parseSogouResults(`<form id="seccodeForm"><p>验证码用于确认这些请求是您的正常行为</p></form>`, 3)
	var captchaErr *CaptchaError
	if err == nil || !errors.As(err, &captchaErr) {
		t.Fatalf("captcha response error=%v", err)
	}

	results, err := parseSogouResults(`<html><body>no results</body></html>`, 3)
	if err != nil {
		t.Fatal(err)
	}
	if results == nil || len(results) != 0 {
		t.Fatalf("empty response parse returned %#v", results)
	}
}

func TestCodeEngineParsersMatchReferenceContracts(t *testing.T) {
	tests := []struct {
		name    string
		factory EngineFactory
		payload string
		wantURL string
	}{
		{name: "crates", factory: func(config EngineConfig) SearchEngine { return newCrates(config) }, payload: `{"crates":[{"name":"tokio","newest_version":"1.0.0","description":"runtime"}]}`, wantURL: "crates.io/crates/tokio"},
		{name: "hex", factory: func(config EngineConfig) SearchEngine { return newHex(config) }, payload: `[{"name":"phoenix","latest_version":"1.7.0","meta":{"description":"framework"}}]`, wantURL: "hex.pm/packages/phoenix"},
		{name: "packagist", factory: func(config EngineConfig) SearchEngine { return newPackagist(config) }, payload: `{"results":[{"name":"laravel/framework","url":"https://packagist.org/packages/laravel/framework","description":"framework"}]}`, wantURL: "packagist.org/packages/laravel/framework"},
		{name: "rubygems", factory: func(config EngineConfig) SearchEngine { return newRubyGems(config) }, payload: `[{"name":"rails","project_uri":"https://rubygems.org/gems/rails","info":"framework","version":"7.0"}]`, wantURL: "rubygems.org/gems/rails"},
		{name: "pypi", factory: func(config EngineConfig) SearchEngine { return newPyPI(config) }, payload: `{"info":{"name":"requests","version":"2.0","summary":"HTTP library","package_url":"https://pypi.org/project/requests/"}}`, wantURL: "pypi.org/project/requests"},
		{name: "gitlab", factory: func(config EngineConfig) SearchEngine { return newGitLab(config) }, payload: `[{"path_with_namespace":"gitlab-org/gitlab","web_url":"https://gitlab.com/gitlab-org/gitlab","star_count":1}]`, wantURL: "gitlab.com/gitlab-org/gitlab"},
		{name: "huggingface", factory: func(config EngineConfig) SearchEngine { return newHuggingFace(config) }, payload: `[{"id":"openai/model","likes":1}]`, wantURL: "huggingface.co/openai/model"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			engine := test.factory(EngineConfig{Name: test.name, Timeout: 1000})
			apiEngine, ok := engine.(*jsonAPIEngine)
			if !ok {
				t.Fatalf("%s is not a JSON API engine", test.name)
			}
			results, err := apiEngine.cfg.Parse([]byte(test.payload), 3)
			if err != nil {
				t.Fatal(err)
			}
			if len(results) != 1 || results[0].Title == "" || !strings.Contains(results[0].URL, test.wantURL) {
				t.Fatalf("unexpected results: %#v", results)
			}
			if results[0].Engine != test.name || results[0].Category != "code" || results[0].Position != 1 {
				t.Fatalf("invalid result metadata: %#v", results[0])
			}
		})
	}
}
