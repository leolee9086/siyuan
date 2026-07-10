package websearch

import (
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HTTPClient 封装 HTTP 请求，支持超时和代理
type HTTPClient struct {
	client  *http.Client
	headers map[string]string
}

// NewHTTPClient 创建 HTTP 客户端
func NewHTTPClient(timeout time.Duration) *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout:   timeout,
			Transport: &http.Transport{},
		},
		headers: make(map[string]string),
	}
}

// SetHeader 设置默认请求头
func (c *HTTPClient) SetHeader(key, value string) {
	c.headers[key] = value
}

// Get 执行 GET 请求
func (c *HTTPClient) Get(urlStr string, extraHeaders map[string]string) (int, string, error) {
	req, err := http.NewRequest("GET", urlStr, nil)
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
	resp, err := c.client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(body), nil
}

// PostForm 执行 POST 表单请求
func (c *HTTPClient) PostForm(urlStr string, formData map[string]string, extraHeaders map[string]string) (int, string, error) {
	vals := url.Values{}
	for k, v := range formData {
		vals.Set(k, v)
	}
	req, err := http.NewRequest("POST", urlStr, strings.NewReader(vals.Encode()))
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
	resp, err := c.client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(body), nil
}

// PostJSON 执行 POST JSON 请求
func (c *HTTPClient) PostJSON(urlStr string, jsonBody string, extraHeaders map[string]string) (int, string, error) {
	req, err := http.NewRequest("POST", urlStr, strings.NewReader(jsonBody))
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
	resp, err := c.client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(body), nil
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
