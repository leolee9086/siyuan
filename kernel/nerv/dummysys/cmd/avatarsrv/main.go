package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/dummysys"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type ChatRequest struct {
	Model       string            `json:"model"`
	Messages    []ChatMessage     `json:"messages"`
	Stream      bool              `json:"stream"`
	Temperature float64           `json:"temperature"`
	MaxTokens   int               `json:"max_tokens"`
	Tools       []json.RawMessage `json:"tools,omitempty"`
}

type ChatMessage struct {
	Role        string              `json:"role"`
	Content     json.RawMessage     `json:"content"`
	ToolCallID  string              `json:"tool_call_id,omitempty"`
	ToolCalls   json.RawMessage     `json:"tool_calls,omitempty"`
}

func (m ChatMessage) ExtractText() string {
	if len(m.Content) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(m.Content, &s); err == nil {
		return s
	}
	var parts []struct {
		Type     string `json:"type"`
		Text     string `json:"text,omitempty"`
	}
	if err := json.Unmarshal(m.Content, &parts); err == nil {
		var texts []string
		for _, p := range parts {
			if p.Type == "text" {
				texts = append(texts, p.Text)
			}
		}
		return strings.Join(texts, " ")
	}
	return string(m.Content)
}

func (m ChatMessage) ExtractToolCalls() []types.ToolCall {
	if len(m.ToolCalls) == 0 {
		return nil
	}
	var rawCalls []struct {
		ID   string `json:"id"`
		Type string `json:"type"`
		Function struct {
			Name      string `json:"name"`
			Arguments string `json:"arguments"`
		} `json:"function"`
	}
	if err := json.Unmarshal(m.ToolCalls, &rawCalls); err != nil {
		return nil
	}
	var calls []types.ToolCall
	for _, rc := range rawCalls {
		calls = append(calls, types.ToolCall{
			ID:   rc.ID,
			Type: rc.Type,
			Function: types.ToolCallFunction{
				Name:      rc.Function.Name,
				Arguments: rc.Function.Arguments,
			},
		})
	}
	return calls
}

type ToolCallResponse struct {
	ID       string               `json:"id"`
	Type     string               `json:"type"`
	Function ToolCallFunctionResp `json:"function"`
}

type ToolCallFunctionResp struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ChatResponse struct {
	ID      string           `json:"id"`
	Object  string           `json:"object"`
	Created int64            `json:"created"`
	Model   string           `json:"model"`
	Choices []ResponseChoice `json:"choices"`
	Usage   *UsageInfo       `json:"usage,omitempty"`
}

type ResponseChoice struct {
	Index        int                `json:"index"`
	Message      ResponseMessage    `json:"message"`
	FinishReason string             `json:"finish_reason"`
}

type ResponseMessage struct {
	Role      string             `json:"role"`
	Content   *string            `json:"content"`
	ToolCalls []ToolCallResponse `json:"tool_calls,omitempty"`
}

type StreamChunk struct {
	ID      string            `json:"id"`
	Object  string            `json:"object"`
	Created int64             `json:"created"`
	Model   string            `json:"model"`
	Choices []StreamChoice    `json:"choices"`
}

type StreamChoice struct {
	Index        int              `json:"index"`
	Delta        StreamDelta      `json:"delta"`
	FinishReason *string          `json:"finish_reason,omitempty"`
}

type StreamDelta struct {
	Role    string `json:"role,omitempty"`
	Content string `json:"content,omitempty"`
}

type UsageInfo struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	body       []byte
}

func (l *loggingResponseWriter) WriteHeader(code int) {
	l.statusCode = code
	l.ResponseWriter.WriteHeader(code)
}

func (l *loggingResponseWriter) Write(b []byte) (int, error) {
	l.body = b
	return l.ResponseWriter.Write(b)
}

func (l *loggingResponseWriter) Flush() {
	if f, ok := l.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

type ServerConfig struct {
	Port        int
	APIKey      string
	APIBaseURL  string
	APIModel    string
	Provider    string
	AvatarModel string
	Instance    int
	Channel     string
	ShowReports bool
}

func parseFlags() ServerConfig {
	cfg := ServerConfig{
		Port:        8080,
		APIKey:      os.Getenv("AVATAR_API_KEY"),
		APIBaseURL:  os.Getenv("AVATAR_API_BASE_URL"),
		APIModel:    os.Getenv("AVATAR_API_MODEL"),
		Provider:    os.Getenv("AVATAR_PROVIDER"),
		AvatarModel: os.Getenv("AVATAR_MODEL"),
		Channel:     os.Getenv("AVATAR_CHANNEL"),
		ShowReports: os.Getenv("AVATAR_SHOW_REPORTS") == "1",
	}

	flag.IntVar(&cfg.Port, "port", cfg.Port, "server port")
	flag.StringVar(&cfg.APIKey, "api-key", cfg.APIKey, "LLM API key")
	flag.StringVar(&cfg.APIBaseURL, "api-base-url", cfg.APIBaseURL, "LLM API base URL")
	flag.StringVar(&cfg.APIModel, "api-model", cfg.APIModel, "LLM model name")
	flag.StringVar(&cfg.Provider, "provider", cfg.Provider, "LLM provider (OpenAI/Claude)")
	flag.StringVar(&cfg.AvatarModel, "avatar-model", cfg.AvatarModel, "Avatar model ID (ZHI-01/REI-01/KAORU-02)")
	flag.IntVar(&cfg.Instance, "instance", 1, "Avatar instance number")
	flag.StringVar(&cfg.Channel, "channel", cfg.Channel, "Avatar channel")
	flag.Parse()

	if cfg.APIBaseURL == "" {
		cfg.APIBaseURL = "https://api.deepseek.com"
	}
	if cfg.APIModel == "" {
		cfg.APIModel = "deepseek-chat"
	}
	if cfg.Provider == "" {
		cfg.Provider = "OpenAI"
	}
	if cfg.AvatarModel == "" {
		cfg.AvatarModel = "ZHI-01"
	}
	if cfg.Channel == "" {
		cfg.Channel = "external-agent"
	}

	return cfg
}

func resolveChannel(ch string) dummysys.AvatarChannel {
	switch strings.ToLower(ch) {
	case "guardian":
		return dummysys.AvatarChannelGuardian
	case "external-agent", "external":
		return dummysys.AvatarChannelExternalAgent
	case "system-cron", "cron":
		return dummysys.AvatarChannelSystemCron
	default:
		return dummysys.AvatarChannelUnknown
	}
}

func main() {
	cfg := parseFlags()

	llmCfg := &llm.Config{
		Provider:    cfg.Provider,
		APIKey:      cfg.APIKey,
		APIBaseURL:  cfg.APIBaseURL,
		APIModel:    cfg.APIModel,
		MaxTokens:   4096,
		Temperature: 0.5,
		Timeout:     120,
	}
	client := llm.NewClient(llmCfg)
	if client == nil {
		log.Fatal("failed to create LLM client")
	}
	log.Printf("LLM client: model=%s base=%s provider=%s", cfg.APIModel, cfg.APIBaseURL, cfg.Provider)

	modelID := dummysys.AvatarModelID(cfg.AvatarModel)
	if !dummysys.IsValidAvatarModelID(modelID) {
		log.Fatalf("invalid avatar model ID: %s (valid: ZHI-01, REI-01, KAORU-02)", cfg.AvatarModel)
	}
	channel := resolveChannel(cfg.Channel)

	log.Printf("Avatar: model=%s instance=%d channel=%s", modelID, cfg.Instance, channel)

	// 请求日志中间件
	loggedMux := http.NewServeMux()
	loggedMux.HandleFunc("/v1/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		handleChatCompletions(w, r, llmCfg, client, modelID, cfg.Instance, channel, cfg.ShowReports)
	})
	loggedMux.HandleFunc("/chat/completions", func(w http.ResponseWriter, r *http.Request) {
		handleChatCompletions(w, r, llmCfg, client, modelID, cfg.Instance, channel, cfg.ShowReports)
	})
	loggedMux.HandleFunc("/v1/models", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"object": "list",
			"data": []map[string]interface{}{
				{"id": "ZHI-01", "object": "model", "created": time.Now().Unix(), "owned_by": "magi"},
				{"id": "REI-01", "object": "model", "created": time.Now().Unix(), "owned_by": "magi"},
				{"id": "KAORU-02", "object": "model", "created": time.Now().Unix(), "owned_by": "magi"},
			},
		})
	})
	loggedMux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})
	loggedMux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		// 处理 RooCode 的双重路径问题：/v1/chat/completions/chat/completions
		if strings.Contains(path, "/chat/completions") {
			handleChatCompletions(w, r, llmCfg, client, modelID, cfg.Instance, channel, cfg.ShowReports)
			return
		}
		log.Printf("[404] %s %s", r.Method, path)
		http.NotFound(w, r)
	})

	// CORS + 响应日志
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		log.Printf("[REQ] %s %s from %s", r.Method, r.URL.Path, r.RemoteAddr)
		lrw := &loggingResponseWriter{ResponseWriter: w, statusCode: 200}
		loggedMux.ServeHTTP(lrw, r)
		log.Printf("[RESP_STATUS] %d", lrw.statusCode)
	})

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("Avatar server listening on %s", addr)
	log.Printf("OpenAI-compatible endpoint: http://localhost:%d/v1/chat/completions", cfg.Port)
	log.Printf("RooCode config: baseUrl=http://localhost:%d apiKey=not-needed", cfg.Port)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func handleChatCompletions(
	w http.ResponseWriter, r *http.Request,
	llmCfg *llm.Config, client llm.Client,
	modelID dummysys.AvatarModelID, instance int,
	channel dummysys.AvatarChannel, showReports bool,
) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	bodyBytes, _ := io.ReadAll(r.Body)
	r.Body.Close()
	if showReports {
		log.Printf("[REQ_BODY] %s", string(bodyBytes))
	}
	var req ChatRequest
	if err := json.Unmarshal(bodyBytes, &req); err != nil {
		http.Error(w, fmt.Sprintf("invalid request: %v", err), http.StatusBadRequest)
		return
	}

	if showReports {
		log.Printf("[STREAM] req.Stream=%v", req.Stream)
	}

	// 从请求中提取外部工具定义
	var externalTools []openai.Tool
	for _, raw := range req.Tools {
		var tool openai.Tool
		if err := json.Unmarshal(raw, &tool); err == nil {
			externalTools = append(externalTools, tool)
		}
	}
	if showReports {
		toolNames := make([]string, len(externalTools))
		for i, t := range externalTools {
			if t.Function != nil {
				toolNames[i] = t.Function.Name
			}
		}
		log.Printf("[TOOLS] external tools: %v", toolNames)
	}

	// 构建RooCode的外部消息列表（不含身份锚定，身份由Avatar自动注入）
	var externalMessages []types.ContextMessage
	for _, msg := range req.Messages {
		text := msg.ExtractText()
		toolCalls := msg.ExtractToolCalls()
		if text == "" && len(toolCalls) == 0 && msg.ToolCallID == "" {
			continue
		}
		cm := types.ContextMessage{
			Role:    types.MessageRole(msg.Role),
			Content: text,
			ToolID:  msg.ToolCallID,
		}
		if len(toolCalls) > 0 {
			cm.ToolCalls = toolCalls
		}
		externalMessages = append(externalMessages, cm)
	}

	avatar, err := dummysys.NewAvatar(dummysys.AvatarConfig{
		AvatarRoleID:            fmt.Sprintf("avatar-%s-%d", modelID, instance),
		AvatarNumber:            instance,
		Channel:                 channel,
		SystemPrompt:            "",
		HeartbeatIntervalRounds: 5,
		Identity: dummysys.AvatarIdentity{
			ModelID:  modelID,
			Instance: instance,
			Channel:  channel,
		},
		ReportCallback: func(ev dummysys.ReportEvent) {
			log.Printf("\n========================================")
			log.Printf("[REPORT] === 织(ZHI-01) #3 向 MAGI 回报 ===")
			log.Printf("[REPORT] 类型:     %s", ev.Payload.Type)
			log.Printf("[REPORT] 环境:     %s", ev.Payload.Environment)
			log.Printf("[REPORT] 教训:     %s", ev.Payload.Lessons)
			if ev.Payload.Content != "" {
				log.Printf("[REPORT] 补充内容: %s", ev.Payload.Content)
			}
			log.Printf("[REPORT] 紧急程度: %s", ev.Payload.Urgency)
			log.Printf("========================================\n")
		},
	}, client)
	if err != nil {
		http.Error(w, fmt.Sprintf("avatar creation failed: %v", err), http.StatusInternalServerError)
		return
	}

	if showReports {
		log.Printf("[AVATAR] %s | context msgs: %d external msgs: %d tools: %d",
			avatar.IdentityDisplay(), len(avatar.GetContext()), len(externalMessages), len(externalTools))
	}

	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()

	result, err := avatar.ProcessExternalMessages(ctx, externalMessages, externalTools)
	if err != nil {
		log.Printf("[AVATAR_ERROR] %v", err)
		http.Error(w, fmt.Sprintf("avatar processing failed: %v", err), http.StatusInternalServerError)
		return
	}

	if req.Stream {
		handleStreamingResponse(w, req.Model, result.Content, result.ToolCallNames, result.ToolArgumentsByName)
	} else {
		handleNormalResponse(w, req.Model, result.Content, result.ToolCallNames, result.ToolArgumentsByName)
	}
}

func handleNormalResponse(w http.ResponseWriter, model, content string, toolNames []string, toolArgsByName map[string][]string) {
	hasTools := len(toolNames) > 0
	var contentPtr *string
	if !hasTools {
		contentPtr = &content
	}

	msg := ResponseMessage{
		Role:    "assistant",
		Content: contentPtr,
	}

	finishReason := "stop"
	if hasTools {
		var toolCalls []ToolCallResponse
		toolID := 0
		for _, name := range toolNames {
			argsList := toolArgsByName[name]
			for _, args := range argsList {
				toolID++
				toolCalls = append(toolCalls, ToolCallResponse{
					ID:   fmt.Sprintf("call_%d", toolID),
					Type: "function",
					Function: ToolCallFunctionResp{
						Name:      name,
						Arguments: args,
					},
				})
			}
		}
		msg.ToolCalls = toolCalls
		finishReason = "tool_calls"
	}

	resp := ChatResponse{
		ID:      fmt.Sprintf("chatcmpl-%d", time.Now().UnixNano()),
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Model:   model,
		Choices: []ResponseChoice{
			{
				Index:        0,
				Message:      msg,
				FinishReason: finishReason,
			},
		},
	}

	w.Header().Set("Content-Type", "application/json")
	respJSON, _ := json.Marshal(resp)
	log.Printf("[RESP] %s", string(respJSON))
	w.Write(respJSON)
}

type streamToolCallDelta struct {
	Index    int                    `json:"index"`
	ID       string                 `json:"id,omitempty"`
	Type     string                 `json:"type,omitempty"`
	Function map[string]interface{} `json:"function,omitempty"`
}

type streamToolCallChoice struct {
	Index        int                  `json:"index"`
	Delta        map[string]interface{} `json:"delta"`
	FinishReason *string              `json:"finish_reason,omitempty"`
}

type streamToolCallChunk struct {
	ID      string                  `json:"id,omitempty"`
	Object  string                  `json:"object"`
	Created int64                   `json:"created,omitempty"`
	Model   string                  `json:"model,omitempty"`
	Choices []streamToolCallChoice  `json:"choices"`
}

func handleStreamingResponse(w http.ResponseWriter, model, content string, toolNames []string, toolArgsByName map[string][]string) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		handleNormalResponse(w, model, content, toolNames, toolArgsByName)
		return
	}

	hasTools := len(toolNames) > 0
	chunkID := fmt.Sprintf("chatcmpl-%d", time.Now().UnixNano())
	created := time.Now().Unix()

	if hasTools {
		// Role chunk
		roleData := map[string]interface{}{
			"role": "assistant",
			"content": nil,
		}
		writeSSE(w, streamToolCallChunk{
			ID: chunkID, Object: "chat.completion.chunk", Created: created, Model: model,
			Choices: []streamToolCallChoice{{Index: 0, Delta: roleData}},
		})
		flusher.Flush()

		// Tool call chunks
		toolID := 0
		for _, name := range toolNames {
			argsList := toolArgsByName[name]
			for _, rawArgs := range argsList {
				toolID++
				tcDelta := streamToolCallDelta{
					Index: toolID,
					ID:    fmt.Sprintf("call_%d", toolID),
					Type:  "function",
					Function: map[string]interface{}{
						"name":      name,
						"arguments": rawArgs,
					},
				}
				tcData := map[string]interface{}{
					"tool_calls": []streamToolCallDelta{tcDelta},
				}
				writeSSE(w, streamToolCallChunk{
					Object: "chat.completion.chunk",
					Choices: []streamToolCallChoice{{Index: 0, Delta: tcData}},
				})
				flusher.Flush()
			}
		}

		// Finish chunk
		finish := "tool_calls"
		writeSSE(w, streamToolCallChunk{
			Object: "chat.completion.chunk",
			Choices: []streamToolCallChoice{{Index: 0, Delta: map[string]interface{}{}, FinishReason: &finish}},
		})
	} else {
		// Content streaming
		roleData := map[string]interface{}{"role": "assistant", "content": nil}
		writeSSE(w, streamToolCallChunk{
			ID: chunkID, Object: "chat.completion.chunk", Created: created, Model: model,
			Choices: []streamToolCallChoice{{Index: 0, Delta: roleData}},
		})
		flusher.Flush()

		runes := []rune(content)
		for i := 0; i < len(runes); i += 4 {
			end := i + 4
			if end > len(runes) {
				end = len(runes)
			}
			writeSSE(w, streamToolCallChunk{
				Object: "chat.completion.chunk",
				Choices: []streamToolCallChoice{{Index: 0, Delta: map[string]interface{}{"content": string(runes[i:end])}}},
			})
			flusher.Flush()
		}

		finish := "stop"
		writeSSE(w, streamToolCallChunk{
			Object: "chat.completion.chunk",
			Choices: []streamToolCallChoice{{Index: 0, Delta: map[string]interface{}{}, FinishReason: &finish}},
		})
	}

	fmt.Fprintf(w, "data: [DONE]\n\n")
	flusher.Flush()
}

func writeSSE(w http.ResponseWriter, v interface{}) {
	data, err := json.Marshal(v)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "data: %s\n\n", data)
}
