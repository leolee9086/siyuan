package websearch

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
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
