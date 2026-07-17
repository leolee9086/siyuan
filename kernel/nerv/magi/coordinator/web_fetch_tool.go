package coordinator

import (
	"context"
	"encoding/json"
	"fmt"
	stdhtml "html"
	"io"
	"math/rand"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode"

	"golang.org/x/net/html"
	"golang.org/x/net/html/charset"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const (
	defaultFetchWebPageTimeout   = 15
	minFetchWebPageTimeout       = 5
	maxFetchWebPageTimeout       = 60
	defaultFetchWebPageMaxLength = 100000
	fetchWebPageUserAgent        = "MAGI/1.0"
	fetchWebPageRawDir           = "raw"
	fetchWebPageMaxRetries       = 2
	fetchWebPageMaxRedirects     = 10
)

type fetchWebPageToolArgs struct {
	URL     string `json:"url"`
	Timeout int    `json:"timeout,omitempty"`
	Format  string `json:"format,omitempty"`
}

type fetchWebPageResultPayload struct {
	OK          bool   `json:"ok"`
	URL         string `json:"url"`
	FilePath    string `json:"filePath"`
	Title       string `json:"title,omitempty"`
	CharCount   int    `json:"charCount"`
	Format      string `json:"format,omitempty"`
	ContentType string `json:"contentType,omitempty"`
	Truncated   bool   `json:"truncated,omitempty"`
	Error       string `json:"error,omitempty"`
	ErrorCode   string `json:"errorCode,omitempty"`
	ReadHint    string `json:"readHint"`
}

type webFetchToolResultExecutor struct{}

func newWebFetchToolResultExecutor() *webFetchToolResultExecutor {
	return &webFetchToolResultExecutor{}
}

func (e *webFetchToolResultExecutor) ExecuteToolCall(toolCall types.ToolCall) (result string, handled bool, err error) {
	if strings.TrimSpace(toolCall.Function.Name) != config.FetchWebPageToolName {
		return "", false, nil
	}

	rawArgs := strings.TrimSpace(toolCall.Function.Arguments)
	if rawArgs == "" {
		return "", true, fmt.Errorf("%s 参数不能为空", config.FetchWebPageToolName)
	}

	var args fetchWebPageToolArgs
	if err := json.Unmarshal([]byte(rawArgs), &args); err != nil {
		return "", true, fmt.Errorf("%s 参数解析失败: %w", config.FetchWebPageToolName, err)
	}

	args.URL = strings.TrimSpace(args.URL)
	if args.URL == "" {
		return "", true, fmt.Errorf("%s 的 url 不能为空", config.FetchWebPageToolName)
	}

	result, err = executeWebFetch(args)
	if err != nil {
		return "", true, err
	}
	return result, true, nil
}

func executeWebFetch(args fetchWebPageToolArgs) (string, error) {
	_, parseErr := url.ParseRequestURI(args.URL)
	if parseErr != nil {
		return marshalWebFetchFailure("INVALID_URL", fmt.Errorf("无效的 URL %q: %w", args.URL, parseErr)), nil
	}
	parsedURL, _ := url.Parse(args.URL)
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return marshalWebFetchFailure("UNSUPPORTED_PROTOCOL",
			fmt.Errorf("不支持的协议 %q，仅支持 http/https", parsedURL.Scheme)), nil
	}
	proxyURL := ""
	if model.Conf != nil {
		proxyURL = conf.EffectiveProxyURL(model.Conf.System)
	}
	result, fetchErr := util.FetchWebPage(args.URL, util.WebFetchOptions{
		Format: normalizeFetchWebPageFormat(args.Format), TimeoutSeconds: normalizeFetchWebPageTimeout(args.Timeout), ProxyURL: proxyURL,
	})
	if fetchErr != nil {
		return marshalWebFetchFailure("NETWORK_ERROR", fetchErr), nil
	}

	savePath, saveErr := saveFetchWebPageResult(args.URL, "", result.Output)
	if saveErr != nil {
		logging.LogWarnf("%s 保存结果失败 [%s]: %v", config.FetchWebPageToolName, args.URL, saveErr)
		return marshalWebFetchFailure("SAVE_FAILED", fmt.Errorf("保存结果失败: %w", saveErr)), nil
	}

	payload := fetchWebPageResultPayload{
		OK:          true,
		URL:         args.URL,
		FilePath:    savePath,
		CharCount:   len([]rune(result.Output)),
		Format:      result.Format,
		ContentType: result.ContentType,
		Truncated:   result.Truncated,
		ReadHint:    fmt.Sprintf("内容已保存至 %s，请前往该路径阅读完整内容。", savePath),
	}

	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return "", fmt.Errorf("%s 结果序列化失败: %w", config.FetchWebPageToolName, marshalErr)
	}
	return string(resultBytes), nil
}

func normalizeFetchWebPageFormat(format string) string {
	switch strings.ToLower(strings.TrimSpace(format)) {
	case "text", "html":
		return strings.ToLower(strings.TrimSpace(format))
	default:
		return "markdown"
	}
}

func normalizeFetchWebPageTimeout(timeout int) int {
	if timeout <= 0 {
		return defaultFetchWebPageTimeout
	}
	if timeout < minFetchWebPageTimeout {
		return minFetchWebPageTimeout
	}
	if timeout > maxFetchWebPageTimeout {
		return maxFetchWebPageTimeout
	}
	return timeout
}

func fetchFetchWebPageWithRetry(rawURL string, timeout int) (body []byte, contentType string, err error) {
	client := &http.Client{
		Timeout: time.Duration(timeout) * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= fetchWebPageMaxRedirects {
				return fmt.Errorf("重定向次数超过限制 (%d)", fetchWebPageMaxRedirects)
			}
			return nil
		},
	}

	var lastErr error
	for attempt := 0; attempt <= fetchWebPageMaxRetries; attempt++ {
		body, contentType, err = fetchFetchWebPageOnce(client, rawURL, timeout)
		if err == nil {
			return body, contentType, nil
		}
		lastErr = err

		if !isFetchWebPageRetryable(err) {
			break
		}

		if attempt < fetchWebPageMaxRetries {
			backoff := time.Duration(1<<attempt)*time.Second + time.Duration(rand.Intn(2000))*time.Millisecond
			time.Sleep(backoff)
		}
	}
	return nil, "", lastErr
}

func fetchFetchWebPageOnce(client *http.Client, rawURL string, timeout int) ([]byte, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", fetchWebPageUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return nil, "", fmt.Errorf("HTTP %d %s", resp.StatusCode, resp.Status)
	}

	contentType := resp.Header.Get("Content-Type")
	utf8Reader, decodeErr := charset.NewReader(resp.Body, contentType)
	if decodeErr != nil {
		return nil, "", fmt.Errorf("编码解码失败: %w", decodeErr)
	}

	limitedBody := io.LimitReader(utf8Reader, int64(defaultFetchWebPageMaxLength)+1)
	rawBytes, readErr := io.ReadAll(limitedBody)
	if readErr != nil {
		return nil, "", fmt.Errorf("读取响应体失败: %w", readErr)
	}

	return rawBytes, contentType, nil
}

func isFetchWebPageRetryable(err error) bool {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "timeout"),
		strings.Contains(msg, "Timeout"),
		strings.Contains(msg, "connection reset"),
		strings.Contains(msg, "connection refused"),
		strings.Contains(msg, "Connection refused"),
		strings.Contains(msg, "no such host"),
		strings.Contains(msg, "EOF"),
		strings.Contains(msg, "HTTP 5"),
		strings.Contains(msg, "HTTP 429"),
		strings.Contains(msg, "HTTP 503"),
		strings.Contains(msg, "HTTP 502"):
		return true
	default:
		return false
	}
}

func isFetchWebPageAcceptableContentType(contentType string) bool {
	base := strings.ToLower(strings.SplitN(contentType, ";", 2)[0])
	base = strings.TrimSpace(base)
	switch base {
	case "text/html", "application/xhtml+xml", "application/xml", "text/plain", "text/markdown":
		return true
	default:
		return strings.HasPrefix(base, "text/")
	}
}

// --- HTML to Markdown cleaning ---

var fetchWebPageBlockTags = map[string]bool{
	"p": true, "div": true, "tr": true, "th": true, "td": true,
	"section": true, "article": true, "table": true,
	"dl": true, "dd": true, "dt": true, "figure": true,
	"figcaption": true, "details": true, "summary": true,
}

var fetchWebPageSkipTags = map[string]bool{
	"script": true, "style": true, "noscript": true, "nav": true,
	"footer": true, "header": true, "svg": true, "form": true,
	"select": true, "textarea": true, "option": true, "canvas": true,
	"iframe": true, "embed": true, "object": true, "video": true,
	"audio": true,
}

func extractFetchWebPageText(rawHTML []byte, pageURL *url.URL) (textContent string, title string) {
	doc, err := html.Parse(strings.NewReader(string(rawHTML)))
	if err != nil {
		fallback := stdhtml.UnescapeString(string(rawHTML))
		fallback = stripFetchWebPageHTMLTags(fallback)
		return strings.TrimSpace(fallback), ""
	}

	title = extractFetchWebPageTitle(doc)
	textContent = extractFetchWebPageNodeText(doc, pageURL)
	textContent = normalizeFetchWebPageMarkdown(textContent)
	return strings.TrimSpace(textContent), strings.TrimSpace(title)
}

func extractFetchWebPageTitle(n *html.Node) string {
	if n.Type == html.ElementNode && n.Data == "title" {
		if n.FirstChild != nil {
			return n.FirstChild.Data
		}
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if title := extractFetchWebPageTitle(c); title != "" {
			return title
		}
	}
	return ""
}

func extractFetchWebPageNodeText(n *html.Node, pageURL *url.URL) string {
	if n.Type == html.ElementNode {
		tag := n.Data
		if fetchWebPageSkipTags[tag] {
			return ""
		}
		switch tag {
		case "a":
			return extractFetchWebPageLink(n, pageURL)
		case "img":
			return extractFetchWebPageImage(n, pageURL)
		case "br":
			return "\n"
		case "hr":
			return "\n---\n"
		case "h1", "h2", "h3", "h4", "h5", "h6":
			return extractFetchWebPageHeading(n, pageURL)
		case "ul":
			return extractFetchWebPageList(n, pageURL, "- ")
		case "ol":
			return extractFetchWebPageList(n, pageURL, "1. ")
		case "li":
			return extractFetchWebPageListItem(n, pageURL)
		case "blockquote":
			return extractFetchWebPageBlockquote(n, pageURL)
		case "pre":
			return extractFetchWebPageCodeBlock(n)
		case "code":
			return extractFetchWebPageInlineCode(n)
		}
	}

	var buf strings.Builder
	if n.Type == html.TextNode {
		buf.WriteString(collapseFetchWebPageInlineWhitespace(n.Data))
	}
	if n.Type == html.ElementNode && fetchWebPageBlockTags[n.Data] {
		defer buf.WriteString("\n")
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		buf.WriteString(extractFetchWebPageNodeText(c, pageURL))
	}

	return buf.String()
}

func extractFetchWebPageHeading(n *html.Node, pageURL *url.URL) string {
	level := int(n.Data[1] - '0')
	if level < 1 || level > 6 {
		level = 1
	}
	var buf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		buf.WriteString(extractFetchWebPageNodeText(c, pageURL))
	}
	text := strings.TrimSpace(buf.String())
	if text == "" {
		return ""
	}
	return "\n" + strings.Repeat("#", level) + " " + text + "\n"
}

func extractFetchWebPageLink(n *html.Node, pageURL *url.URL) string {
	href := getFetchWebPageAttr(n, "href")
	href = strings.TrimSpace(href)
	if href == "" || strings.HasPrefix(href, "#") || strings.HasPrefix(href, "javascript:") {
		var buf strings.Builder
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			buf.WriteString(extractFetchWebPageNodeText(c, pageURL))
		}
		return buf.String()
	}

	resolved := resolveFetchWebPageURL(pageURL, href)
	if resolved == "" {
		resolved = href
	}

	var textBuf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		textBuf.WriteString(extractFetchWebPageNodeText(c, pageURL))
	}
	text := strings.TrimSpace(textBuf.String())
	if text == "" {
		return ""
	}
	return "[" + text + "](" + resolved + ")"
}

func extractFetchWebPageImage(n *html.Node, pageURL *url.URL) string {
	alt := getFetchWebPageAttr(n, "alt")
	src := getFetchWebPageAttr(n, "src")
	alt = strings.TrimSpace(alt)
	src = strings.TrimSpace(src)
	if src == "" {
		return ""
	}
	resolved := resolveFetchWebPageURL(pageURL, src)
	if resolved == "" {
		resolved = src
	}
	return "![" + alt + "](" + resolved + ")"
}

func resolveFetchWebPageURL(base *url.URL, raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.IsAbs() {
		return raw
	}
	if base == nil {
		return ""
	}
	return base.ResolveReference(parsed).String()
}

func extractFetchWebPageList(n *html.Node, pageURL *url.URL, marker string) string {
	var buf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		item := extractFetchWebPageNodeText(c, pageURL)
		if strings.TrimSpace(item) == "" {
			continue
		}
		buf.WriteString("\n" + marker + item)
	}
	trimmed := strings.TrimSpace(buf.String())
	if trimmed == "" {
		return ""
	}
	return "\n" + trimmed + "\n"
}

func extractFetchWebPageListItem(n *html.Node, pageURL *url.URL) string {
	var buf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		buf.WriteString(extractFetchWebPageNodeText(c, pageURL))
	}
	return strings.TrimSpace(buf.String())
}

func extractFetchWebPageBlockquote(n *html.Node, pageURL *url.URL) string {
	var buf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		buf.WriteString(extractFetchWebPageNodeText(c, pageURL))
	}
	text := strings.TrimSpace(buf.String())
	if text == "" {
		return ""
	}
	return "\n> " + strings.ReplaceAll(text, "\n", "\n> ") + "\n"
}

func extractFetchWebPageCodeBlock(n *html.Node) string {
	var buf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		collectFetchWebPageRawText(c, &buf)
	}
	code := strings.TrimSpace(buf.String())
	if code == "" {
		return ""
	}
	return "\n```\n" + code + "\n```\n"
}

func extractFetchWebPageInlineCode(n *html.Node) string {
	var buf strings.Builder
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		collectFetchWebPageRawText(c, &buf)
	}
	text := strings.TrimSpace(buf.String())
	if text == "" {
		return ""
	}
	return "`" + text + "`"
}

func collectFetchWebPageRawText(n *html.Node, buf *strings.Builder) {
	if n.Type == html.TextNode {
		buf.WriteString(n.Data)
	}
	if n.Type == html.ElementNode && fetchWebPageSkipTags[n.Data] {
		return
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		collectFetchWebPageRawText(c, buf)
	}
}

func getFetchWebPageAttr(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

func collapseFetchWebPageInlineWhitespace(text string) string {
	var buf strings.Builder
	space := false
	for _, r := range text {
		if unicode.IsSpace(r) {
			if !space {
				buf.WriteRune(' ')
				space = true
			}
		} else {
			buf.WriteRune(r)
			space = false
		}
	}
	return buf.String()
}

func normalizeFetchWebPageMarkdown(text string) string {
	result := text
	for strings.Contains(result, "\n\n\n") {
		result = strings.ReplaceAll(result, "\n\n\n", "\n\n")
	}
	return strings.TrimSpace(result)
}

func stripFetchWebPageHTMLTags(raw string) string {
	var buf strings.Builder
	inTag := false
	for _, r := range raw {
		if r == '<' {
			inTag = true
			continue
		}
		if r == '>' {
			inTag = false
			buf.WriteString(" ")
			continue
		}
		if !inTag {
			buf.WriteRune(r)
		}
	}
	return buf.String()
}

func saveFetchWebPageResult(rawURL, title, content string) (string, error) {
	rawDir := filepath.Join(util.TempDir, fetchWebPageRawDir)
	if mkErr := os.MkdirAll(rawDir, 0755); mkErr != nil {
		return "", fmt.Errorf("创建 raw 目录失败: %w", mkErr)
	}

	parsed, _ := url.Parse(rawURL)
	host := strings.TrimSpace(parsed.Host)
	path := strings.TrimSpace(parsed.Path)
	if path == "" || path == "/" {
		path = "_index"
	}
	path = strings.TrimSuffix(path, "/")
	path = strings.ReplaceAll(path, "/", "_")
	path = strings.ReplaceAll(path, ".", "_")

	fileName := sanitizeFetchWebPageFileName(host + "_" + path + ".md")
	if len(fileName) > 200 {
		fileName = fileName[:200]
	}

	savePath := filepath.Join(rawDir, fileName)

	var builder strings.Builder
	if title != "" {
		builder.WriteString("# ")
		builder.WriteString(title)
		builder.WriteString("\n\n")
	}
	builder.WriteString("> ")
	builder.WriteString(rawURL)
	builder.WriteString("\n\n")
	builder.WriteString(content)

	writeErr := os.WriteFile(savePath, []byte(builder.String()), 0644)
	if writeErr != nil {
		return "", fmt.Errorf("写入文件失败: %w", writeErr)
	}

	return savePath, nil
}

func sanitizeFetchWebPageFileName(name string) string {
	var buf strings.Builder
	for _, r := range name {
		if r > 127 {
			continue
		}
		switch {
		case r >= 'a' && r <= 'z':
			buf.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			buf.WriteRune(r)
		case r >= '0' && r <= '9':
			buf.WriteRune(r)
		case r == '_' || r == '-' || r == '.':
			buf.WriteRune(r)
		default:
			buf.WriteRune('_')
		}
	}
	return buf.String()
}

func marshalWebFetchFailure(code string, err error) string {
	payload := fetchWebPageResultPayload{
		OK:        false,
		ErrorCode: code,
		Error:     err.Error(),
	}
	resultBytes, marshalErr := json.Marshal(payload)
	if marshalErr != nil {
		return fmt.Sprintf(`{"ok":false,"errorCode":"%s","error":"%s"}`, code, err.Error())
	}
	return string(resultBytes)
}
