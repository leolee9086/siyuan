package llm

import (
	"context"
	"time"

	"github.com/liushuangls/go-anthropic/v2"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func (c *claudeClient) SendChatRequest(
	ctx context.Context,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) (<-chan types.StreamChunk, error) {
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
		return nil, errNoMessages
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

	chunkChan := make(chan types.StreamChunk, 10)

	go func() {
		defer close(chunkChan)

		var messageID string
		var modelName string
		toolUseBlocks := make(map[int]*toolUseBlockState)
		sentRole := false
		unexpectedToolCall := false

		sendRole := func() {
			if sentRole {
				return
			}
			sentRole = true
			chunk := types.StreamChunk{
				Object:  "chat.completion.chunk",
				Created: time.Now().Unix(),
				Choices: []types.ChunkChoice{{
					Index: 0,
					Delta: types.ChunkDelta{Role: "assistant"},
				}},
			}
			if messageID != "" {
				chunk.ID = messageID
			}
			if modelName != "" {
				chunk.Model = modelName
			}
			sendChunk(ctx, chunkChan, chunk)
		}

		streamReq := anthropic.MessagesStreamRequest{
			MessagesRequest: req,
			OnMessageStart: func(data anthropic.MessagesEventMessageStartData) {
				messageID = data.Message.ID
				modelName = string(data.Message.Model)
				sendRole()
			},
			OnContentBlockStart: func(data anthropic.MessagesEventContentBlockStartData) {
				sendRole()
				if data.ContentBlock.Type != anthropic.MessagesContentTypeToolUse {
					return
				}
				if data.ContentBlock.MessageContentToolUse == nil {
					return
				}
				if len(tools) == 0 {
					if !unexpectedToolCall {
						unexpectedToolCall = true
						sendChunk(ctx, chunkChan, types.StreamChunk{
							ID:     "逻辑无工具请求返回了流式工具调用",
							Object: "error",
							Model:  modelName,
						})
					}
					return
				}
				tc := data.ContentBlock.MessageContentToolUse
				toolUseBlocks[data.Index] = &toolUseBlockState{
					id:   tc.ID,
					name: tc.Name,
				}
				sendChunk(ctx, chunkChan, types.StreamChunk{
					ID:      messageID,
					Object:  "chat.completion.chunk",
					Created: time.Now().Unix(),
					Model:   modelName,
					Choices: []types.ChunkChoice{{
						Index: 0,
						Delta: types.ChunkDelta{
							ToolCalls: []types.ToolCallDelta{{
								Index: data.Index,
								ID:    tc.ID,
								Type:  "function",
								Function: &types.ToolCallFunctionDelta{
									Name: tc.Name,
								},
							}},
						},
					}},
				})
			},
			OnContentBlockDelta: func(data anthropic.MessagesEventContentBlockDeltaData) {
				if unexpectedToolCall {
					return
				}
				sendRole()
				switch data.Delta.Type {
				case anthropic.MessagesContentTypeTextDelta:
					text := data.Delta.GetText()
					if text == "" {
						return
					}
					sendChunk(ctx, chunkChan, types.StreamChunk{
						ID:      messageID,
						Object:  "chat.completion.chunk",
						Created: time.Now().Unix(),
						Model:   modelName,
						Choices: []types.ChunkChoice{{
							Index: 0,
							Delta: types.ChunkDelta{Content: text},
						}},
					})
				case anthropic.MessagesContentTypeInputJsonDelta:
					if data.Delta.PartialJson == nil || *data.Delta.PartialJson == "" {
						return
					}
					if _, ok := toolUseBlocks[data.Index]; !ok {
						return
					}
					sendChunk(ctx, chunkChan, types.StreamChunk{
						ID:      messageID,
						Object:  "chat.completion.chunk",
						Created: time.Now().Unix(),
						Model:   modelName,
						Choices: []types.ChunkChoice{{
							Index: 0,
							Delta: types.ChunkDelta{
								ToolCalls: []types.ToolCallDelta{{
									Index: data.Index,
									Function: &types.ToolCallFunctionDelta{
										Arguments: *data.Delta.PartialJson,
									},
								}},
							},
						}},
					})
				case anthropic.MessagesContentTypeThinkingDelta:
					if data.Delta.MessageContentThinking == nil || data.Delta.MessageContentThinking.Thinking == "" {
						return
					}
					sendChunk(ctx, chunkChan, types.StreamChunk{
						ID:      messageID,
						Object:  "chat.completion.chunk",
						Created: time.Now().Unix(),
						Model:   modelName,
						Choices: []types.ChunkChoice{{
							Index: 0,
							Delta: types.ChunkDelta{
								ReasoningContent: data.Delta.MessageContentThinking.Thinking,
							},
						}},
					})
				}
			},
			OnMessageDelta: func(data anthropic.MessagesEventMessageDeltaData) {
				if unexpectedToolCall {
					return
				}
				if data.Delta.StopReason == "" {
					return
				}
				reason := mapClaudeFinishReason(data.Delta.StopReason)
				sendChunk(ctx, chunkChan, types.StreamChunk{
					ID:      messageID,
					Object:  "chat.completion.chunk",
					Created: time.Now().Unix(),
					Model:   modelName,
					Choices: []types.ChunkChoice{{
						Index:        0,
						FinishReason: &reason,
					}},
				})
			},
		}

		_, err := client.CreateMessagesStream(ctx, streamReq)
		if err != nil {
			logging.LogWarnf("Claude streaming failed, falling back to sync: %v", err)
			emitSyncResultAsStream(ctx, chunkChan, c, messages, tools, toolChoice)
		}
	}()

	return chunkChan, nil
}

type toolUseBlockState struct {
	id   string
	name string
}

func sendChunk(ctx context.Context, ch chan<- types.StreamChunk, chunk types.StreamChunk) {
	select {
	case ch <- chunk:
	case <-ctx.Done():
	}
}

func mapClaudeFinishReason(reason anthropic.MessagesStopReason) string {
	switch reason {
	case anthropic.MessagesStopReasonEndTurn:
		return "stop"
	case anthropic.MessagesStopReasonMaxTokens:
		return "length"
	case anthropic.MessagesStopReasonToolUse:
		return "tool_calls"
	case anthropic.MessagesStopReasonStopSequence:
		return "stop"
	default:
		return string(reason)
	}
}

// emitSyncResultAsStream falls back to the sync API when streaming is unavailable
// (e.g. for non-Anthropic providers), emitting the full result as stream chunks.
func emitSyncResultAsStream(
	ctx context.Context,
	chunkChan chan<- types.StreamChunk,
	c *claudeClient,
	messages []types.ContextMessage,
	tools []openai.Tool,
	toolChoice any,
) {
	result, err := c.SendChatRequestSyncDetailed(ctx, messages, tools, toolChoice)
	if err != nil {
		logging.LogWarnf("Claude sync fallback also failed: %v", err)
		sendChunk(ctx, chunkChan, types.StreamChunk{
			ID:     err.Error(),
			Object: "error",
			Model:  c.config.APIModel,
		})
		return
	}

	sendChunk(ctx, chunkChan, types.StreamChunk{
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   c.config.APIModel,
		Choices: []types.ChunkChoice{{
			Index: 0,
			Delta: types.ChunkDelta{Role: "assistant"},
		}},
	})

	if result.Content != "" {
		sendChunk(ctx, chunkChan, types.StreamChunk{
			Object:  "chat.completion.chunk",
			Created: time.Now().Unix(),
			Model:   c.config.APIModel,
			Choices: []types.ChunkChoice{{
				Index: 0,
				Delta: types.ChunkDelta{Content: result.Content},
			}},
		})
	}

	for _, tc := range result.ToolCalls {
		sendChunk(ctx, chunkChan, types.StreamChunk{
			Object:  "chat.completion.chunk",
			Created: time.Now().Unix(),
			Model:   c.config.APIModel,
			Choices: []types.ChunkChoice{{
				Index: 0,
				Delta: types.ChunkDelta{
					ToolCalls: []types.ToolCallDelta{{
						Index: tc.Index,
						ID:    tc.ID,
						Type:  tc.Type,
						Function: &types.ToolCallFunctionDelta{
							Name:      tc.Function.Name,
							Arguments: tc.Function.Arguments,
						},
					}},
				},
			}},
		})
	}

	finishReason := "stop"
	if result.FinishReason != "" {
		finishReason = result.FinishReason
	}
	sendChunk(ctx, chunkChan, types.StreamChunk{
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   c.config.APIModel,
		Choices: []types.ChunkChoice{{
			Index:        0,
			FinishReason: &finishReason,
		}},
	})
}
