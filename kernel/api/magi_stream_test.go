package api

import (
	"bufio"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

func TestMagiLiveStreamStateForwardsCumulativeDeltas(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	state := newMagiLiveStreamState("magi-trinity")

	if err := state.appendCumulative(ctx, "中文流式"); err != nil {
		t.Fatalf("append first chunk failed: %v", err)
	}
	if err := state.appendCumulative(ctx, "中文流式回复"); err != nil {
		t.Fatalf("append cumulative chunk failed: %v", err)
	}
	if err := state.appendCumulative(ctx, "中文流式回复完成"); err != nil {
		t.Fatalf("append final tool chunk failed: %v", err)
	}
	if err := state.finish(ctx, &types.Message{Content: "中文流式回复完成"}); err != nil {
		t.Fatalf("finish stream failed: %v", err)
	}

	content, receivedDone, errorMessage := decodeMagiSSE(t, recorder.Body.String())
	if content != "中文流式回复完成" || !receivedDone || errorMessage != "" {
		t.Fatalf("unexpected live stream: content=%q done=%v error=%q", content, receivedDone, errorMessage)
	}
}

func TestMagiLiveStreamStateRejectsDivergentConsensus(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	state := newMagiLiveStreamState("magi-trinity")
	if err := state.appendCumulative(ctx, "已推送内容"); err != nil {
		t.Fatalf("append first chunk failed: %v", err)
	}
	if err := state.finish(ctx, &types.Message{Content: "不同的最终共识"}); err == nil {
		t.Fatal("divergent final consensus must return an error")
	}
}

func TestMagiLiveStreamStateRejectsMissingToolStream(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	state := newMagiLiveStreamState("magi-trinity")
	if err := state.finish(ctx, &types.Message{Content: "仅在最终结果中出现"}); err == nil {
		t.Fatal("missing wanna_speak_continue stream must return an error")
	}
}

func decodeMagiSSE(t *testing.T, raw string) (streamContent string, receivedDone bool, errorMessage string) {
	t.Helper()
	var content strings.Builder
	scanner := bufio.NewScanner(strings.NewReader(raw))
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			receivedDone = true
			continue
		}
		var envelope map[string]interface{}
		if err := json.Unmarshal([]byte(data), &envelope); err == nil {
			if rawError, ok := envelope["error"].(map[string]interface{}); ok {
				errorMessage, _ = rawError["message"].(string)
				continue
			}
		}
		var chunk openai.ChatCompletionStreamResponse
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			t.Fatalf("decode SSE chunk failed: %v, data=%q", err, data)
		}
		if len(chunk.Choices) > 0 {
			content.WriteString(chunk.Choices[0].Delta.Content)
		}
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scan SSE response failed: %v", err)
	}
	return content.String(), receivedDone, errorMessage
}
