package main

import (
	"encoding/json"
	"log"
	"sort"
	"sync"

	shared "github.com/siyuan-note/siyuan/packages/websearch"
)

// 本服务支持的 MCP 协议版本。
const (
	protocolVersion20241105 = "2024-11-05"
	protocolVersion20250618 = "2025-06-18"

	defaultProtocolVersion = protocolVersion20250618
	serverName             = "websearch-mcp"
)

var supportedProtocolVersions = map[string]bool{
	protocolVersion20241105: true,
	protocolVersion20250618: true,
}

// MCP 使用的 JSON-RPC 2.0 错误码。
const (
	rpcParseError     = -32700
	rpcInvalidRequest = -32600
	rpcMethodNotFound = -32601
	rpcInvalidParams  = -32602
	rpcNotInitialized = -32002
)

// ── JSON-RPC 2.0 信封 ──────────────────────────────────

type jsonRpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	Method  string `json:"method"`
	Params  any    `json:"params,omitempty"`
	ID      any    `json:"id,omitempty"`
}

type jsonRpcResponse struct {
	JSONRPC string `json:"jsonrpc"`
	Result  any    `json:"result,omitempty"`
	ID      any    `json:"id"`
}

type jsonRpcErrorResponse struct {
	JSONRPC string   `json:"jsonrpc"`
	Error   rpcError `json:"error"`
	ID      any      `json:"id"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// CallToolResult 是 MCP 规范中 tools/call 的结果负载。
type CallToolResult struct {
	Content []ContentItem `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type ContentItem struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Tool 是本服务暴露的单个 MCP 工具。
type Tool struct {
	Name        string
	Description string
	InputSchema map[string]any
	Handler     func(args map[string]any) (CallToolResult, error)
}

// Deps 承载 Server 的注入依赖，便于测试时屏蔽网络访问。
type Deps struct {
	SearchFn func(query string, opts shared.SearchOptions) (shared.SearchResponse, error)
	StatusFn func(names []string, probe bool, query string) []shared.EngineDiagnostic
	Protect  bool
	Logger   *log.Logger
}

// Server 是与传输无关的 MCP JSON-RPC 处理器。
type Server struct {
	tools       map[string]*Tool
	searchFn    func(query string, opts shared.SearchOptions) (shared.SearchResponse, error)
	statusFn    func(names []string, probe bool, query string) []shared.EngineDiagnostic
	protect     bool
	logger      *log.Logger
	mu          sync.Mutex
	initialized bool
}

func NewServer(deps Deps) *Server {
	logger := deps.Logger
	if logger == nil {
		logger = log.New(logDiscard{}, "", 0)
	}
	s := &Server{
		searchFn: deps.SearchFn,
		statusFn: deps.StatusFn,
		protect:  deps.Protect,
		logger:   logger,
		tools:    make(map[string]*Tool, 2),
	}
	s.tools["web_search"] = s.webSearchTool()
	s.tools["web_search_status"] = s.webSearchStatusTool()
	return s
}

// clone 返回带有全新 initialized 标志的副本，HTTP 传输用它为每个会话
// 提供独立的初始化状态。tools 表与注入函数构造后不可变，可安全共享。
func (s *Server) clone() *Server {
	return &Server{
		tools:       s.tools,
		searchFn:    s.searchFn,
		statusFn:    s.statusFn,
		protect:     s.protect,
		logger:      s.logger,
		initialized: false,
	}
}

func (s *Server) isInitialized() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.initialized
}

func (s *Server) markInitialized() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.initialized = true
}

// Handle 处理一条 JSON-RPC 消息并返回需要回发的响应字节。当消息是通知
// （不得收到响应）时返回 (nil, true)，传输层此时应答 HTTP 202。
func (s *Server) Handle(raw []byte) ([]byte, bool) {
	var req jsonRpcRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return s.marshalError(rpcParseError, "Parse error", nil), false
	}
	if req.JSONRPC != "2.0" || req.Method == "" {
		return s.marshalError(rpcInvalidRequest, "Invalid Request", req.ID), false
	}
	isNotification := req.ID == nil
	switch req.Method {
	case "initialize":
		if isNotification {
			return nil, true
		}
		return s.handleInitialize(req), false
	case "notifications/initialized":
		s.markInitialized()
		return nil, true
	case "ping":
		if isNotification {
			return nil, true
		}
		return s.marshalResult(map[string]any{}, req.ID), false
	case "tools/list":
		if isNotification {
			return nil, true
		}
		if !s.isInitialized() {
			return s.marshalError(rpcNotInitialized, "Server not initialized", req.ID), false
		}
		return s.handleToolsList(req.ID), false
	case "tools/call":
		if isNotification {
			return nil, true
		}
		if !s.isInitialized() {
			return s.marshalError(rpcNotInitialized, "Server not initialized", req.ID), false
		}
		return s.handleToolsCall(req), false
	default:
		if isNotification {
			return nil, true
		}
		return s.marshalError(rpcMethodNotFound, "Method not found", req.ID), false
	}
}

func (s *Server) handleInitialize(req jsonRpcRequest) []byte {
	serverVersion := defaultProtocolVersion
	if params, ok := req.Params.(map[string]any); ok {
		if clientVersion, ok := params["protocolVersion"].(string); ok && supportedProtocolVersions[clientVersion] {
			serverVersion = clientVersion
		}
	}
	s.markInitialized()
	return s.marshalResult(map[string]any{
		"protocolVersion": serverVersion,
		"capabilities": map[string]any{
			"tools": map[string]any{"listChanged": false},
		},
		"serverInfo": map[string]any{
			"name":    serverName,
			"version": shared.Version,
		},
	}, req.ID)
}

func (s *Server) handleToolsList(id any) []byte {
	names := make([]string, 0, len(s.tools))
	for name := range s.tools {
		names = append(names, name)
	}
	sort.Strings(names)
	tools := make([]map[string]any, 0, len(names))
	for _, name := range names {
		t := s.tools[name]
		tools = append(tools, map[string]any{
			"name":        t.Name,
			"description": t.Description,
			"inputSchema": t.InputSchema,
		})
	}
	return s.marshalResult(map[string]any{"tools": tools}, id)
}

func (s *Server) handleToolsCall(req jsonRpcRequest) []byte {
	params, ok := req.Params.(map[string]any)
	if !ok {
		return s.marshalError(rpcInvalidParams, "Invalid params", req.ID)
	}
	name, _ := params["name"].(string)
	if name == "" {
		return s.marshalError(rpcInvalidParams, "Invalid params: name is required", req.ID)
	}
	t, ok := s.tools[name]
	if !ok {
		// 未知工具以工具级错误呈现，而不是 JSON-RPC 错误。
		return s.marshalResult(CallToolResult{
			Content: []ContentItem{{Type: "text", Text: "tool not found: " + name}},
			IsError: true,
		}, req.ID)
	}
	args, _ := params["arguments"].(map[string]any)
	if args == nil {
		args = map[string]any{}
	}
	result, err := t.Handler(args)
	if err != nil {
		return s.marshalResult(CallToolResult{
			Content: []ContentItem{{Type: "text", Text: err.Error()}},
			IsError: true,
		}, req.ID)
	}
	return s.marshalResult(result, req.ID)
}

func (s *Server) marshalResult(result any, id any) []byte {
	return mustMarshal(jsonRpcResponse{JSONRPC: "2.0", Result: result, ID: id})
}

func (s *Server) marshalError(code int, message string, id any) []byte {
	return mustMarshal(jsonRpcErrorResponse{
		JSONRPC: "2.0",
		Error:   rpcError{Code: code, Message: message},
		ID:      id,
	})
}

func mustMarshal(v any) []byte {
	data, err := json.Marshal(v)
	if err != nil {
		// 信封类型不可能序列化失败；此处兜底返回内部错误。
		return []byte(`{"jsonrpc":"2.0","error":{"code":-32603,"message":"Internal error"},"id":null}`)
	}
	return data
}

// logDiscard 满足 io.Writer，供未传 logger 的测试使用。
type logDiscard struct{}

func (logDiscard) Write(p []byte) (int, error) { return len(p), nil }
