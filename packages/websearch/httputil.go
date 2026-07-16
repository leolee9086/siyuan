package websearch

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HTTPClient 封装 HTTP 请求，支持超时和代理
type HTTPClient struct {
	client  *http.Client
	headers map[string]string
	proxy   *ProxyConfig // 当前代理配置
	timeout time.Duration
	baseURL string
}

// NewHTTPClient 创建 HTTP 客户端
// 代理优先级：UseProxy() > HTTP_PROXY 环境变量 > 直连
func NewHTTPClient(timeout time.Duration) *HTTPClient {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = http.ProxyFromEnvironment
	return &HTTPClient{
		client:  &http.Client{Transport: transport},
		headers: make(map[string]string),
		timeout: timeout,
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
		_ = client.UseProxy(config.Proxy)
	}
	return client
}

// UseProxy 为客户端配置代理
// 优先级：显式 URL > AutoDetect > 无代理
// 同时设置显式 URL 和 AutoDetect 时，显式 URL 优先
func (c *HTTPClient) UseProxy(config ProxyConfig) error {
	if config.HTTP != "" || config.HTTPS != "" {
		c.proxy = &config
		return c.applyProxyURL(config.HTTP)
	}
	if config.AutoDetect {
		detected := ProbeCommonProxy()
		if detected != nil {
			c.proxy = detected
			return c.applyProxyURL(detected.HTTP)
		}
	}
	c.proxy = nil
	return nil
}

func (c *HTTPClient) applyProxyURL(proxyURL string) error {
	if proxyURL == "" {
		return nil
	}
	parsed, err := url.Parse(proxyURL)
	if err != nil {
		return err
	}
	if t, ok := c.client.Transport.(*http.Transport); ok {
		t.Proxy = http.ProxyURL(parsed)
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
		resp, err := c.client.Do(attemptReq)
		if err == nil {
			body, readErr := io.ReadAll(resp.Body)
			resp.Body.Close()
			if readErr == nil {
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

func isRetryableHTTPError(err error) bool {
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	var netErr net.Error
	return errors.As(err, &netErr) && (netErr.Timeout() || netErr.Temporary())
}

// SetProxy 设置代理
func (c *HTTPClient) SetProxy(proxyURL string) error {
	proxyParsed, err := url.Parse(proxyURL)
	if err != nil {
		return err
	}
	if transport, ok := c.client.Transport.(*http.Transport); ok {
		transport.Proxy = http.ProxyURL(proxyParsed)
	}
	return nil
}
