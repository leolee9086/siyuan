// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/llm"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

const (
	proxyMaxRetries     = 3
	proxyBackoffBase    = 1 * time.Second
	proxyTimeoutDefault = 120
	proxyTimeoutMin     = 30
)

func aiProxyTimeout() int {
	t := model.Conf.AI.OpenAI.APITimeout
	if t < proxyTimeoutMin {
		return proxyTimeoutDefault
	}
	return t
}

func aiChatProxy(c *gin.Context) {
	if "" == model.Conf.AI.OpenAI.APIKey {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "AI not configured"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	var req openai.ChatCompletionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if req.Model == "" {
		req.Model = model.Conf.AI.OpenAI.APIModel
	}

	client := llm.GetActiveClient()
	if client == nil {
		client = llm.NewClientFromConf(model.Conf.AI.OpenAI,
			model.Conf.AI.EffectiveAPIProxy(model.Conf.System))
	}

	if req.Stream {
		handleStream(c, &req, client)
		return
	}
	handleSync(c, &req, client)
}

func toContextMessages(msgs []openai.ChatCompletionMessage) []types.ContextMessage {
	result := make([]types.ContextMessage, 0, len(msgs))
	for _, m := range msgs {
		cm := types.ContextMessage{
			Role:             types.MessageRole(m.Role),
			Content:          m.Content,
			ReasoningContent: m.ReasoningContent,
			ToolID:           m.ToolCallID,
		}
		for _, tc := range m.ToolCalls {
			cm.ToolCalls = append(cm.ToolCalls, types.ToolCall{
				ID:   tc.ID,
				Type: string(tc.Type),
				Function: types.ToolCallFunction{
					Name:      tc.Function.Name,
					Arguments: tc.Function.Arguments,
				},
			})
		}
		result = append(result, cm)
	}
	return result
}

func handleSync(c *gin.Context, req *openai.ChatCompletionRequest, client llm.Client) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), time.Duration(aiProxyTimeout())*time.Second)
	defer cancel()

	messages := toContextMessages(req.Messages)

	var lastErr error
	for attempt := 0; attempt <= proxyMaxRetries; attempt++ {
		select {
		case <-ctx.Done():
			lastErr = ctx.Err()
			goto fail
		default:
		}

		result, err := client.SendChatRequestSyncDetailed(ctx, messages, req.Tools, nil)
		if err == nil {
			if result == nil {
				c.JSON(http.StatusBadGateway, gin.H{"error": "LLM returned empty result"})
				return
			}
			c.JSON(http.StatusOK, openai.ChatCompletionResponse{
				ID:      fmt.Sprintf("chatcmpl-%d", time.Now().UnixNano()),
				Object:  "chat.completion",
				Created: time.Now().Unix(),
				Model:   req.Model,
				Choices: []openai.ChatCompletionChoice{
					{
						Index: 0,
						Message: openai.ChatCompletionMessage{
							Role:             openai.ChatMessageRoleAssistant,
							Content:          result.Content,
							ReasoningContent: result.ReasoningContent,
						},
						FinishReason: openai.FinishReason(result.FinishReason),
					},
				},
			})
			return
		}

		lastErr = err
		if attempt < proxyMaxRetries {
			backoff := proxyBackoffBase * (1 << attempt)
			jitter := time.Duration(rand.Int63n(int64(proxyBackoffBase / 2)))
			logging.LogWarnf("aiChatProxy request failed (attempt %d/%d): %v, retrying in %v",
				attempt+1, proxyMaxRetries+1, err, backoff+jitter)
			select {
			case <-time.After(backoff + jitter):
			case <-ctx.Done():
				lastErr = ctx.Err()
				goto fail
			}
		}
	}

fail:
	logging.LogErrorf("aiChatProxy request failed: %s", lastErr)
	c.JSON(http.StatusBadGateway, gin.H{"error": lastErr.Error()})
}

func handleStream(c *gin.Context, req *openai.ChatCompletionRequest, client llm.Client) {
	chunkTimeout := time.Duration(aiProxyTimeout()) * time.Second

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	chunkChan, err := client.SendChatRequest(ctx, toContextMessages(req.Messages), req.Tools, nil)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	chatID := fmt.Sprintf("chatcmpl-%d", time.Now().UnixNano())
	writeSSE := func(data string) {
		io.WriteString(c.Writer, "data: "+data+"\n\n")
		c.Writer.Flush()
	}

	timer := time.NewTimer(chunkTimeout)
	defer timer.Stop()

	roleSent := false
	for {
		select {
		case chunk, ok := <-chunkChan:
			if !ok {
				writeSSE("[DONE]")
				return
			}
			timer.Reset(chunkTimeout)

			if chunk.Object == "error" {
				logging.LogErrorf("aiChatProxy stream error: %s", chunk.ID)
				return
			}
			if len(chunk.Choices) == 0 {
				continue
			}
			choice := chunk.Choices[0]
			delta := map[string]any{}
			if !roleSent && choice.Delta.Role != "" {
				delta["role"] = choice.Delta.Role
				roleSent = true
			}
			if choice.Delta.Content != "" {
				delta["content"] = choice.Delta.Content
			}
			if choice.Delta.ReasoningContent != "" {
				delta["reasoning_content"] = choice.Delta.ReasoningContent
			}
			fr := choice.FinishReason

			chunkMap := map[string]any{
				"id":      chatID,
				"object":  "chat.completion.chunk",
				"created": time.Now().Unix(),
				"model":   req.Model,
				"choices": []map[string]any{
					{"index": choice.Index, "delta": delta, "finish_reason": fr},
				},
			}
			data, _ := json.Marshal(chunkMap)
			writeSSE(string(data))

		case <-timer.C:
			cancel()
			logging.LogErrorf("aiChatProxy stream timeout: no chunk received within %v", chunkTimeout)
			return
		}
	}
}
