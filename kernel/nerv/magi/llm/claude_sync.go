package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

var errNoMessages = fmt.Errorf("no messages to send")

func (c *claudeClient) SendChatRequestSyncDetailed(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (*types.SyncChatResult, error) {
	reqMsgs := convertToOpenAIMessages(messages)
	// 单工具路由（MCP 风格）：工具列表尾部化 + tools 字段固定为 magi_tool。
	// Anthropic 的 system 字段位于输入 token 序列最前部，动态工具列表必须作为 user 消息
	// 追加到 messages 尾部（applyMagiToolRoutingForClaude），保证前缀缓存最前部稳定。
	reqMsgs, effectiveTools := applyMagiToolRoutingForClaude(reqMsgs, tools)

	systemPrompt, claudeMsgs, err := convertOpenAIMessagesToClaude(reqMsgs)
	if err != nil {
		return nil, err
	}
	if len(claudeMsgs) == 0 {
		return nil, fmt.Errorf("no messages to send")
	}

	client, err := newAnthropicClient(c.config.APIKey, c.config.APIProxy, c.config.APIBaseURL, c.config.Timeout)
	if err != nil {
		return nil, err
	}

	maxTokens := c.config.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 4096
	}
	tempVar := float32(c.config.Temperature)

	req := anthropic.MessagesRequest{
		Model:       anthropic.Model(c.config.APIModel),
		Messages:    claudeMsgs,
		MaxTokens:   maxTokens,
		Temperature: &tempVar,
		System:      systemPrompt,
		Tools:       convertOpenAIToolsToClaude(effectiveTools),
	}

	tc := toolChoice
	if c.config.OmitToolChoice {
		tc = nil
	}
	claudeToolChoice, err := convertOpenAIToolChoiceToClaude(tc, len(effectiveTools) > 0)
	if err != nil {
		return nil, err
	}
	if claudeToolChoice != nil {
		req.ToolChoice = claudeToolChoice
	}

	resp, err := client.CreateMessages(ctx, req)
	if err != nil {
		return nil, err
	}

	result := convertClaudeResponse(resp)
	// 响应方向：把 magi_tool 调用解析回真实工具名与参数（tool_name 字段 → Function.Name）。
	toolCalls, resolveErr := resolveMagiToolCalls(result.ToolCalls)
	if resolveErr != nil {
		return nil, fmt.Errorf("resolve magi tool call failed: %w", resolveErr)
	}
	result.ToolCalls = toolCalls
	return result, nil
}

func newAnthropicClient(apiKey, apiProxy, apiBaseURL string, timeout int) (*anthropic.Client, error) {
	clientOptions := []anthropic.ClientOption{}
	if apiBaseURL != "" {
		cleanURL := strings.TrimRight(apiBaseURL, "/")
		cleanURL = strings.TrimSuffix(cleanURL, "/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1/messages")
		cleanURL = strings.TrimSuffix(cleanURL, "/v1")
		cleanURL = strings.TrimRight(cleanURL, "/")
		if !strings.HasSuffix(cleanURL, "/v1") {
			cleanURL += "/v1"
		}
		clientOptions = append(clientOptions, anthropic.WithBaseURL(cleanURL))
	}

	transport := &http.Transport{}
	if apiProxy != "" {
		proxyURL, err := url.Parse(apiProxy)
		if err != nil {
			return nil, fmt.Errorf("parse claude api proxy failed: %w", err)
		}
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	httpClient := &http.Client{
		Transport: transport,
		Timeout:   time.Duration(timeout) * time.Second,
	}
	clientOptions = append(clientOptions, anthropic.WithHTTPClient(httpClient))

	client := anthropic.NewClient(apiKey, clientOptions...)
	return client, nil
}

func convertOpenAIMessagesToClaude(
	reqMsgs []openai.ChatCompletionMessage,
) (systemPrompt string, claudeMsgs []anthropic.Message, err error) {
	for _, msg := range reqMsgs {
		switch msg.Role {
		case openai.ChatMessageRoleSystem:
			if strings.TrimSpace(msg.Content) == "" {
				continue
			}
			if systemPrompt != "" {
				systemPrompt += "\n\n"
			}
			systemPrompt += msg.Content
		case openai.ChatMessageRoleTool:
			toolContent := anthropic.NewToolResultMessageContent(msg.ToolCallID, msg.Content, false)
			claudeMsgs = appendClaudeMessageContent(claudeMsgs, anthropic.RoleUser, toolContent)
		case openai.ChatMessageRoleAssistant:
			var contents []anthropic.MessageContent
			if msg.Content != "" {
				contents = append(contents, anthropic.NewTextMessageContent(msg.Content))
			}
			for _, tc := range msg.ToolCalls {
				contents = append(contents, anthropic.NewToolUseMessageContent(
					tc.ID,
					tc.Function.Name,
					json.RawMessage(tc.Function.Arguments),
				))
			}
			if len(contents) == 0 {
				continue
			}
			claudeMsgs = appendClaudeMessageContents(claudeMsgs, anthropic.RoleAssistant, contents...)
		default:
			if strings.TrimSpace(msg.Content) == "" {
				continue
			}
			claudeMsgs = appendClaudeMessageContent(claudeMsgs, anthropic.RoleUser, anthropic.NewTextMessageContent(msg.Content))
		}
	}

	if len(claudeMsgs) > 0 && claudeMsgs[0].Role != anthropic.RoleUser {
		claudeMsgs = append([]anthropic.Message{anthropic.NewUserTextMessage("(continued)")}, claudeMsgs...)
	}
	return systemPrompt, claudeMsgs, nil
}

func appendClaudeMessageContent(
	claudeMsgs []anthropic.Message,
	role anthropic.ChatRole,
	content anthropic.MessageContent,
) []anthropic.Message {
	return appendClaudeMessageContents(claudeMsgs, role, content)
}

func appendClaudeMessageContents(
	claudeMsgs []anthropic.Message,
	role anthropic.ChatRole,
	contents ...anthropic.MessageContent,
) []anthropic.Message {
	if len(contents) == 0 {
		return claudeMsgs
	}
	if len(claudeMsgs) > 0 && claudeMsgs[len(claudeMsgs)-1].Role == role {
		claudeMsgs[len(claudeMsgs)-1].Content = append(claudeMsgs[len(claudeMsgs)-1].Content, contents...)
		return claudeMsgs
	}
	return append(claudeMsgs, anthropic.Message{
		Role:    role,
		Content: append([]anthropic.MessageContent(nil), contents...),
	})
}

func convertOpenAIToolsToClaude(tools []openai.Tool) []anthropic.ToolDefinition {
	if len(tools) == 0 {
		return nil
	}

	converted := make([]anthropic.ToolDefinition, 0, len(tools))
	for _, tool := range tools {
		if tool.Type != openai.ToolTypeFunction || tool.Function == nil {
			continue
		}
		converted = append(converted, anthropic.ToolDefinition{
			Name:        tool.Function.Name,
			Description: tool.Function.Description,
			InputSchema: tool.Function.Parameters,
		})
	}
	return converted
}

func convertOpenAIToolChoiceToClaude(toolChoice any, hasTools bool) (*anthropic.ToolChoice, error) {
	if !hasTools || toolChoice == nil {
		return nil, nil
	}

	switch choice := toolChoice.(type) {
	case string:
		switch strings.ToLower(strings.TrimSpace(choice)) {
		case "", "auto":
			return &anthropic.ToolChoice{Type: "auto"}, nil
		case "required":
			return &anthropic.ToolChoice{Type: "any"}, nil
		case "none":
			return nil, fmt.Errorf("claude sync tool call does not support toolChoice=none")
		default:
			return nil, fmt.Errorf("unsupported toolChoice string: %s", choice)
		}
	case openai.ToolChoice:
		return convertSpecificOpenAIToolChoice(choice.Type, choice.Function.Name)
	case *openai.ToolChoice:
		if choice == nil {
			return nil, nil
		}
		return convertSpecificOpenAIToolChoice(choice.Type, choice.Function.Name)
	case map[string]interface{}:
		return convertMapToolChoiceToClaude(choice)
	default:
		return nil, fmt.Errorf("unsupported toolChoice type: %T", toolChoice)
	}
}

func convertSpecificOpenAIToolChoice(toolType openai.ToolType, toolName string) (*anthropic.ToolChoice, error) {
	if toolType != openai.ToolTypeFunction {
		return nil, fmt.Errorf("unsupported toolChoice type: %s", toolType)
	}
	toolName = strings.TrimSpace(toolName)
	if toolName == "" {
		return nil, fmt.Errorf("toolChoice function name is empty")
	}
	return &anthropic.ToolChoice{
		Type: "tool",
		Name: toolName,
	}, nil
}

func convertMapToolChoiceToClaude(choice map[string]interface{}) (*anthropic.ToolChoice, error) {
	typeValue := strings.TrimSpace(fmt.Sprintf("%v", choice["type"]))
	switch strings.ToLower(typeValue) {
	case "", "auto":
		return &anthropic.ToolChoice{Type: "auto"}, nil
	case "required":
		return &anthropic.ToolChoice{Type: "any"}, nil
	case "none":
		return nil, fmt.Errorf("claude sync tool call does not support toolChoice=none")
	case string(openai.ToolTypeFunction):
		functionValue, ok := choice["function"].(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("toolChoice function payload is invalid")
		}
		name := strings.TrimSpace(fmt.Sprintf("%v", functionValue["name"]))
		if name == "" {
			return nil, fmt.Errorf("toolChoice function name is empty")
		}
		return &anthropic.ToolChoice{
			Type: "tool",
			Name: name,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported toolChoice string: %s", typeValue)
	}
}

func convertClaudeResponse(resp anthropic.MessagesResponse) *types.SyncChatResult {
	result := &types.SyncChatResult{
		FinishReason: string(resp.StopReason),
	}
	if len(resp.Content) == 0 {
		return result
	}

	var contentBuilder strings.Builder
	toolCalls := make([]types.ToolCall, 0)
	for index, content := range resp.Content {
		switch content.Type {
		case anthropic.MessagesContentTypeText:
			if content.Text != nil {
				contentBuilder.WriteString(*content.Text)
			}
		case anthropic.MessagesContentTypeToolUse:
			if content.MessageContentToolUse == nil {
				continue
			}
			arguments := strings.TrimSpace(string(content.MessageContentToolUse.Input))
			if arguments == "" {
				arguments = "{}"
			}
			toolCalls = append(toolCalls, types.ToolCall{
				ID:    strings.TrimSpace(content.MessageContentToolUse.ID),
				Type:  string(openai.ToolTypeFunction),
				Index: index,
				Function: types.ToolCallFunction{
					Name:      strings.TrimSpace(content.MessageContentToolUse.Name),
					Arguments: arguments,
				},
			})
		}
	}
	result.Content = strings.TrimSpace(contentBuilder.String())
	result.ToolCalls = toolCalls
	return result
}

func logClaudeSyncToolChoiceFallback(reason string) {
	if strings.TrimSpace(reason) == "" {
		return
	}
	logging.LogWarnf("Claude sync tool choice fallback: %s", reason)
}
