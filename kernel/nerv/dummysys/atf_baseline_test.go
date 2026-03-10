package dummysys

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

type baselineMockLLMClient struct {
	response string
	err      error

	syncCalls int
	messages  []types.ContextMessage
	tools     []openai.Tool
}

func (m *baselineMockLLMClient) SendChatRequest(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (<-chan types.StreamChunk, error) {
	ch := make(chan types.StreamChunk)
	close(ch)
	return ch, nil
}

func (m *baselineMockLLMClient) SendChatRequestSync(ctx context.Context, messages []types.ContextMessage, tools []openai.Tool, toolChoice any) (string, error) {
	m.syncCalls++
	m.messages = append([]types.ContextMessage(nil), messages...)
	m.tools = append([]openai.Tool(nil), tools...)
	if m.err != nil {
		return "", m.err
	}
	return m.response, nil
}

func (m *baselineMockLLMClient) GetModel() string {
	return "gpt-4"
}

func TestATFBaselineAvatar_AnswerQuestionnaireCallsLLM(t *testing.T) {
	client := &baselineMockLLMClient{
		response: "  {\"answers\":[{\"q\":1,\"score\":4}],\"reflection\":\"ok\"}  ",
	}
	avatar, err := NewATFBaselineAvatar(client, "integrated-description")
	if err != nil {
		t.Fatalf("NewATFBaselineAvatar() error = %v", err)
	}

	result, err := avatar.AnswerQuestionnaire(context.Background(), "q=1: 示例问题")
	if err != nil {
		t.Fatalf("AnswerQuestionnaire() error = %v", err)
	}

	if client.syncCalls != 1 {
		t.Fatalf("SendChatRequestSync calls = %d, want 1", client.syncCalls)
	}
	if len(client.messages) != 2 {
		t.Fatalf("messages length = %d, want 2", len(client.messages))
	}
	if client.messages[0].Role != types.RoleSystem {
		t.Fatalf("system role = %s, want %s", client.messages[0].Role, types.RoleSystem)
	}
	if !strings.Contains(client.messages[0].Content, "integrated-description") {
		t.Fatalf("system prompt should contain integrated description, got %q", client.messages[0].Content)
	}
	if client.messages[1].Role != types.RoleUser {
		t.Fatalf("user role = %s, want %s", client.messages[1].Role, types.RoleUser)
	}
	if client.messages[1].Content != "q=1: 示例问题" {
		t.Fatalf("user content = %q, want %q", client.messages[1].Content, "q=1: 示例问题")
	}
	if len(client.tools) != 0 {
		t.Fatalf("tools length = %d, want 0", len(client.tools))
	}
	if !result.Success {
		t.Fatalf("result.Success = false, want true")
	}
	if result.Content != "{\"answers\":[{\"q\":1,\"score\":4}],\"reflection\":\"ok\"}" {
		t.Fatalf("result.Content = %q", result.Content)
	}
}

func TestATFBaselineAvatar_AnswerQuestionnaireLLMError(t *testing.T) {
	client := &baselineMockLLMClient{
		err: errors.New("upstream unavailable"),
	}
	avatar, err := NewATFBaselineAvatar(client, "integrated-description")
	if err != nil {
		t.Fatalf("NewATFBaselineAvatar() error = %v", err)
	}

	_, err = avatar.AnswerQuestionnaire(context.Background(), "question")
	if err == nil {
		t.Fatalf("AnswerQuestionnaire() expected error, got nil")
	}
	if !strings.Contains(err.Error(), "baseline avatar llm call failed") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestATFBaselineAvatar_AnswerQuestionnaireEmptyContent(t *testing.T) {
	client := &baselineMockLLMClient{
		response: "   ",
	}
	avatar, err := NewATFBaselineAvatar(client, "integrated-description")
	if err != nil {
		t.Fatalf("NewATFBaselineAvatar() error = %v", err)
	}

	_, err = avatar.AnswerQuestionnaire(context.Background(), "question")
	if err == nil {
		t.Fatalf("AnswerQuestionnaire() expected error, got nil")
	}
	if !strings.Contains(err.Error(), "empty content") {
		t.Fatalf("unexpected error: %v", err)
	}
}
