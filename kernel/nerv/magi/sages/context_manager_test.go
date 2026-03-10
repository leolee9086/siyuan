package sages

import (
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// TestMultiSessionContextManager_SessionIsolation 测试多会话隔离
func TestMultiSessionContextManager_SessionIsolation(t *testing.T) {
	strategy := &config.ContextStrategy{Type: "message_count", Count: 10}
	cm := newMultiSessionContextManager(strategy)

	session1 := "session-1"
	session2 := "session-2"

	msg1 := types.ContextMessage{Role: types.RoleUser, Content: "Hello from session 1"}
	msg2 := types.ContextMessage{Role: types.RoleUser, Content: "Hello from session 2"}

	cm.AddMessageWithSession(session1, msg1)
	cm.AddMessageWithSession(session2, msg2)

	messages1 := cm.GetMessagesForSession(session1)
	messages2 := cm.GetMessagesForSession(session2)

	if len(messages1) != 1 || messages1[0].Content != "Hello from session 1" {
		t.Errorf("Session 1 messages incorrect: %v", messages1)
	}
	if len(messages2) != 1 || messages2[0].Content != "Hello from session 2" {
		t.Errorf("Session 2 messages incorrect: %v", messages2)
	}
}

// TestMultiSessionContextManager_StrategyPerSession 测试会话级别的策略应用
func TestMultiSessionContextManager_StrategyPerSession(t *testing.T) {
	strategy := &config.ContextStrategy{Type: "message_count", Count: 2}
	cm := newMultiSessionContextManager(strategy)

	sessionId := "test-session"

	for i := 1; i <= 5; i++ {
		msg := types.ContextMessage{Role: types.RoleUser, Content: "Message " + string(rune('0'+i))}
		cm.AddMessageWithSession(sessionId, msg)
	}

	messages := cm.GetMessagesForSession(sessionId)
	if len(messages) != 2 {
		t.Errorf("Expected 2 messages after strategy, got %d", len(messages))
	}
	if messages[0].Content != "Message 4" || messages[1].Content != "Message 5" {
		t.Errorf("Strategy not applied correctly: %v", messages)
	}
}

// TestMultiSessionContextManager_ClearSession 测试清除单个会话
func TestMultiSessionContextManager_ClearSession(t *testing.T) {
	cm := newMultiSessionContextManager(nil)

	session1 := "session-1"
	session2 := "session-2"

	cm.AddMessageWithSession(session1, types.ContextMessage{Role: types.RoleUser, Content: "S1"})
	cm.AddMessageWithSession(session2, types.ContextMessage{Role: types.RoleUser, Content: "S2"})

	cm.ClearSession(session1)

	if len(cm.GetMessagesForSession(session1)) != 0 {
		t.Error("Session 1 should be cleared")
	}
	if len(cm.GetMessagesForSession(session2)) != 1 {
		t.Error("Session 2 should remain")
	}
}

// TestSingleHistoryContextManager_IgnoresSession 测试单一历史管理器忽略sessionId
func TestSingleHistoryContextManager_IgnoresSession(t *testing.T) {
	cm := newContextManager(nil)

	cm.AddMessageWithSession("session-1", types.ContextMessage{Role: types.RoleUser, Content: "Msg1"})
	cm.AddMessageWithSession("session-2", types.ContextMessage{Role: types.RoleUser, Content: "Msg2"})

	messages := cm.GetMessages()
	if len(messages) != 2 {
		t.Errorf("Expected 2 messages in single history, got %d", len(messages))
	}

	messagesForSession := cm.GetMessagesForSession("any-session")
	if len(messagesForSession) != 2 {
		t.Error("Single history should return all messages regardless of sessionId")
	}
}
