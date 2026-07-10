package websearch

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	ExaURL      = "https://mcp.exa.ai/mcp"
	ParallelURL = "https://search.parallel.ai/mcp"
)

// MCPSearchArgs Exa 搜索参数
type MCPSearchArgs struct {
	Query                string `json:"query"`
	Type                 string `json:"type"`
	NumResults           int    `json:"numResults"`
	Livecrawl            string `json:"livecrawl"`
	ContextMaxCharacters *int   `json:"contextMaxCharacters,omitempty"`
}

// MCPParallelArgs Parallel 搜索参数
type MCPParallelArgs struct {
	Objective     string   `json:"objective"`
	SearchQueries []string `json:"search_queries"`
	SessionID     string   `json:"session_id,omitempty"`
	ModelName     string   `json:"model_name,omitempty"`
}

type mcpRequest struct {
	JSONRPC string    `json:"jsonrpc"`
	ID      int       `json:"id"`
	Method  string    `json:"method"`
	Params  mcpParams `json:"params"`
}

type mcpParams struct {
	Name      string      `json:"name"`
	Arguments interface{} `json:"arguments"`
}

type mcpResponse struct {
	Result *mcpResult `json:"result,omitempty"`
}

type mcpResult struct {
	Content []mcpContent `json:"content"`
}

type mcpContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// CallExa 调用 Exa MCP 搜索
func CallExa(query string, searchType string, numResults int, livecrawl string, contextMaxChars *int, apiKey string) (string, error) {
	url := ExaURL
	if apiKey != "" {
		url += "?exaApiKey=" + strings.TrimSpace(apiKey)
	}
	args := MCPSearchArgs{
		Query:      query,
		Type:       searchType,
		NumResults: numResults,
		Livecrawl:  livecrawl,
	}
	if contextMaxChars != nil {
		args.ContextMaxCharacters = contextMaxChars
	}
	return callMCPHTTP(url, "web_search_exa", args, 25*time.Second)
}

// CallParallel 调用 Parallel MCP 搜索
func CallParallel(query string, sessionID, modelName, apiKey string) (string, error) {
	args := MCPParallelArgs{
		Objective:     query,
		SearchQueries: []string{query},
	}
	if sessionID != "" {
		args.SessionID = sessionID
	}
	if modelName != "" {
		args.ModelName = modelName
	}
	headers := map[string]string{
		"User-Agent": "opencode-go-websearch/1.0",
	}
	if apiKey != "" {
		headers["Authorization"] = "Bearer " + apiKey
	}
	return callMCPHTTPWithHeaders(ParallelURL, "web_search", args, 25*time.Second, headers)
}

func callMCPHTTP(url, tool string, args interface{}, timeout time.Duration) (string, error) {
	req := mcpRequest{
		JSONRPC: "2.0", ID: 1, Method: "tools/call",
		Params: mcpParams{Name: tool, Arguments: args},
	}
	reqBody, err := json.Marshal(req)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequest("POST", url, strings.NewReader(string(reqBody)))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Accept", "application/json, text/event-stream")
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("User-Agent", RandomUserAgent())

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return "", &EngineError{Engine: tool, Message: "MCP request failed: HTTP " + resp.Status, Retryable: true}
	}
	return parseMCPResponse(string(body)), nil
}

func callMCPHTTPWithHeaders(url, tool string, args interface{}, timeout time.Duration, headers map[string]string) (string, error) {
	req := mcpRequest{
		JSONRPC: "2.0", ID: 1, Method: "tools/call",
		Params: mcpParams{Name: tool, Arguments: args},
	}
	reqBody, err := json.Marshal(req)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequest("POST", url, strings.NewReader(string(reqBody)))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Accept", "application/json, text/event-stream")
	httpReq.Header.Set("Content-Type", "application/json")
	if _, ok := headers["User-Agent"]; !ok {
		httpReq.Header.Set("User-Agent", RandomUserAgent())
	}
	for k, v := range headers {
		httpReq.Header.Set(k, v)
	}
	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return "", &EngineError{Engine: tool, Message: "MCP request failed: HTTP " + resp.Status, Retryable: true}
	}
	return parseMCPResponse(string(body)), nil
}

// parseMCPResponse 解析 MCP 响应（支持完整 JSON 和 SSE data: 格式）
func parseMCPResponse(body string) string {
	if text := parseMCPJSON(body); text != "" {
		return text
	}
	for _, line := range strings.Split(body, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "data:") {
			payload := strings.TrimSpace(line[5:])
			if text := parseMCPJSON(payload); text != "" {
				return text
			}
		}
	}
	return ""
}

func parseMCPJSON(payload string) string {
	payload = strings.TrimSpace(payload)
	if !strings.HasPrefix(payload, "{") {
		return ""
	}
	var resp mcpResponse
	if err := json.Unmarshal([]byte(payload), &resp); err != nil {
		return ""
	}
	if resp.Result == nil {
		return ""
	}
	for _, item := range resp.Result.Content {
		if item.Text != "" {
			return item.Text
		}
	}
	return ""
}
