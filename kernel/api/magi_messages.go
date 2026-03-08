package api

import (
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
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// magiMessages 处理客户端以 `/v1/messages` (Claude 格式) 发来的请求。
func magiMessages(c *gin.Context) {
	initMagiCron()

	if "" == model.Conf.AI.OpenAI.APIKey {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "OpenAI/Claude API Key not configured"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}
	body = util.NormalizeClaudeMessagesContentField(body)

	var req anthropic.MessagesRequest
	if err = json.Unmarshal(body, &req); err != nil {
		logging.LogErrorf("magiMessages Unmarshal failed: %s", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Model == "" {
		req.Model = anthropic.Model(model.Conf.AI.OpenAI.APIModel)
	}

	sourceCtx, authErr := resolveClaudeSourceContext(c, &req, body)
	if authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}

	logging.LogInfof("magiMessages received: model=[%s] stream=[%v] msgs=[%d]", req.Model, req.Stream, len(req.Messages))

	openAIReq := util.TranslateClaudeMessagesToOpenAIRequest(req)
	openAIReq.Model = string(req.Model)
	prependClaudeSystemMessages(&openAIReq, extractClaudeSystemBlocks(body))

	consensusMsg, err := submitMagiTask(c, openAIReq, sourceCtx)
	if err != nil {
		writeMagiTaskError(c, err)
		return
	}

	modelName := strings.TrimSpace(string(req.Model))
	if modelName == "" {
		modelName = openAIReq.Model
	}
	if modelName == "" {
		modelName = model.Conf.AI.OpenAI.APIModel
	}

	if req.Stream {
		sendClaudeStreamResponse(c, consensusMsg, modelName)
		return
	}
	sendClaudeSyncResponse(c, consensusMsg, modelName)
}

func prependClaudeSystemMessages(req *openai.ChatCompletionRequest, systemBlocks []string) {
	if req == nil || len(systemBlocks) == 0 {
		return
	}
	var prefix []openai.ChatCompletionMessage
	for _, block := range systemBlocks {
		text := strings.TrimSpace(block)
		if text == "" {
			continue
		}
		prefix = append(prefix, openai.ChatCompletionMessage{
			Role:    openai.ChatMessageRoleSystem,
			Content: text,
		})
	}
	if len(prefix) == 0 {
		return
	}
	req.Messages = append(prefix, req.Messages...)
}

func sendClaudeSyncResponse(c *gin.Context, msg *types.Message, modelName string) {
	content := msg.Content
	resp := anthropic.MessagesResponse{
		ID:         "msg_magi_" + gulu.Rand.String(12),
		Type:       anthropic.MessagesResponseTypeMessage,
		Role:       anthropic.RoleAssistant,
		Model:      anthropic.Model(modelName),
		StopReason: anthropic.MessagesStopReasonEndTurn,
		Usage: anthropic.MessagesUsage{
			InputTokens:  0,
			OutputTokens: 0,
		},
		Content: []anthropic.MessageContent{
			{
				Type: anthropic.MessagesContentTypeText,
				Text: &content,
			},
		},
	}
	c.JSON(http.StatusOK, resp)
}

func sendClaudeStreamResponse(c *gin.Context, msg *types.Message, modelName string) {
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
			"model":         modelName,
			"content":       []interface{}{},
			"stop_reason":   nil,
			"stop_sequence": nil,
			"usage": map[string]int{
				"input_tokens":  0,
				"output_tokens": 0,
			},
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

	content := msg.Content
	chunkSize := 20
	for i := 0; i < len(content); i += chunkSize {
		end := i + chunkSize
		if end > len(content) {
			end = len(content)
		}
		writeSSE("content_block_delta", map[string]interface{}{
			"type":  "content_block_delta",
			"index": 0,
			"delta": map[string]string{
				"type": "text_delta",
				"text": content[i:end],
			},
		})
		time.Sleep(10 * time.Millisecond)
	}

	writeSSE("content_block_stop", map[string]interface{}{
		"type":  "content_block_stop",
		"index": 0,
	})
	writeSSE("message_delta", map[string]interface{}{
		"type": "message_delta",
		"delta": map[string]interface{}{
			"stop_reason":   "end_turn",
			"stop_sequence": nil,
		},
		"usage": map[string]int{
			"output_tokens": 0,
		},
	})
	writeSSE("message_stop", map[string]string{"type": "message_stop"})
}
