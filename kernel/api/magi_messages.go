package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-gonic/gin"
	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// MagiClaudeRequest 是 Claude `messages` 协议请求体的任务封装
type MagiClaudeRequest struct {
	Ctx      *gin.Context
	Req      anthropic.MessagesRequest
	DoneChan chan struct{}
}

var magiClaudeQueue = make(chan *MagiClaudeRequest, 100)

func init() {
	// 在原有的 initMagiCron 外，单开一个调度循环处理 Claude 消息类型任务
	go magiClaudeDispatcher()
}

func magiClaudeDispatcher() {
	for task := range magiClaudeQueue {
		handleMagiClaudeTask(task)
	}
}

// magiMessages 处理客户端以 `/v1/messages` (Claude 格式) 发来的请求
func magiMessages(c *gin.Context) {
	if "" == model.Conf.AI.OpenAI.APIKey {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "OpenAI/Claude API Key not configured"})
		return
	}

	// Claude API 的 content 字段允许字符串或数组两种格式
	// go-anthropic 只支持数组，所以先做预处理
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	body = normalizeMessagesContentField(body)

	var req anthropic.MessagesRequest
	if err := json.Unmarshal(body, &req); err != nil {
		logging.LogErrorf("magiMessages Unmarshal failed: %s", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	logging.LogInfof("magiMessages received: model=[%s] stream=[%v] msgs=[%d]", req.Model, req.Stream, len(req.Messages))

	// 流式请求必须在当前 gin goroutine 内直接处理，不能经过队列（否则 SSE flush 被阻塞）
	if req.Stream {
		dispatchMagiClaudeReq(c, req)
		return
	}

	// 非流式走串行队列，保证 Trinity 上下文注入单线程原则
	task := &MagiClaudeRequest{
		Ctx:      c,
		Req:      req,
		DoneChan: make(chan struct{}),
	}

	select {
	case magiClaudeQueue <- task:
		<-task.DoneChan
	case <-c.Request.Context().Done():
		return
	case <-time.After(30 * time.Second):
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "Magi queue is full or processing too slow"})
	}
}

// normalizeMessagesContentField 将 messages[].content 字段的字符串格式规范化为数组格式
// 例如 "content": "hello" → "content": [{"type":"text","text":"hello"}]
func normalizeMessagesContentField(body []byte) []byte {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(body, &raw); err != nil {
		return body
	}

	msgsRaw, ok := raw["messages"]
	if !ok {
		return body
	}

	var msgs []map[string]json.RawMessage
	if err := json.Unmarshal(msgsRaw, &msgs); err != nil {
		return body
	}

	changed := false
	for i, msg := range msgs {
		contentRaw, ok := msg["content"]
		if !ok {
			continue
		}
		// 如果 content 以 '"' 开头，说明是字符串格式
		trimmed := strings.TrimSpace(string(contentRaw))
		if len(trimmed) > 0 && trimmed[0] == '"' {
			var s string
			if err := json.Unmarshal(contentRaw, &s); err != nil {
				continue
			}
			arrayContent, _ := json.Marshal([]map[string]string{
				{"type": "text", "text": s},
			})
			msgs[i]["content"] = json.RawMessage(arrayContent)
			changed = true
		}
	}

	if !changed {
		return body
	}

	newMsgsBytes, err := json.Marshal(msgs)
	if err != nil {
		return body
	}
	raw["messages"] = json.RawMessage(newMsgsBytes)
	newBody, err := json.Marshal(raw)
	if err != nil {
		return body
	}
	return newBody
}

func dispatchMagiClaudeReq(c *gin.Context, req anthropic.MessagesRequest) {
	if model.Conf.AI.OpenAI.APIProvider == "Claude" {
		if req.Stream {
			magiMessagesStreamClaude(c, req)
		} else {
			magiMessagesSyncClaude(c, req)
		}
	} else {
		if req.Stream {
			magiMessagesStreamOpenAI(c, req)
		} else {
			magiMessagesSyncOpenAI(c, req)
		}
	}
}

func handleMagiClaudeTask(task *MagiClaudeRequest) {
	defer close(task.DoneChan)
	dispatchMagiClaudeReq(task.Ctx, task.Req)
}

func translateClaudeToOpenAIReq(req anthropic.MessagesRequest) openai.ChatCompletionRequest {
	oReq := openai.ChatCompletionRequest{
		Model:     string(req.Model),
		MaxTokens: req.MaxTokens,
		Stream:    req.Stream,
	}
	if req.Temperature != nil {
		oReq.Temperature = *req.Temperature
	}
	if req.TopP != nil {
		oReq.TopP = *req.TopP
	}

	if req.System != "" {
		oReq.Messages = append(oReq.Messages, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: req.System,
		})
	}

	for _, m := range req.Messages {
		var role string
		switch m.Role {
		case anthropic.RoleUser:
			role = openai.ChatMessageRoleUser
		case anthropic.RoleAssistant:
			role = openai.ChatMessageRoleAssistant
		}

		var textContent string
		var toolCalls []openai.ToolCall
		var hasToolResult bool

		for _, c := range m.Content {
			switch c.Type {
			case anthropic.MessagesContentTypeText:
				if c.Text != nil {
					textContent += *c.Text
				}
			case anthropic.MessagesContentTypeToolUse:
				if c.MessageContentToolUse != nil {
					toolCalls = append(toolCalls, openai.ToolCall{
						ID:   c.MessageContentToolUse.ID,
						Type: openai.ToolTypeFunction,
						Function: openai.FunctionCall{
							Name:      c.MessageContentToolUse.Name,
							Arguments: string(c.MessageContentToolUse.Input),
						},
					})
				}
			case anthropic.MessagesContentTypeToolResult:
				hasToolResult = true
			}
		}

		if textContent != "" || len(toolCalls) > 0 {
			oReq.Messages = append(oReq.Messages, openai.ChatCompletionMessage{
				Role:      role,
				Content:   textContent,
				ToolCalls: toolCalls,
			})
		}

		if hasToolResult {
			for _, c := range m.Content {
				if c.Type == anthropic.MessagesContentTypeToolResult && c.MessageContentToolResult != nil {
					resContent := ""
					for _, subc := range c.MessageContentToolResult.Content {
						if subc.Type == anthropic.MessagesContentTypeText && subc.Text != nil {
							resContent += *subc.Text
						}
					}
					toolUseId := ""
					if c.MessageContentToolResult.ToolUseID != nil {
						toolUseId = *c.MessageContentToolResult.ToolUseID
					}
					oReq.Messages = append(oReq.Messages, openai.ChatCompletionMessage{
						Role:       openai.ChatMessageRoleTool,
						Content:    resContent,
						ToolCallID: toolUseId,
					})
				}
			}
		}
	}

	for _, t := range req.Tools {
		oReq.Tools = append(oReq.Tools, openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.InputSchema,
			},
		})
	}
	return oReq
}

func translateOpenAIToClaudeResp(oResp openai.ChatCompletionResponse) anthropic.MessagesResponse {
	cResp := anthropic.MessagesResponse{
		ID:    oResp.ID,
		Type:  "message",
		Model: anthropic.Model(oResp.Model),
		Role:  anthropic.RoleAssistant,
		Usage: anthropic.MessagesUsage{
			InputTokens:  oResp.Usage.PromptTokens,
			OutputTokens: oResp.Usage.CompletionTokens,
		},
	}

	if len(oResp.Choices) > 0 {
		choice := oResp.Choices[0]
		if choice.Message.Content != "" {
			cResp.Content = append(cResp.Content, anthropic.MessageContent{
				Type: anthropic.MessagesContentTypeText,
				Text: &choice.Message.Content,
			})
		}

		for _, tc := range choice.Message.ToolCalls {
			cResp.Content = append(cResp.Content, anthropic.MessageContent{
				Type: anthropic.MessagesContentTypeToolUse,
				MessageContentToolUse: &anthropic.MessageContentToolUse{
					ID:    tc.ID,
					Name:  tc.Function.Name,
					Input: json.RawMessage(tc.Function.Arguments),
				},
			})
		}

		switch choice.FinishReason {
		case openai.FinishReasonStop:
			cResp.StopReason = anthropic.MessagesStopReasonEndTurn
		case openai.FinishReasonLength:
			cResp.StopReason = anthropic.MessagesStopReasonMaxTokens
		case openai.FinishReasonToolCalls:
			cResp.StopReason = anthropic.MessagesStopReasonToolUse
		default:
			cResp.StopReason = anthropic.MessagesStopReasonEndTurn
		}
	}

	return cResp
}

func magiMessagesSyncOpenAI(c *gin.Context, req anthropic.MessagesRequest) {
	client := util.NewOpenAIClient(
		model.Conf.AI.OpenAI.APIKey,
		model.Conf.AI.OpenAI.APIProxy,
		model.Conf.AI.OpenAI.APIBaseURL,
		model.Conf.AI.OpenAI.APIUserAgent,
		model.Conf.AI.OpenAI.APIVersion,
		model.Conf.AI.OpenAI.APIProvider,
	)

	oReq := translateClaudeToOpenAIReq(req)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(model.Conf.AI.OpenAI.APITimeout)*time.Second)
	defer cancel()

	resp, err := client.CreateChatCompletion(ctx, oReq)
	if err != nil {
		logging.LogErrorf("magiMessagesSyncOpenAI CreateChatCompletion failed: %s", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, translateOpenAIToClaudeResp(resp))
}

func magiMessagesStreamOpenAI(c *gin.Context, req anthropic.MessagesRequest) {
	client := util.NewOpenAIClient(
		model.Conf.AI.OpenAI.APIKey,
		model.Conf.AI.OpenAI.APIProxy,
		model.Conf.AI.OpenAI.APIBaseURL,
		model.Conf.AI.OpenAI.APIUserAgent,
		model.Conf.AI.OpenAI.APIVersion,
		model.Conf.AI.OpenAI.APIProvider,
	)

	oReq := translateClaudeToOpenAIReq(req)
	oReq.Stream = true

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(model.Conf.AI.OpenAI.APITimeout)*time.Second)
	defer cancel()

	stream, err := client.CreateChatCompletionStream(ctx, oReq)
	if err != nil {
		logging.LogErrorf("magiMessagesStreamOpenAI CreateChatCompletionStream failed: %s", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer stream.Close()

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	writeSSE := func(event string, data interface{}) {
		if event != "" {
			_, _ = io.WriteString(c.Writer, "event: "+event+"\n")
		}
		b, _ := json.Marshal(data)
		_, _ = io.WriteString(c.Writer, "data: "+string(b)+"\n\n")
		c.Writer.Flush()
	}

	msgID := "msg_magi_" + gulu.Rand.String(12)

	writeSSE("message_start", map[string]interface{}{
		"type": "message_start",
		"message": map[string]interface{}{
			"id":            msgID,
			"type":          "message",
			"role":          "assistant",
			"model":         string(req.Model),
			"content":       []interface{}{},
			"stop_reason":   nil,
			"stop_sequence": nil,
			"usage":         map[string]int{"input_tokens": 0, "output_tokens": 0},
		},
	})

	writeSSE("content_block_start", map[string]interface{}{
		"type":  "content_block_start",
		"index": 0,
		"content_block": map[string]string{
			"type": "text",
			"text": "",
		},
	})

	writeSSE("ping", map[string]string{"type": "ping"})

	textBlockOpen := true
	currentToolIndex := -1

	for {
		resp, err := stream.Recv()
		if err != nil {
			if err == io.EOF {
				break
			}
			logging.LogErrorf("magiMessagesStreamOpenAI stream recv error: %s", err)
			break
		}

		if len(resp.Choices) == 0 {
			continue
		}

		delta := resp.Choices[0].Delta

		// 处理文本增量
		if delta.Content != "" {
			if !textBlockOpen {
				// 如果前面某个 tool block 后又来文本，开新块
				writeSSE("content_block_start", map[string]interface{}{
					"type":  "content_block_start",
					"index": currentToolIndex + 1,
					"content_block": map[string]string{
						"type": "text",
						"text": "",
					},
				})
				textBlockOpen = true
			}
			writeSSE("content_block_delta", map[string]interface{}{
				"type":  "content_block_delta",
				"index": 0,
				"delta": map[string]string{
					"type": "text_delta",
					"text": delta.Content,
				},
			})
		}

		// 处理 tool_calls 增量
		for _, tc := range delta.ToolCalls {
			idx := 0
			if tc.Index != nil {
				idx = *tc.Index
			}
			blockIdx := idx + 1 // 文本块占 index 0，工具块从 1 开始

			// 新 tool block 开始
			if currentToolIndex != idx {
				if textBlockOpen {
					writeSSE("content_block_stop", map[string]interface{}{
						"type":  "content_block_stop",
						"index": 0,
					})
					textBlockOpen = false
				}
				currentToolIndex = idx
				writeSSE("content_block_start", map[string]interface{}{
					"type":  "content_block_start",
					"index": blockIdx,
					"content_block": map[string]interface{}{
						"type":  "tool_use",
						"id":    tc.ID,
						"name":  tc.Function.Name,
						"input": map[string]interface{}{},
					},
				})
			}

			// 参数增量
			if tc.Function.Arguments != "" {
				writeSSE("content_block_delta", map[string]interface{}{
					"type":  "content_block_delta",
					"index": blockIdx,
					"delta": map[string]string{
						"type":         "input_json_delta",
						"partial_json": tc.Function.Arguments,
					},
				})
			}
		}

		// 处理结束原因
		if resp.Choices[0].FinishReason != "" {
			// 关闭最后一个 content_block
			lastBlockIdx := 0
			if currentToolIndex >= 0 {
				lastBlockIdx = currentToolIndex + 1
			}
			if textBlockOpen || currentToolIndex >= 0 {
				writeSSE("content_block_stop", map[string]interface{}{
					"type":  "content_block_stop",
					"index": lastBlockIdx,
				})
			}

			stopReason := "end_turn"
			switch resp.Choices[0].FinishReason {
			case openai.FinishReasonToolCalls:
				stopReason = "tool_use"
			case openai.FinishReasonLength:
				stopReason = "max_tokens"
			}

			writeSSE("message_delta", map[string]interface{}{
				"type": "message_delta",
				"delta": map[string]interface{}{
					"stop_reason":   stopReason,
					"stop_sequence": nil,
				},
				"usage": map[string]int{"output_tokens": 0},
			})
		}
	}

	writeSSE("message_stop", map[string]string{"type": "message_stop"})
}

func magiMessagesSyncClaude(c *gin.Context, req anthropic.MessagesRequest) {
	apiKey := model.Conf.AI.OpenAI.APIKey
	clientOptions := []anthropic.ClientOption{}
	apiBaseURL := model.Conf.AI.OpenAI.APIBaseURL

	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1")
		cleanURL = strings.TrimRight(cleanURL, "/")
		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}
		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	client := anthropic.NewClient(apiKey, clientOptions...)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(model.Conf.AI.OpenAI.APITimeout)*time.Second)
	defer cancel()

	resp, err := client.CreateMessages(ctx, req)
	if err != nil {
		logging.LogErrorf("magiMessagesSyncClaude CreateMessages failed: %s", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func magiMessagesStreamClaude(c *gin.Context, req anthropic.MessagesRequest) {
	apiKey := model.Conf.AI.OpenAI.APIKey
	clientOptions := []anthropic.ClientOption{}
	apiBaseURL := model.Conf.AI.OpenAI.APIBaseURL

	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1")
		cleanURL = strings.TrimRight(cleanURL, "/")
		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}
		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	client := anthropic.NewClient(apiKey, clientOptions...)
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(model.Conf.AI.OpenAI.APITimeout)*time.Second)
	defer cancel()

	// 原生转发流式
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	writeSSE := func(event string, data string) {
		if event != "" {
			_, _ = io.WriteString(c.Writer, "event: "+event+"\n")
		}
		_, _ = io.WriteString(c.Writer, "data: "+data+"\n\n")
		c.Writer.Flush()
	}

	streamReq := anthropic.MessagesStreamRequest{
		MessagesRequest: req,
		OnMessageStart: func(data anthropic.MessagesEventMessageStartData) {
			b, _ := json.Marshal(data)
			writeSSE("message_start", string(b))
		},
		OnContentBlockStart: func(data anthropic.MessagesEventContentBlockStartData) {
			b, _ := json.Marshal(data)
			writeSSE("content_block_start", string(b))
		},
		OnContentBlockDelta: func(data anthropic.MessagesEventContentBlockDeltaData) {
			b, _ := json.Marshal(data)
			writeSSE("content_block_delta", string(b))
		},
		OnContentBlockStop: func(data anthropic.MessagesEventContentBlockStopData, content anthropic.MessageContent) {
			b, _ := json.Marshal(data)
			writeSSE("content_block_stop", string(b))
		},
		OnMessageDelta: func(data anthropic.MessagesEventMessageDeltaData) {
			b, _ := json.Marshal(data)
			writeSSE("message_delta", string(b))
		},
		OnMessageStop: func(data anthropic.MessagesEventMessageStopData) {
			b, _ := json.Marshal(data)
			writeSSE("message_stop", string(b))
		},
		OnError: func(errResp anthropic.ErrorResponse) {
			logging.LogErrorf("magiMessagesStreamClaude OnError: %+v", errResp)
			b, _ := json.Marshal(errResp)
			writeSSE("error", string(b))
		},
	}

	_, err := client.CreateMessagesStream(ctx, streamReq)
	if err != nil {
		logging.LogErrorf("magiMessagesStreamClaude CreateMessagesStream error: %s", err)
		// 如果还没响应过，可以发错误事件，但此时 HTTP 头可能已写
		return
	}
}
