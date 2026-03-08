// Package llm 提供MAGI系统的LLM客户端封装
package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// Client MAGI LLM客户端接口
type Client interface {
	// SendChatRequest 发送聊天请求（流式）
	SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error)

	// SendChatRequestSync 发送聊天请求（同步）
	SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (string, error)
}

// Config LLM客户端配置
type Config struct {
	Provider    string // "OpenAI" | "Claude" | "Azure"
	APIKey      string
	APIBaseURL  string
	APIProxy    string
	APIModel    string
	MaxTokens   int
	Temperature float64
	Timeout     int
	UserAgent   string
	APIVersion  string // Azure专用
}

// NewClient 创建LLM客户端
func NewClient(cfg *Config) Client {
	if cfg.Provider == "Claude" {
		return &claudeClient{config: cfg}
	}
	return &openaiClient{
		config: cfg,
		client: util.NewOpenAIClient(
			cfg.APIKey,
			cfg.APIProxy,
			cfg.APIBaseURL,
			cfg.UserAgent,
			cfg.APIVersion,
			cfg.Provider,
		),
	}
}

// NewClientFromConf 从全局配置创建客户端
func NewClientFromConf(aiConf *conf.OpenAI) Client {
	cfg := &Config{
		Provider:    aiConf.APIProvider,
		APIKey:      aiConf.APIKey,
		APIBaseURL:  aiConf.APIBaseURL,
		APIProxy:    aiConf.APIProxy,
		APIModel:    aiConf.APIModel,
		MaxTokens:   aiConf.APIMaxTokens,
		Temperature: aiConf.APITemperature,
		Timeout:     aiConf.APITimeout,
		UserAgent:   aiConf.APIUserAgent,
		APIVersion:  aiConf.APIVersion,
	}
	return NewClient(cfg)
}

// openaiClient OpenAI客户端实现
type openaiClient struct {
	config *Config
	client *openai.Client
}

func (c *openaiClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error) {
	reqMsgs := convertToOpenAIMessages(messages)

	req := openai.ChatCompletionRequest{
		Model:               c.config.APIModel,
		Messages:            reqMsgs,
		MaxCompletionTokens: c.config.MaxTokens,
		Temperature:         float32(c.config.Temperature),
		Tools:               tools,
		Stream:              true,
	}

	stream, err := c.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create stream failed: %w", err)
	}

	chunkChan := make(chan types.StreamChunk, 10)

	go func() {
		defer close(chunkChan)
		defer stream.Close()

		for {
			response, err := stream.Recv()
			if err != nil {
				return
			}

			if len(response.Choices) == 0 {
				continue
			}

			choice := response.Choices[0]
			var finishReason *string
			if choice.FinishReason != "" {
				fr := string(choice.FinishReason)
				finishReason = &fr
			}

			chunk := types.StreamChunk{
				ID:      response.ID,
				Object:  response.Object,
				Created: response.Created,
				Model:   response.Model,
				Choices: []types.ChunkChoice{{
					Index: choice.Index,
					Delta: types.ChunkDelta{
						Role:    choice.Delta.Role,
						Content: choice.Delta.Content,
					},
					FinishReason: finishReason,
				}},
			}

			// 转换tool_calls
			if len(choice.Delta.ToolCalls) > 0 {
				var toolCallDeltas []types.ToolCallDelta
				for _, tc := range choice.Delta.ToolCalls {
					delta := types.ToolCallDelta{
						ID:   tc.ID,
						Type: string(tc.Type),
					}
					if tc.Index != nil {
						delta.Index = *tc.Index
					}
					if tc.Function.Name != "" || tc.Function.Arguments != "" {
						delta.Function = &types.ToolCallFunctionDelta{
							Name:      tc.Function.Name,
							Arguments: tc.Function.Arguments,
						}
					}
					toolCallDeltas = append(toolCallDeltas, delta)
				}
				chunk.Choices[0].Delta.ToolCalls = toolCallDeltas
			}

			select {
			case chunkChan <- chunk:
			case <-ctx.Done():
				return
			}
		}
	}()

	return chunkChan, nil
}

func (c *openaiClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (string, error) {
	reqMsgs := convertToOpenAIMessages(messages)

	req := openai.ChatCompletionRequest{
		Model:               c.config.APIModel,
		Messages:            reqMsgs,
		MaxCompletionTokens: c.config.MaxTokens,
		Temperature:         float32(c.config.Temperature),
		Tools:               tools,
	}

	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return "", fmt.Errorf("create completion failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("no response choices")
	}

	return resp.Choices[0].Message.Content, nil
}

// claudeClient Claude客户端实现
type claudeClient struct {
	config *Config
}

func (c *claudeClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (<-chan types.StreamChunk, error) {
	return nil, fmt.Errorf("claude streaming not implemented yet")
}

func (c *claudeClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool) (string, error) {
	reqMsgs := convertToOpenAIMessages(messages)

	ret, _, err := util.CallClaudeChatCompletionMagi(
		reqMsgs,
		c.config.APIModel,
		c.config.MaxTokens,
		c.config.Temperature,
		c.config.Timeout,
		c.config.APIKey,
		c.config.APIProxy,
		c.config.APIBaseURL,
	)

	return ret, err
}

// convertToOpenAIMessages 转换MAGI消息为OpenAI格式
func convertToOpenAIMessages(messages []types.ContextMessage) []openai.ChatCompletionMessage {
	var result []openai.ChatCompletionMessage

	for _, msg := range messages {
		oaiMsg := openai.ChatCompletionMessage{
			Role:    string(msg.Role),
			Content: msg.Content,
		}

		// 转换tool_calls
		if len(msg.ToolCalls) > 0 {
			var toolCalls []openai.ToolCall
			for _, tc := range msg.ToolCalls {
				toolCalls = append(toolCalls, openai.ToolCall{
					ID:   tc.ID,
					Type: openai.ToolType(tc.Type),
					Function: openai.FunctionCall{
						Name:      tc.Function.Name,
						Arguments: tc.Function.Arguments,
					},
				})
			}
			oaiMsg.ToolCalls = toolCalls
		}

		// tool消息需要设置ToolCallID
		if msg.Role == types.RoleTool {
			oaiMsg.ToolCallID = msg.ToolID
		}

		result = append(result, oaiMsg)
	}

	return result
}

// SessionContext 会话级别的上下文管理器
type SessionContext struct {
	messages []types.ContextMessage
}

// NewSessionContext 创建新的会话上下文
func NewSessionContext() *SessionContext {
	return &SessionContext{
		messages: make([]types.ContextMessage, 0),
	}
}

// AddMessage 添加消息到上下文
func (s *SessionContext) AddMessage(msg types.ContextMessage) {
	s.messages = append(s.messages, msg)
}

// GetMessages 获取所有消息
func (s *SessionContext) GetMessages() []types.ContextMessage {
	return s.messages
}

// Clear 清空上下文
func (s *SessionContext) Clear() {
	s.messages = make([]types.ContextMessage, 0)
}

// Limit 限制上下文消息数量（保留最近的n条）
func (s *SessionContext) Limit(maxMessages int) {
	if len(s.messages) > maxMessages {
		s.messages = s.messages[len(s.messages)-maxMessages:]
	}
}

// ProcessStreamResponse 处理流式响应并收集完整结果
func ProcessStreamResponse(ctx context.Context, chunkChan <-chan types.StreamChunk) (*types.StreamResult, error) {
	result := &types.StreamResult{
		Success:             true,
		ToolArgumentsByName: make(map[string][]string),
	}

	var contentBuilder string
	toolCallsMap := make(map[int]*types.ToolCall)

	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				result.Content = contentBuilder
				return result, nil
			}

			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]

			// 收集文本内容
			if choice.Delta.Content != "" {
				contentBuilder += choice.Delta.Content
			}

			// 收集tool_calls
			for _, tcDelta := range choice.Delta.ToolCalls {
				tc, exists := toolCallsMap[tcDelta.Index]
				if !exists {
					tc = &types.ToolCall{
						ID:    tcDelta.ID,
						Type:  tcDelta.Type,
						Index: tcDelta.Index,
						Function: types.ToolCallFunction{
							Name:      "",
							Arguments: "",
						},
					}
					toolCallsMap[tcDelta.Index] = tc
				}

				if tcDelta.Function != nil {
					if tcDelta.Function.Name != "" {
						tc.Function.Name = tcDelta.Function.Name
					}
					if tcDelta.Function.Arguments != "" {
						tc.Function.Arguments += tcDelta.Function.Arguments
					}
				}
			}

			// 检查finish_reason
			if choice.FinishReason != nil && *choice.FinishReason == "tool_calls" {
				result.HasToolCalls = true
			}

		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// BuildToolResultMessage 构建工具调用结果消息
func BuildToolResultMessage(toolCallID string, result interface{}) types.ContextMessage {
	resultJSON, _ := json.Marshal(result)
	return types.ContextMessage{
		Role:    types.RoleTool,
		Content: string(resultJSON),
		ToolID:  toolCallID,
	}
}

// CreateTimeoutContext 创建带超时的上下文
func CreateTimeoutContext(timeoutSeconds int) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
}
