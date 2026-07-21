package api

import (
	"fmt"
	"strings"
	"time"

	"github.com/88250/gulu"
	"github.com/gin-contrib/sse"
	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type magiLiveStreamState struct {
	chunkID         string
	modelName       string
	streamedContent string
}

func newMagiLiveStreamState(modelName string) *magiLiveStreamState {
	return &magiLiveStreamState{
		chunkID:   "chatcmpl-magi-" + gulu.Rand.String(12),
		modelName: modelName,
	}
}

func (s *magiLiveStreamState) writeContentDelta(c *gin.Context, content string) {
	if content == "" {
		return
	}
	chunk := openai.ChatCompletionStreamResponse{
		ID:      s.chunkID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   s.modelName,
		Choices: []openai.ChatCompletionStreamChoice{{
			Index: 0,
			Delta: openai.ChatCompletionStreamChoiceDelta{Content: content},
		}},
	}
	c.Render(-1, sse.Event{Data: chunk})
	c.Writer.Flush()
}

func (s *magiLiveStreamState) appendCumulative(c *gin.Context, content string) error {
	if content == s.streamedContent {
		return nil
	}
	if !strings.HasPrefix(content, s.streamedContent) {
		return fmt.Errorf("MAGI streamed reply diverged from final consensus")
	}
	delta := strings.TrimPrefix(content, s.streamedContent)
	s.streamedContent = content
	s.writeContentDelta(c, delta)
	return nil
}

func (s *magiLiveStreamState) finish(c *gin.Context, message *types.Message) error {
	if message == nil {
		return fmt.Errorf("MAGI stream completed without consensus")
	}
	if s.streamedContent == "" {
		return fmt.Errorf("MAGI stream completed without wanna_speak_continue content")
	}
	if strings.TrimSpace(message.Content) != s.streamedContent {
		return fmt.Errorf("MAGI streamed reply diverged from final consensus")
	}
	finalChunk := openai.ChatCompletionStreamResponse{
		ID:      s.chunkID,
		Object:  "chat.completion.chunk",
		Created: time.Now().Unix(),
		Model:   s.modelName,
		Choices: []openai.ChatCompletionStreamChoice{{
			Index:        0,
			Delta:        openai.ChatCompletionStreamChoiceDelta{},
			FinishReason: "stop",
		}},
	}
	if links := magiWebSearchLinks(message); len(links) > 0 {
		c.Render(-1, sse.Event{Data: struct {
			openai.ChatCompletionStreamResponse
			WebSearchLinks map[string]string `json:"webSearchLinks"`
		}{
			ChatCompletionStreamResponse: finalChunk,
			WebSearchLinks:               links,
		}})
	} else {
		c.Render(-1, sse.Event{Data: finalChunk})
	}
	c.Render(-1, sse.Event{Data: "[DONE]"})
	c.Writer.Flush()
	return nil
}

type magiLiveStreamEvent struct {
	content string
	result  *MagiTaskResult
}

func writeMagiLiveStreamError(c *gin.Context, err error) {
	message := "MAGI stream failed"
	if err != nil && strings.TrimSpace(err.Error()) != "" {
		message = err.Error()
	}
	c.Render(-1, sse.Event{Data: map[string]interface{}{
		"error": map[string]string{"message": message, "type": "magi_stream_error"},
	}})
	c.Render(-1, sse.Event{Data: "[DONE]"})
	c.Writer.Flush()
}

func sendLiveMagiStreamResponse(
	c *gin.Context,
	req openai.ChatCompletionRequest,
	sourceCtx *types.RequestSourceContext,
	modelName string,
) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")
	c.Status(200)
	c.Writer.Flush()

	requestCtx := c.Request.Context()
	events := make(chan magiLiveStreamEvent, 32)
	replyStreamObserver := func(content string) error {
		select {
		case events <- magiLiveStreamEvent{content: content}:
			return nil
		case <-requestCtx.Done():
			return requestCtx.Err()
		}
	}
	go func() {
		message, err := submitMagiTaskWithReplyStream(requestCtx, req, sourceCtx, replyStreamObserver)
		result := MagiTaskResult{ConsensusMsg: message, Err: err}
		select {
		case events <- magiLiveStreamEvent{result: &result}:
		case <-requestCtx.Done():
		}
	}()

	state := newMagiLiveStreamState(modelName)
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case event := <-events:
			if event.result == nil {
				if err := state.appendCumulative(c, event.content); err != nil {
					writeMagiLiveStreamError(c, err)
					return
				}
				continue
			}
			if event.result.Err != nil {
				writeMagiLiveStreamError(c, event.result.Err)
				return
			}
			if err := state.finish(c, event.result.ConsensusMsg); err != nil {
				writeMagiLiveStreamError(c, err)
			}
			return
		}
	}
}
