package websearch

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	fhttp "github.com/bogdanfinn/fhttp"
	tlsclient "github.com/bogdanfinn/tls-client"
	"github.com/bogdanfinn/tls-client/profiles"
)

// HTTPClient 封装 HTTP 请求，支持超时和代理
type HTTPClient struct {
	client        *http.Client
	browserClient map[string]tlsclient.HttpClient
	headers       map[string]string
	proxy         *ProxyConfig
	noProxy       string
	timeout       time.Duration
	baseURL       string
	setupErr      error
}

// NewHTTPClient 创建 HTTP 客户端
// 代理必须通过 UseProxy 显式传入；未配置时使用直连。
func NewHTTPClient(timeout time.Duration) *HTTPClient {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	return &HTTPClient{
		client:        &http.Client{Transport: transport},
		browserClient: make(map[string]tlsclient.HttpClient),
		headers:       make(map[string]string),
		timeout:       timeout,
	}
}

func newBrowserClient(timeout time.Duration, proxyURL string) (tlsclient.HttpClient, error) {
	milliseconds := int(timeout / time.Millisecond)
	if milliseconds <= 0 {
		milliseconds = 30000
	}
	options := []tlsclient.HttpClientOption{
		tlsclient.WithTimeoutMilliseconds(milliseconds),
		tlsclient.WithClientProfile(profiles.Chrome_133),
		tlsclient.WithRandomTLSExtensionOrder(),
		// Some protected endpoints accept the Chrome HTTP/1.1 fingerprint but
		// leave the HTTP/2 connection idle indefinitely (Pinterest is one).
		tlsclient.WithForceHttp1(),
	}
	if strings.TrimSpace(proxyURL) != "" {
		options = append(options, tlsclient.WithProxyUrl(proxyURL))
	}
	return tlsclient.NewHttpClient(tlsclient.NewNoopLogger(), options...)
}

func copyHeaders(source http.Header) fhttp.Header {
	target := make(fhttp.Header, len(source))
	for key, values := range source {
		target[key] = append([]string(nil), values...)
	}
	return target
}

func toFingerprintRequest(req *http.Request) (*fhttp.Request, error) {
	converted, err := fhttp.NewRequest(req.Method, req.URL.String(), req.Body)
	if err != nil {
		return nil, err
	}
	converted = converted.WithContext(req.Context())
	converted.Header = copyHeaders(req.Header)
	converted.Host = req.Host
	converted.ContentLength = req.ContentLength
	return converted, nil
}

func fromFingerprintResponse(resp *fhttp.Response, request *http.Request) *http.Response {
	header := make(http.Header, len(resp.Header))
	for key, values := range resp.Header {
		header[key] = append([]string(nil), values...)
	}
	trailer := make(http.Header, len(resp.Trailer))
	for key, values := range resp.Trailer {
		trailer[key] = append([]string(nil), values...)
	}
	return &http.Response{
		Status:           resp.Status,
		StatusCode:       resp.StatusCode,
		Proto:            resp.Proto,
		ProtoMajor:       resp.ProtoMajor,
		ProtoMinor:       resp.ProtoMinor,
		Header:           header,
		Body:             resp.Body,
		ContentLength:    resp.ContentLength,
		TransferEncoding: append([]string(nil), resp.TransferEncoding...),
		Close:            resp.Close,
		Uncompressed:     resp.Uncompressed,
		Trailer:          trailer,
		Request:          request,
	}
}

// NewEngineHTTPClient applies the configured engine timeout and proxy without
// consulting search API-key environment variables.
func NewEngineHTTPClient(config EngineConfig) *HTTPClient {
	client := NewHTTPClient(time.Duration(config.Timeout) * time.Millisecond)
	client.baseURL = strings.TrimSpace(config.BaseURL)
	for key, value := range config.Headers {
		client.SetHeader(key, value)
	}
	if config.Proxy.HTTP != "" || config.Proxy.HTTPS != "" || config.Proxy.AutoDetect {
		if err := client.UseProxy(config.Proxy); err != nil {
			client.setupErr = err
		}
	}
	return client
}

// UseProxy 为客户端配置代理
// 代理端点必须由调用方显式传入；websearch 不读取环境变量或探测本地端口。
func (c *HTTPClient) UseProxy(config ProxyConfig) error {
	if config.AutoDetect {
		return errors.New("proxy endpoint must be provided explicitly; automatic proxy detection is disabled")
	}

	browserClients := make(map[string]tlsclient.HttpClient)
	for _, scheme := range []string{"http", "https"} {
		proxyURL := config.HTTP
		if scheme == "https" && config.HTTPS != "" {
			proxyURL = config.HTTPS
		}
		if strings.TrimSpace(proxyURL) == "" {
			continue
		}
		parsed, err := url.Parse(proxyURL)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" {
			if err == nil {
				err = errors.New("proxy URL must include a scheme and host")
			}
			return fmt.Errorf("invalid %s proxy URL: %w", scheme, err)
		}
		browserClient, err := newBrowserClient(c.timeout, proxyURL)
		if err != nil {
			return fmt.Errorf("create %s proxy client: %w", scheme, err)
		}
		browserClients[scheme] = browserClient
	}

	c.browserClient = browserClients
	c.noProxy = config.NoProxy
	c.proxy = nil
	if config.HTTP != "" || config.HTTPS != "" {
		copy := config
		c.proxy = &copy
	}
	c.setupErr = nil
	if transport, ok := c.client.Transport.(*http.Transport); ok {
		transport.Proxy = nil
	}
	return nil
}

// SetHeader 设置默认请求头
func (c *HTTPClient) SetHeader(key, value string) {
	c.headers[key] = value
}

// Get 执行 GET 请求
func (c *HTTPClient) Get(urlStr string, extraHeaders map[string]string) (int, string, error) {
	resolvedURL, err := c.resolveURL(urlStr)
	if err != nil {
		return 0, "", err
	}
	req, err := http.NewRequest("GET", resolvedURL, nil)
	if err != nil {
		return 0, "", err
	}
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", RandomUserAgent())
	}
	return c.do(req)
}

// PostForm 执行 POST 表单请求
func (c *HTTPClient) PostForm(urlStr string, formData map[string]string, extraHeaders map[string]string) (int, string, error) {
	vals := url.Values{}
	for k, v := range formData {
		vals.Set(k, v)
	}
	resolvedURL, err := c.resolveURL(urlStr)
	if err != nil {
		return 0, "", err
	}
	req, err := http.NewRequest("POST", resolvedURL, strings.NewReader(vals.Encode()))
	if err != nil {
		return 0, "", err
	}
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", RandomUserAgent())
	}
	return c.do(req)
}

// PostJSON 执行 POST JSON 请求
func (c *HTTPClient) PostJSON(urlStr string, jsonBody string, extraHeaders map[string]string) (int, string, error) {
	resolvedURL, err := c.resolveURL(urlStr)
	if err != nil {
		return 0, "", err
	}
	req, err := http.NewRequest("POST", resolvedURL, strings.NewReader(jsonBody))
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	for k, v := range extraHeaders {
		req.Header.Set(k, v)
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", RandomUserAgent())
	}
	return c.do(req)
}

// resolveURL applies a configured API root while preserving the adapter's
// endpoint path and query parameters. This keeps per-engine endpoints
// configurable without requiring every adapter to duplicate URL plumbing.
func (c *HTTPClient) resolveURL(rawURL string) (string, error) {
	if strings.TrimSpace(c.baseURL) == "" {
		return rawURL, nil
	}
	base, err := url.Parse(c.baseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		if err == nil {
			err = errors.New("base URL must include a scheme and host")
		}
		return "", err
	}
	target, err := url.Parse(rawURL)
	if err != nil {
		return "", err
	}
	if target.Path == "" {
		target.Path = "/"
	}
	base.Path = strings.TrimRight(base.Path, "/") + "/" + strings.TrimLeft(target.Path, "/")
	base.RawPath = ""
	base.RawQuery = target.RawQuery
	base.Fragment = target.Fragment
	return base.String(), nil
}

func (c *HTTPClient) do(req *http.Request) (int, string, error) {
	if c.setupErr != nil {
		return 0, "", c.setupErr
	}
	ctx := req.Context()
	cancel := func() {}
	if c.timeout > 0 {
		ctx, cancel = context.WithTimeout(ctx, c.timeout)
	}
	defer cancel()

	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		attemptReq := req.Clone(ctx)
		if req.GetBody != nil {
			body, err := req.GetBody()
			if err != nil {
				return 0, "", err
			}
			attemptReq.Body = body
		}
		resp, err := c.doRequest(attemptReq)
		if err == nil {
			body, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr == nil {
				if attempt == 0 && (resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= http.StatusInternalServerError) {
					timer := time.NewTimer(150 * time.Millisecond)
					select {
					case <-timer.C:
					case <-ctx.Done():
						timer.Stop()
						return 0, "", ctx.Err()
					}
					continue
				}
				return resp.StatusCode, string(body), nil
			}
			err = readErr
		}
		lastErr = err
		if attempt > 0 || !isRetryableHTTPError(err) || ctx.Err() != nil {
			break
		}
		timer := time.NewTimer(100 * time.Millisecond)
		select {
		case <-timer.C:
		case <-ctx.Done():
			timer.Stop()
			return 0, "", ctx.Err()
		}
	}
	return 0, "", lastErr
}

func (c *HTTPClient) doRequest(req *http.Request) (*http.Response, error) {
	if req.URL != nil && !proxyBypassed(req.URL.Hostname(), c.noProxy) {
		if browserClient := c.browserClient[req.URL.Scheme]; browserClient != nil {
			converted, err := toFingerprintRequest(req)
			if err != nil {
				return nil, err
			}
			response, err := browserClient.Do(converted)
			if err != nil {
				return nil, err
			}
			return fromFingerprintResponse(response, req), nil
		}
	}
	return c.client.Do(req)
}

func proxyBypassed(host, noProxy string) bool {
	for _, item := range strings.Split(noProxy, ",") {
		item = strings.TrimSpace(item)
		if item == "" {
			continue
		}
		item = strings.TrimPrefix(item, "*")
		if item == host || (strings.HasPrefix(item, ".") && strings.HasSuffix(host, item)) {
			return true
		}
	}
	return false
}

func isRetryableHTTPError(err error) bool {
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && (netErr.Timeout() || netErr.Temporary())
}

// SetProxy 设置代理
func (c *HTTPClient) SetProxy(proxyURL string) error {
	return c.UseProxy(NewExplicitProxy(proxyURL, proxyURL))
}
