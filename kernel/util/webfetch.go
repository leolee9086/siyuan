// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package util

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/88250/lute"
)

const (
	maxWebFetchBytes              = 5 * 1024 * 1024  // text/html, text/plain
	maxWebFetchFileBytes          = 10 * 1024 * 1024 // file/image download
	maxWebFetchChars              = 50000
	defaultWebFetchTimeoutSeconds = 30
	maxWebFetchTimeoutSeconds     = 120
	maxWebFetchRedirects          = 10
)

type WebFetchOptions struct {
	Format         string
	TimeoutSeconds int
	MaxChars       int
	ProxyURL       string
}

type WebFetchResult struct {
	URL         string `json:"url"`
	ContentType string `json:"contentType"`
	Format      string `json:"format"`
	Output      string `json:"output"`
	Truncated   bool   `json:"truncated"`
}

func WebFetch(rawURL, format string) (string, error) {
	result, err := FetchWebPage(rawURL, WebFetchOptions{Format: format})
	if err != nil {
		return "", err
	}
	return result.Output, nil
}

func FetchWebPage(rawURL string, options WebFetchOptions) (WebFetchResult, error) {
	u, err := url.Parse(rawURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return WebFetchResult{}, errors.New("URL must start with http:// or https://")
	}
	if u.Host == "" {
		return WebFetchResult{}, errors.New("URL has no host")
	}

	if err := CheckHostSSRF(u.Hostname()); err != nil {
		return WebFetchResult{}, err
	}

	timeout := options.TimeoutSeconds
	if timeout <= 0 {
		timeout = defaultWebFetchTimeoutSeconds
	}
	if timeout > maxWebFetchTimeoutSeconds {
		timeout = maxWebFetchTimeoutSeconds
	}
	format := strings.ToLower(strings.TrimSpace(options.Format))
	if format == "" {
		format = "markdown"
	}
	if format != "markdown" && format != "text" && format != "html" {
		return WebFetchResult{}, errors.New("format must be markdown, text, or html")
	}
	maxChars := options.MaxChars
	if maxChars <= 0 || maxChars > maxWebFetchChars {
		maxChars = maxWebFetchChars
	}

	var resp *http.Response
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		req, requestErr := http.NewRequest(http.MethodGet, rawURL, nil)
		if requestErr != nil {
			return WebFetchResult{}, requestErr
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/143.0 Safari/537.36")
		req.Header.Set("Accept", acceptWebFetch(format))
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		client, clientErr := newWebFetchClient(time.Duration(timeout)*time.Second, options.ProxyURL,
			func(redirectReq *http.Request, via []*http.Request) error {
				if len(via) >= maxWebFetchRedirects {
					return fmt.Errorf("redirect limit exceeded (%d)", maxWebFetchRedirects)
				}
				if redirectReq.URL.Scheme != "http" && redirectReq.URL.Scheme != "https" {
					return fmt.Errorf("redirected to unsupported protocol: %s", redirectReq.URL.Scheme)
				}
				if err := CheckHostSSRF(redirectReq.URL.Hostname()); err != nil {
					return fmt.Errorf("redirect blocked by SSRF policy: %w", err)
				}
				return nil
			})
		if clientErr != nil {
			return WebFetchResult{}, clientErr
		}
		resp, lastErr = client.Do(req)
		if lastErr == nil && resp.StatusCode == http.StatusForbidden && resp.Header.Get("cf-mitigated") == "challenge" && attempt == 0 {
			resp.Body.Close()
			continue
		}
		break
	}
	if lastErr != nil {
		return WebFetchResult{}, errors.New("fetch failed: " + lastErr.Error())
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return WebFetchResult{}, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	contentType := strings.ToLower(strings.SplitN(resp.Header.Get("Content-Type"), ";", 2)[0])
	if !isTextWebFetchContentType(contentType) {
		return WebFetchResult{}, fmt.Errorf("unsupported fetched content type: %s", contentType)
	}
	if resp.ContentLength > maxWebFetchBytes {
		return WebFetchResult{}, errors.New("response too large")
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxWebFetchBytes+1))
	if err != nil {
		return WebFetchResult{}, errors.New("read body failed: " + err.Error())
	}
	if int64(len(body)) > maxWebFetchBytes {
		return WebFetchResult{}, errors.New("response too large")
	}

	htmlStr := string(body)
	result := htmlStr
	if contentType == "text/html" || contentType == "application/xhtml+xml" {
		if format == "text" {
			result, err = safeHTML2Text(NewLute(), htmlStr)
		} else if format == "markdown" {
			result, err = safeHTML2Markdown(NewLute(), htmlStr)
		}
		if err != nil {
			return WebFetchResult{}, errors.New("HTML conversion failed: " + err.Error())
		}
	}
	if strings.TrimSpace(result) == "" {
		return WebFetchResult{}, errors.New("fetched page has empty text content")
	}
	truncated := len([]rune(result)) > maxChars
	if truncated {
		result = truncateRunes(result, maxChars)
	}
	return WebFetchResult{URL: rawURL, ContentType: contentType, Format: format, Output: result, Truncated: truncated}, nil
}

func newWebFetchClient(timeout time.Duration, proxyURL string, checkRedirect func(*http.Request, []*http.Request) error) (*http.Client, error) {
	transport, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return nil, fmt.Errorf("unexpected default HTTP transport type %T", http.DefaultTransport)
	}
	transport = transport.Clone()
	transport.Proxy = nil
	if strings.TrimSpace(proxyURL) != "" {
		parsedProxy, err := url.Parse(proxyURL)
		if err != nil || parsedProxy.Scheme == "" || parsedProxy.Host == "" {
			if err == nil {
				err = errors.New("proxy URL must include a scheme and host")
			}
			return nil, fmt.Errorf("invalid web fetch proxy URL: %w", err)
		}
		transport.Proxy = http.ProxyURL(parsedProxy)
	}
	return &http.Client{Timeout: timeout, Transport: transport, CheckRedirect: checkRedirect}, nil
}

func acceptWebFetch(format string) string {
	switch format {
	case "html":
		return "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1"
	case "text":
		return "text/plain,text/markdown,text/html;q=0.8,*/*;q=0.1"
	default:
		return "text/markdown,text/plain,text/html;q=0.8,*/*;q=0.1"
	}
}

func isTextWebFetchContentType(contentType string) bool {
	return contentType == "" || strings.HasPrefix(contentType, "text/") ||
		contentType == "application/json" || strings.HasSuffix(contentType, "+json") ||
		contentType == "application/xml" || strings.HasSuffix(contentType, "+xml") ||
		contentType == "application/javascript" || contentType == "application/x-javascript"
}

func safeHTML2Markdown(engine *lute.Lute, htmlStr string) (result string, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("HTML to Markdown panicked: %v", r)
		}
	}()
	result, err = engine.HTML2Markdown(htmlStr)
	return
}

func safeHTML2Text(engine *lute.Lute, htmlStr string) (result string, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("HTML to text panicked: %v", r)
		}
	}()
	result = engine.HTML2Text(htmlStr)
	return
}

func truncateRunes(s string, maxChars int) string {
	runes := []rune(s)
	if len(runes) <= maxChars {
		return s
	}
	return string(runes[:maxChars]) + "\n\n...content truncated, total length " + fmt.Sprintf("%d", len(runes)) + " characters..."
}

func extractFilename(rawURL, contentType string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return gulu.Rand.String(7) + extByContentType(contentType)
	}
	name := path.Base(u.Path)
	if name == "" || name == "." || name == "/" {
		name = gulu.Rand.String(7) + extByContentType(contentType)
	}
	if filepath.Ext(name) == "" {
		name += extByContentType(contentType)
	}
	return name
}

func extByContentType(contentType string) string {
	ct := strings.SplitN(contentType, ";", 2)[0]
	if exts, _ := mime.ExtensionsByType(ct); len(exts) > 0 {
		return exts[0]
	}
	return ".bin"
}
