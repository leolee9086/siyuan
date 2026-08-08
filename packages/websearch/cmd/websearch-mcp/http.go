package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

// runHTTP 在 /mcp 上提供 MCP streamable HTTP 传输（2025-06-18）：
// POST 处理 JSON-RPC 消息，GET 提供 SSE 流，DELETE 结束会话。
func runHTTP(s *Server, addr string, logger *log.Logger) error {
	handler := newHTTPHandler(s, logger)
	mux := http.NewServeMux()
	mux.Handle("/mcp", handler)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})
	logger.Printf("starting streamable HTTP transport on %s (endpoint /mcp, protocol %s)", addr, defaultProtocolVersion)
	return http.ListenAndServe(addr, mux)
}

type httpSession struct {
	server  *Server
	created time.Time
}

type httpHandler struct {
	mu       sync.Mutex
	server   *Server
	sessions map[string]*httpSession
	logger   *log.Logger
}

func newHTTPHandler(s *Server, logger *log.Logger) http.Handler {
	return &httpHandler{
		server:   s,
		sessions: make(map[string]*httpSession),
		logger:   logger,
	}
}

func (h *httpHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// 宽松 CORS，允许浏览器端的 MCP 客户端访问本服务。
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Mcp-Method, Authorization")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	switch r.Method {
	case http.MethodPost:
		h.handlePost(w, r)
	case http.MethodGet:
		h.handleGet(w, r)
	case http.MethodDelete:
		h.handleDelete(w, r)
	default:
		w.Header().Set("Allow", "GET, POST, DELETE, OPTIONS")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *httpHandler) handlePost(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		h.writeJSON(w, mustMarshal(jsonRpcErrorResponse{
			JSONRPC: "2.0",
			Error:   rpcError{Code: rpcParseError, Message: "Failed to read request body"},
			ID:      nil,
		}))
		return
	}

	if r.Header.Get("Mcp-Session-Id") == "" && isInitialize(body) {
		sessionID := h.createSession()
		resp, notification := h.sessions[sessionID].server.Handle(body)
		w.Header().Set("Mcp-Session-Id", sessionID)
		w.Header().Set("Mcp-Protocol-Version", defaultProtocolVersion)
		if notification {
			w.WriteHeader(http.StatusAccepted)
			return
		}
		h.writeJSON(w, resp)
		return
	}

	sessionID := r.Header.Get("Mcp-Session-Id")
	if sessionID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"Mcp-Session-Id required"}`))
		return
	}
	h.mu.Lock()
	session, ok := h.sessions[sessionID]
	h.mu.Unlock()
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"error":"unknown session"}`))
		return
	}
	resp, notification := session.server.Handle(body)
	if notification {
		w.WriteHeader(http.StatusAccepted)
		return
	}
	w.Header().Set("Mcp-Protocol-Version", defaultProtocolVersion)
	h.writeJSON(w, resp)
}

func (h *httpHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	// endpoint 事件告知客户端应往哪个地址 POST 消息。
	_, _ = fmt.Fprintf(w, "event: endpoint\ndata: /mcp\n\n")
	flusher.Flush()

	// 本服务在 POST 上同步应答每个请求，SSE 流不承载服务端主动消息；
	// 用心跳注释保持连接存活，直到客户端断开。
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			_, _ = fmt.Fprintf(w, ": ping\n\n")
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

func (h *httpHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	sessionID := r.Header.Get("Mcp-Session-Id")
	if sessionID == "" {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	h.mu.Lock()
	delete(h.sessions, sessionID)
	h.mu.Unlock()
	w.WriteHeader(http.StatusNoContent)
}

func (h *httpHandler) createSession() string {
	id := newSessionID()
	h.mu.Lock()
	h.sessions[id] = &httpSession{server: h.server.clone(), created: time.Now()}
	h.mu.Unlock()
	return id
}

func (h *httpHandler) writeJSON(w http.ResponseWriter, data []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// isInitialize 预检原始请求体，判断该请求是否创建会话；解析错误交由
// Server 后续处理。
func isInitialize(raw []byte) bool {
	var probe struct {
		Method string `json:"method"`
	}
	if err := json.Unmarshal(raw, &probe); err != nil {
		return false
	}
	return probe.Method == "initialize"
}

func newSessionID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("s%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}
