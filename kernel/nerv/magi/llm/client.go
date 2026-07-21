// Package llm 提供MAGI系统的LLM客户端封装
package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/conf"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
	"github.com/siyuan-note/siyuan/kernel/util/stream"
)

// Client MAGI LLM客户端接口
type Client interface {
	// SendChatRequest 发送聊天请求（流式）
	// toolChoice 控制模型的工具调用行为，可选值：nil(默认auto)、"required"、"none"、
	// 或 openai.ToolChoice{Type:"function", Function:openai.ToolFunction{Name:"xxx"}} 强制指定工具。
	SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error)

	// SendChatRequestSync 发送聊天请求（同步）
	SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error)

	// SendChatRequestSyncDetailed 发送聊天请求（同步，返回结构化结果）
	SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error)

	// GetModel 获取模型名称
	GetModel() string
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

	OmitToolChoice bool
}

// NewClient 创建LLM客户端
func NewClient(cfg *Config) Client {
	if cfg.Provider == "Claude" {
		if isOpencodeAIURL(cfg.APIBaseURL) {
			ocfg := *cfg
			ocfg.APIBaseURL = toOaCompatURL(cfg.APIBaseURL)
			ocfg.OmitToolChoice = true
			return newOpenAIClient(&ocfg)
		}
		if isDeepSeekAnthropicURL(cfg.APIBaseURL) {
			ocfg := *cfg
			ocfg.APIBaseURL = deepSeekToOaURL(cfg.APIBaseURL)
			ocfg.OmitToolChoice = true
			return newOpenAIClient(&ocfg)
		}
		return &claudeClient{config: cfg}
	}
	return newOpenAIClient(cfg)
}

func isOpencodeAIURL(raw string) bool {
	return strings.Contains(strings.ToLower(raw), "opencode.ai")
}

func toOaCompatURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	clean := strings.TrimRight(raw, "/")
	clean, _ = strings.CutSuffix(clean, "/messages")
	return clean
}

func isDeepSeekAnthropicURL(raw string) bool {
	lower := strings.ToLower(raw)
	return strings.Contains(lower, "deepseek.com") && strings.Contains(lower, "/anthropic")
}

func deepSeekToOaURL(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	clean := strings.TrimRight(raw, "/")
	clean, _ = strings.CutSuffix(clean, "/messages")
	clean, _ = strings.CutSuffix(clean, "/v1")
	clean = strings.TrimRight(clean, "/")
	if idx := strings.Index(clean, "/anthropic"); idx >= 0 {
		clean = clean[:idx]
	}
	clean = strings.TrimRight(clean, "/")
	if !strings.HasSuffix(clean, "/v1") {
		clean += "/v1"
	}
	return clean
}

func newOpenAIClient(cfg *Config) *openaiClient {
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

// NewClientFromConf 从全局配置创建客户端（兼容旧版）
func NewClientFromConf(aiConf *conf.OpenAI, effectiveProxy ...string) Client {
	apiProxy := aiConf.APIProxy
	if len(effectiveProxy) > 0 {
		apiProxy = effectiveProxy[0]
	}
	cfg := &Config{
		Provider:    aiConf.APIProvider,
		APIKey:      aiConf.APIKey,
		APIBaseURL:  aiConf.APIBaseURL,
		APIProxy:    apiProxy,
		APIModel:    aiConf.APIModel,
		MaxTokens:   aiConf.APIMaxTokens,
		Temperature: aiConf.APITemperature,
		Timeout:     aiConf.APITimeout,
		UserAgent:   aiConf.APIUserAgent,
		APIVersion:  aiConf.APIVersion,
	}
	return NewClient(cfg)
}

// NewClientFromProvider 从 Provider 配置创建客户端，替代 NewClientFromConf。
func NewClientFromProvider(provider *conf.Provider, model *conf.Model, userAgent, apiProxy string) Client {
	cfg := &Config{
		APIKey:     provider.APIKey,
		APIBaseURL: provider.BaseURL,
		APIProxy:   apiProxy,
		APIModel:   model.Name,
		Timeout:    provider.RequestTimeout,
		UserAgent:  userAgent,
	}
	return NewClient(cfg)
}

// openaiClient OpenAI客户端实现
type openaiClient struct {
	config *Config
	client *openai.Client
}

func (c *openaiClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	reqMsgs := convertToOpenAIMessages(messages)

	tc := toolChoice
	if c.config.OmitToolChoice {
		tc = nil
	}
	req := openai.ChatCompletionRequest{
		Model:               c.config.APIModel,
		Messages:            reqMsgs,
		MaxCompletionTokens: c.config.MaxTokens,
		Temperature:         float32(c.config.Temperature),
		Tools:               tools,
		ToolChoice:          tc,
		Stream:              true,
	}

	stream, err := c.client.CreateChatCompletionStream(ctx, req)
	if err != nil {
		// 失败时打印完整消息序列用于诊断
		if debugJSON, jsonErr := json.MarshalIndent(reqMsgs, "", "  "); jsonErr == nil {
			fmt.Printf("\n[LLM Client Error] API request failed: %v\n", err)
			fmt.Printf("[LLM Client Debug] Messages sent to API:\n%s\n\n", string(debugJSON))
		}
		return nil, fmt.Errorf("create stream failed: %w", err)
	}

	return c.startChunkProcessor(ctx, stream), nil
}

func (c *openaiClient) startChunkProcessor(ctx context.Context, stream *openai.ChatCompletionStream) <-chan types.StreamChunk {

	chunkChan := make(chan types.StreamChunk, 10)

	go func() {
		defer close(chunkChan)
		defer stream.Close()

		for {
			response, err := stream.Recv()
			if err != nil {
				if err == io.EOF {
					return
				}
				// 将流错误显式透传给上游，避免静默吞掉失败。
				select {
				case chunkChan <- types.StreamChunk{
					ID:     err.Error(),
					Object: "error",
					Model:  c.config.APIModel,
				}:
				case <-ctx.Done():
				}
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
						Role:             choice.Delta.Role,
						Content:          choice.Delta.Content,
						ReasoningContent: choice.Delta.ReasoningContent,
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

	return chunkChan
}

func (c *openaiClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	result, err := c.SendChatRequestSyncDetailed(ctx, messages, tools, toolChoice)
	if err != nil {
		return "", err
	}
	if result == nil {
		return "", fmt.Errorf("sync chat result is nil")
	}
	return result.Content, nil
}

func (c *openaiClient) SendChatRequestSyncDetailed(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (*types.SyncChatResult, error) {
	reqMsgs := convertToOpenAIMessages(messages)

	tc := toolChoice
	if c.config.OmitToolChoice {
		tc = nil
	}
	req := openai.ChatCompletionRequest{
		Model:               c.config.APIModel,
		Messages:            reqMsgs,
		MaxCompletionTokens: c.config.MaxTokens,
		Temperature:         float32(c.config.Temperature),
		Tools:               tools,
		ToolChoice:          tc,
	}

	resp, err := c.client.CreateChatCompletion(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("create completion failed: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, fmt.Errorf("no response choices")
	}

	choice := resp.Choices[0]
	result := &types.SyncChatResult{
		Content:          choice.Message.Content,
		ReasoningContent: choice.Message.ReasoningContent,
		ToolCalls:        convertOpenAIToolCalls(choice.Message.ToolCalls),
		FinishReason:     string(choice.FinishReason),
	}
	return result, nil
}

func (c *openaiClient) GetModel() string {
	return c.config.APIModel
}

// claudeClient Claude客户端实现
type claudeClient struct {
	config *Config
}

func (c *claudeClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	result, err := c.SendChatRequestSyncDetailed(ctx, messages, tools, toolChoice)
	if err != nil {
		return "", err
	}
	if result == nil {
		return "", fmt.Errorf("sync chat result is nil")
	}
	return result.Content, nil
}

func (c *claudeClient) GetModel() string {
	return c.config.APIModel
}

// convertToOpenAIMessages 转换MAGI消息为OpenAI格式
func convertToOpenAIMessages(messages []types.ContextMessage) []openai.ChatCompletionMessage {
	var result []openai.ChatCompletionMessage

	for _, msg := range messages {
		reasoningContent := msg.ReasoningContent
		// DeepSeek thinking mode requires reasoning_content to be present
		// for ALL assistant messages (not just those with tool_calls).
		// Wakeup sequence echoes and previous plain-text replies must
		// include the field; otherwise DeepSeek rejects the request with
		// "The reasoning_content in the thinking mode must be passed back".
		if reasoningContent == "" && msg.Role == types.RoleAssistant {
			reasoningContent = " "
		}

		oaiMsg := openai.ChatCompletionMessage{
			Role:             string(msg.Role),
			Content:          msg.Content,
			ReasoningContent: reasoningContent,
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

func convertOpenAIToolCalls(toolCalls []openai.ToolCall) []types.ToolCall {
	if len(toolCalls) == 0 {
		return nil
	}

	converted := make([]types.ToolCall, 0, len(toolCalls))
	for index, toolCall := range toolCalls {
		converted = append(converted, types.ToolCall{
			ID:    toolCall.ID,
			Type:  string(toolCall.Type),
			Index: index,
			Function: types.ToolCallFunction{
				Name:      toolCall.Function.Name,
				Arguments: toolCall.Function.Arguments,
			},
		})
	}
	return converted
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
// Deprecated: 建议直接使用 util/stream.Processor 以获得更好的灵活性
func ProcessStreamResponse(ctx context.Context, chunkChan <-chan types.StreamChunk) (*types.StreamResult, error) {
	// 使用通用处理器
	processor := stream.NewProcessor()

	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				// 转换结果类型
				utilResult := processor.GetResult(true)
				return convertStreamResult(utilResult), nil
			}

			if len(chunk.Choices) == 0 {
				continue
			}

			choice := chunk.Choices[0]

			// 累积内容
			processor.AccumulateContent(choice.Delta.Content)

			// 转换并合并工具调用
			if len(choice.Delta.ToolCalls) > 0 {
				utilToolCalls := convertToolCallDeltas(choice.Delta.ToolCalls)
				processor.MergeToolCalls(utilToolCalls)
			}

		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
}

// convertToolCallDeltas 转换工具调用增量类型
func convertToolCallDeltas(magiCalls []types.ToolCallDelta) []stream.ToolCallDelta {
	result := make([]stream.ToolCallDelta, len(magiCalls))
	for i, tc := range magiCalls {
		result[i] = stream.ToolCallDelta{
			Index: tc.Index,
			ID:    tc.ID,
			Type:  tc.Type,
		}
		if tc.Function != nil {
			result[i].Function = &stream.ToolCallFunctionDelta{
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			}
		}
	}
	return result
}

// convertStreamResult 转换流式结果类型
func convertStreamResult(utilResult *stream.StreamResult) *types.StreamResult {
	return &types.StreamResult{
		Content:              utilResult.Content,
		Success:              utilResult.Success,
		HasToolCalls:         utilResult.HasToolCalls,
		ToolCallNames:        utilResult.ToolCallNames,
		ToolArgumentsByName:  utilResult.ToolArgumentsByName,
		InternalToolMessages: utilResult.InternalToolMessages,
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
