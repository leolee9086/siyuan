package channel

import (
	"context"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestMessageStoreFiltersIdentityAndConversationIncludingOutbound(t *testing.T) {
	store, err := OpenMessageStore(filepath.Join(t.TempDir(), "messages.db"))
	if err != nil {
		t.Fatalf("open message store: %v", err)
	}
	defer store.Close()

	ctx := context.Background()
	if err = store.SaveInbound(ctx, &InboundMessage{
		ChannelID: "magi-main-ui", ChannelType: "magi-main-ui", AccountID: "workspace",
		UserID: "user-a", IdentityID: "identity-a", Text: "question-a",
		ConversationToken: "conversation-a", Timestamp: 100,
	}); err != nil {
		t.Fatalf("save inbound: %v", err)
	}
	if err = store.SaveOutbound(ctx, &OutboundMessage{
		ChannelID: "magi-main-ui", ChannelType: "magi-main-ui", AccountID: "workspace",
		UserID: "user-a", IdentityID: "identity-a", Text: "answer-a",
		ConversationToken: "conversation-a",
	}); err != nil {
		t.Fatalf("save outbound: %v", err)
	}
	if err = store.SaveInbound(ctx, &InboundMessage{
		ChannelID: "magi-main-ui", ChannelType: "magi-main-ui", AccountID: "workspace",
		UserID: "user-b", IdentityID: "identity-b", Text: "question-b",
		ConversationToken: "conversation-b", Timestamp: 200,
	}); err != nil {
		t.Fatalf("save second identity: %v", err)
	}
	if err = store.SaveInbound(ctx, &InboundMessage{
		ChannelID: "magi-main-ui", ChannelType: "magi-main-ui", AccountID: "workspace",
		UserID: "user-a", IdentityID: "identity-a", Text: "other-conversation",
		ConversationToken: "conversation-a-2", Timestamp: 300,
	}); err != nil {
		t.Fatalf("save second conversation: %v", err)
	}

	result, err := store.Query(ctx, QueryOptions{
		ChannelID: "magi-main-ui", AccountID: "workspace", IdentityID: "identity-a",
		ConversationID: "conversation-a", Limit: 20,
	})
	if err != nil {
		t.Fatalf("query messages: %v", err)
	}
	if len(result.Messages) != 2 {
		t.Fatalf("expected two isolated messages, got %d", len(result.Messages))
	}
	for _, message := range result.Messages {
		if message.IdentityID != "identity-a" || message.ConversationID != "conversation-a" {
			t.Fatalf("query crossed identity or conversation boundary: %+v", message)
		}
	}
	if result.Messages[0].Direction != DirOutbound || result.Messages[0].Text != "answer-a" {
		t.Fatalf("outbound identity metadata was not persisted: %+v", result.Messages[0])
	}
}

func TestMessageStoreConcurrentWritesHaveStrictOrder(t *testing.T) {
	store, err := OpenMessageStore(filepath.Join(t.TempDir(), "concurrent.db"))
	if err != nil {
		t.Fatalf("open message store: %v", err)
	}
	defer store.Close()

	const messageCount = 32
	var waitGroup sync.WaitGroup
	errors := make(chan error, messageCount)
	for index := 0; index < messageCount; index++ {
		waitGroup.Add(1)
		go func(messageIndex int) {
			defer waitGroup.Done()
			errors <- store.SaveInbound(context.Background(), &InboundMessage{
				ChannelID: "magi-main-ui", ChannelType: "magi-main-ui", AccountID: "workspace",
				UserID: "user-a", IdentityID: "identity-a", ConversationToken: "conversation-a",
				Text: "message", Timestamp: int64(messageIndex + 1),
			})
		}(index)
	}
	waitGroup.Wait()
	close(errors)
	for saveErr := range errors {
		if saveErr != nil {
			t.Fatalf("concurrent save failed: %v", saveErr)
		}
	}

	result, err := store.Query(context.Background(), QueryOptions{
		ChannelID: "magi-main-ui", AccountID: "workspace", IdentityID: "identity-a",
		ConversationID: "conversation-a", Limit: messageCount,
	})
	if err != nil {
		t.Fatalf("query concurrent messages: %v", err)
	}
	if len(result.Messages) != messageCount {
		t.Fatalf("expected %d messages, got %d", messageCount, len(result.Messages))
	}
	for index := 1; index < len(result.Messages); index++ {
		if result.Messages[index-1].PersistedAt <= result.Messages[index].PersistedAt {
			t.Fatalf("persisted order is not strict at index %d: %d <= %d", index,
				result.Messages[index-1].PersistedAt, result.Messages[index].PersistedAt)
		}
	}
}

func TestMessageStoreReturnsConversationMetadataFailure(t *testing.T) {
	store, err := OpenMessageStore(filepath.Join(t.TempDir(), "metadata-error.db"))
	if err != nil {
		t.Fatalf("open message store: %v", err)
	}
	defer store.Close()

	if _, err = store.db.Exec(`
		CREATE TRIGGER reject_conversation_metadata
		BEFORE INSERT ON channel_conversations
		BEGIN
			SELECT RAISE(ABORT, 'metadata write rejected');
		END;
	`); err != nil {
		t.Fatalf("create rejection trigger: %v", err)
	}

	err = store.SaveInbound(context.Background(), &InboundMessage{
		ChannelID: "magi-main-ui", ChannelType: "magi-main-ui", AccountID: "workspace",
		UserID: "user-a", IdentityID: "identity-a", ConversationToken: "conversation-a",
		Text: "message", Timestamp: 1,
	})
	if err == nil || !strings.Contains(err.Error(), "update conversation metadata") {
		t.Fatalf("expected explicit conversation metadata error, got %v", err)
	}

	result, queryErr := store.Query(context.Background(), QueryOptions{
		ChannelID: "magi-main-ui", AccountID: "workspace", IdentityID: "identity-a",
		ConversationID: "conversation-a", Limit: 20,
	})
	if queryErr != nil {
		t.Fatalf("query after rejected save: %v", queryErr)
	}
	if len(result.Messages) != 0 {
		t.Fatalf("rejected save left %d partially persisted messages", len(result.Messages))
	}
}
