package util

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
)

// CallClaudeChatCompletion 通过 go-anthropic/v2 桥接调用 Claude 兼容接口
func CallClaudeChatCompletion(msg string, contextMsgs []string, modelName string, maxTokens int, temperature float64, timeout int, apiKey, apiProxy, apiBaseURL string) (ret string, stop bool, err error) {

	// 1. 初始化 Anthropic Client
	clientOptions := []anthropic.ClientOption{}
	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1")
		cleanURL = strings.TrimRight(cleanURL, "/")

		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}

		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	transport := &http.Transport{}
	if apiProxy != "" {
		if proxyUrl, pErr := url.Parse(apiProxy); pErr == nil {
			transport.Proxy = http.ProxyURL(proxyUrl)
		} else {
			logging.LogErrorf("Claude API proxy parse failed: %v", pErr)
		}
	}
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   time.Duration(timeout) * time.Second,
	}
	clientOptions = append(clientOptions, anthropic.WithHTTPClient(httpClient))

	client := anthropic.NewClient(apiKey, clientOptions...)

	// 2. 组装 Message 历史
	var reqMsgs []anthropic.Message
	for _, ctxMsg := range contextMsgs {
		if "" == ctxMsg {
			continue
		}
		// 默认简化为用户角色；在完整的 Claude API 中，往往要求 u/a 相间。
		// 这里暂以单方面的信息输入为准，由于 ChatGPT 原实现也全部为 role: user
		reqMsgs = append(reqMsgs, anthropic.NewUserTextMessage(ctxMsg))
	}

	if "" != msg {
		reqMsgs = append(reqMsgs, anthropic.NewUserTextMessage(msg))
	}

	if len(reqMsgs) < 1 {
		stop = true
		return
	}

	if maxTokens == 0 {
		maxTokens = 4096 // Claude 强制要求 MaxTokens，给个默认值
	}

	tempVar := float32(temperature)
	// 3. 构建请求体
	req := anthropic.MessagesRequest{
		Model:       anthropic.Model(modelName),
		Messages:    reqMsgs,
		MaxTokens:   maxTokens,
		Temperature: &tempVar,
	}

	// 4. 发起请求
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	resp, invokeErr := client.CreateMessages(ctx, req)
	if invokeErr != nil {
		PushErrMsg("Requesting Claude failed, please check kernel log for more details", 3000)
		logging.LogErrorf("create claude message failed: %s", invokeErr)
		stop = true
		err = invokeErr
		return
	}

	if len(resp.Content) < 1 {
		stop = true
		return
	}

	// 5. 组装结果（抹平差异）
	buf := &strings.Builder{}
	for _, c := range resp.Content {
		if c.Type == anthropic.MessagesContentTypeText {
			buf.WriteString(*c.Text)
		}
	}

	if resp.StopReason == anthropic.MessagesStopReasonMaxTokens || resp.StopReason == "length" {
		stop = false
	} else {
		stop = true
	}

	ret = buf.String()
	ret = strings.TrimSpace(ret)
	return
}

// CallClaudeChatCompletionMagi 是专供 MAGI 等传递了完整 []openai.ChatCompletionMessage 的拦截使用
func CallClaudeChatCompletionMagi(reqMsgs []openai.ChatCompletionMessage, modelName string, maxTokens int, temperature float64, timeout int, apiKey, apiProxy, apiBaseURL string) (ret string, stop bool, err error) {

	clientOptions := []anthropic.ClientOption{}
	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimRight(cleanURL, "/")

		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}

		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	transport := &http.Transport{}
	if apiProxy != "" {
		if proxyUrl, pErr := url.Parse(apiProxy); pErr == nil {
			transport.Proxy = http.ProxyURL(proxyUrl)
		}
	}
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   time.Duration(timeout) * time.Second,
	}
	clientOptions = append(clientOptions, anthropic.WithHTTPClient(httpClient))

	client := anthropic.NewClient(apiKey, clientOptions...)

	var claudeMsgs []anthropic.Message
	for _, m := range reqMsgs {
		role := anthropic.RoleUser
		if m.Role == openai.ChatMessageRoleAssistant {
			role = anthropic.RoleAssistant
		}
		claudeMsgs = append(claudeMsgs, anthropic.Message{
			Role: role,
			Content: []anthropic.MessageContent{
				anthropic.NewTextMessageContent(m.Content),
			},
		})
	}

	if len(claudeMsgs) < 1 {
		stop = true
		return
	}
	if maxTokens == 0 {
		maxTokens = 4096
	}

	tempVar := float32(temperature)
	req := anthropic.MessagesRequest{
		Model:       anthropic.Model(modelName),
		Messages:    claudeMsgs,
		MaxTokens:   maxTokens,
		Temperature: &tempVar,
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	resp, invokeErr := client.CreateMessages(ctx, req)
	if invokeErr != nil {
		err = invokeErr
		stop = true
		return
	}

	if len(resp.Content) < 1 {
		stop = true
		return
	}

	buf := &strings.Builder{}
	for _, c := range resp.Content {
		if c.Type == anthropic.MessagesContentTypeText {
			buf.WriteString(*c.Text)
		}
	}

	if resp.StopReason == anthropic.MessagesStopReasonMaxTokens || resp.StopReason == "length" {
		stop = false
	} else {
		stop = true
	}

	ret = buf.String()
	ret = strings.TrimSpace(ret)
	return
}

// CallClaudeChatCompletionStreamMagi 使用 go-anthropic/v2 原生流式接口，
// 将 Claude 的增量文本和 tool_use 实时转译为 OpenAI 兼容的 SSE chunk。
// 支持完整的 OpenAI ↔ Claude tool_use 协议双向转换。
func CallClaudeChatCompletionStreamMagi(c *gin.Context, reqMsgs []openai.ChatCompletionMessage, tools []openai.Tool, modelName string, maxTokens int, temperature float64, timeout int, apiKey, apiProxy, apiBaseURL string) error {

	// 辅助函数：写入标准 OpenAI 格式的 SSE 数据行 "data: xxx\n\n"
	// gin-contrib/sse 编码器未在 data: 后加空格，导致 ChatBox 等客户端解析失败
	writeSSE := func(data string) {
		_, _ = io.WriteString(c.Writer, "data: "+data+"\n\n")
		c.Writer.Flush()
	}
	clientOptions := []anthropic.ClientOption{}
	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimRight(cleanURL, "/")
		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL = cleanURL + "/v1"
		}
		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	transport := &http.Transport{}
	if apiProxy != "" {
		if proxyUrl, pErr := url.Parse(apiProxy); pErr == nil {
			transport.Proxy = http.ProxyURL(proxyUrl)
		}
	}
	httpClient := &http.Client{
		Transport: transport,
		Timeout:   time.Duration(timeout) * time.Second,
	}
	clientOptions = append(clientOptions, anthropic.WithHTTPClient(httpClient))
	client := anthropic.NewClient(apiKey, clientOptions...)

	// === 转换消息格式 ===
	// Claude API 要求: system 走独立字段, 不能有连续相同角色, 必须以 user 开头
	var systemPrompt string
	var claudeMsgs []anthropic.Message
	for _, m := range reqMsgs {
		// --- system 消息 ---
		if m.Role == openai.ChatMessageRoleSystem {
			if m.Content != "" {
				if systemPrompt != "" {
					systemPrompt += "\n\n"
				}
				systemPrompt += m.Content
			}
			continue
		}

		// --- tool 结果消息 (OpenAI role:"tool" → Claude role:user + tool_result) ---
		if m.Role == openai.ChatMessageRoleTool {
			toolContent := anthropic.NewToolResultMessageContent(m.ToolCallID, m.Content, false)
			// tool_result 在 Claude 里必须是 user 角色
			if len(claudeMsgs) > 0 && claudeMsgs[len(claudeMsgs)-1].Role == anthropic.RoleUser {
				claudeMsgs[len(claudeMsgs)-1].Content = append(claudeMsgs[len(claudeMsgs)-1].Content, toolContent)
			} else {
				claudeMsgs = append(claudeMsgs, anthropic.Message{
					Role:    anthropic.RoleUser,
					Content: []anthropic.MessageContent{toolContent},
				})
			}
			continue
		}

		// --- assistant 消息 (可能带 tool_calls) ---
		if m.Role == openai.ChatMessageRoleAssistant {
			var contents []anthropic.MessageContent
			if m.Content != "" {
				contents = append(contents, anthropic.NewTextMessageContent(m.Content))
			}
			// 将 OpenAI 的 tool_calls 转为 Claude 的 tool_use content blocks
			for _, tc := range m.ToolCalls {
				contents = append(contents, anthropic.NewToolUseMessageContent(
					tc.ID, tc.Function.Name, json.RawMessage(tc.Function.Arguments),
				))
			}
			if len(contents) > 0 {
				if len(claudeMsgs) > 0 && claudeMsgs[len(claudeMsgs)-1].Role == anthropic.RoleAssistant {
					claudeMsgs[len(claudeMsgs)-1].Content = append(claudeMsgs[len(claudeMsgs)-1].Content, contents...)
				} else {
					claudeMsgs = append(claudeMsgs, anthropic.Message{
						Role:    anthropic.RoleAssistant,
						Content: contents,
					})
				}
			}
			continue
		}

		// --- user 消息 ---
		if m.Content == "" {
			continue
		}
		if len(claudeMsgs) > 0 && claudeMsgs[len(claudeMsgs)-1].Role == anthropic.RoleUser {
			claudeMsgs[len(claudeMsgs)-1].Content = append(claudeMsgs[len(claudeMsgs)-1].Content, anthropic.NewTextMessageContent(m.Content))
		} else {
			claudeMsgs = append(claudeMsgs, anthropic.Message{
				Role:    anthropic.RoleUser,
				Content: []anthropic.MessageContent{anthropic.NewTextMessageContent(m.Content)},
			})
		}
	}

	// 确保消息列表以 user 角色开头（Claude 硬性要求）
	if len(claudeMsgs) > 0 && claudeMsgs[0].Role != anthropic.RoleUser {
		claudeMsgs = append([]anthropic.Message{{
			Role:    anthropic.RoleUser,
			Content: []anthropic.MessageContent{anthropic.NewTextMessageContent("(continued)")},
		}}, claudeMsgs...)
	}

	if len(claudeMsgs) < 1 {
		return fmt.Errorf("no messages to send")
	}
	if maxTokens == 0 {
		maxTokens = 4096
	}

	// === 转换工具定义 (OpenAI tools → Claude ToolDefinition) ===
	var claudeTools []anthropic.ToolDefinition
	for _, t := range tools {
		if t.Type == openai.ToolTypeFunction && t.Function != nil {
			claudeTools = append(claudeTools, anthropic.ToolDefinition{
				Name:        t.Function.Name,
				Description: t.Function.Description,
				InputSchema: t.Function.Parameters, // json.RawMessage/any 直透
			})
		}
	}

	tempVar := float32(temperature)
	chatID := fmt.Sprintf("chatcmpl-magi-%d", time.Now().UnixNano())

	// === 写入 SSE 头 ===
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	// === 流式请求状态追踪 ===
	// 当 Claude 返回 tool_use 时，需要在 content_block_start 记录工具 ID/Name，
	// 在后续的 input_json_delta 中逐步拼装参数，最后在 content_block_stop 时完成。
	type toolCallState struct {
		id   string
		name string
	}
	var currentToolCall *toolCallState
	toolCallIndex := 0

	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	streamReq := anthropic.MessagesStreamRequest{
		MessagesRequest: anthropic.MessagesRequest{
			Model:       anthropic.Model(modelName),
			Messages:    claudeMsgs,
			MaxTokens:   maxTokens,
			Temperature: &tempVar,
			System:      systemPrompt,
			Tools:       claudeTools,
		},
		// 第一个 chunk 声明 role
		OnMessageStart: func(data anthropic.MessagesEventMessageStartData) {
			roleChunk := gin.H{
				"id":      chatID,
				"object":  "chat.completion.chunk",
				"created": time.Now().Unix(),
				"model":   modelName,
				"choices": []gin.H{
					{
						"index": 0,
						"delta": gin.H{
							"role":    "assistant",
							"content": "",
						},
						"finish_reason": nil,
					},
				},
			}
			roleBytes, _ := json.Marshal(roleChunk)
			writeSSE(string(roleBytes))
		},
		// content_block_start: 可能是 text 或 tool_use
		OnContentBlockStart: func(data anthropic.MessagesEventContentBlockStartData) {
			if data.ContentBlock.Type == anthropic.MessagesContentTypeToolUse && data.ContentBlock.MessageContentToolUse != nil {
				// 开始一个新的 tool_use block
				currentToolCall = &toolCallState{
					id:   data.ContentBlock.MessageContentToolUse.ID,
					name: data.ContentBlock.MessageContentToolUse.Name,
				}
				// 发送 tool_calls 的开始 chunk（OpenAI 格式）
				chunk := gin.H{
					"id":      chatID,
					"object":  "chat.completion.chunk",
					"created": time.Now().Unix(),
					"model":   modelName,
					"choices": []gin.H{
						{
							"index": 0,
							"delta": gin.H{
								"tool_calls": []gin.H{
									{
										"index": toolCallIndex,
										"id":    currentToolCall.id,
										"type":  "function",
										"function": gin.H{
											"name":      currentToolCall.name,
											"arguments": "",
										},
									},
								},
							},
							"finish_reason": nil,
						},
					},
				}
				chunkBytes, _ := json.Marshal(chunk)
				writeSSE(string(chunkBytes))
			}
		},
		// content_block_delta: 文本增量 或 tool 参数增量
		OnContentBlockDelta: func(data anthropic.MessagesEventContentBlockDeltaData) {
			// 纯文本增量
			if data.Delta.Text != nil {
				chunk := gin.H{
					"id":      chatID,
					"object":  "chat.completion.chunk",
					"created": time.Now().Unix(),
					"model":   modelName,
					"choices": []gin.H{
						{
							"index": 0,
							"delta": gin.H{
								"content": *data.Delta.Text,
							},
							"finish_reason": nil,
						},
					},
				}
				chunkBytes, _ := json.Marshal(chunk)
				writeSSE(string(chunkBytes))
			}
			// tool 参数 JSON 增量 (input_json_delta)
			if data.Delta.PartialJson != nil && currentToolCall != nil {
				chunk := gin.H{
					"id":      chatID,
					"object":  "chat.completion.chunk",
					"created": time.Now().Unix(),
					"model":   modelName,
					"choices": []gin.H{
						{
							"index": 0,
							"delta": gin.H{
								"tool_calls": []gin.H{
									{
										"index": toolCallIndex,
										"function": gin.H{
											"arguments": *data.Delta.PartialJson,
										},
									},
								},
							},
							"finish_reason": nil,
						},
					},
				}
				chunkBytes, _ := json.Marshal(chunk)
				writeSSE(string(chunkBytes))
			}
		},
		// content_block_stop: tool_use block 完成
		OnContentBlockStop: func(data anthropic.MessagesEventContentBlockStopData, content anthropic.MessageContent) {
			if currentToolCall != nil {
				toolCallIndex++
				currentToolCall = nil
			}
		},
		// 消息结束
		OnMessageDelta: func(data anthropic.MessagesEventMessageDeltaData) {
			finishReason := "stop"
			if data.Delta.StopReason == anthropic.MessagesStopReasonToolUse {
				finishReason = "tool_calls"
			}
			doneChunk := gin.H{
				"id":      chatID,
				"object":  "chat.completion.chunk",
				"created": time.Now().Unix(),
				"model":   modelName,
				"choices": []gin.H{
					{
						"index":         0,
						"delta":         gin.H{},
						"finish_reason": finishReason,
					},
				},
			}
			doneBytes, _ := json.Marshal(doneChunk)
			writeSSE(string(doneBytes))
		},
		OnMessageStop: func(data anthropic.MessagesEventMessageStopData) {
			writeSSE("[DONE]")
		},
		OnError: func(errResp anthropic.ErrorResponse) {
			logging.LogErrorf("Claude stream error: %+v", errResp)
		},
	}

	_, err := client.CreateMessagesStream(ctx, streamReq)
	if err != nil {
		logging.LogErrorf("CallClaudeChatCompletionStreamMagi failed: %s", err)
		errData, _ := json.Marshal(gin.H{"error": err.Error()})
		writeSSE(string(errData))
		return err
	}

	return nil
}
