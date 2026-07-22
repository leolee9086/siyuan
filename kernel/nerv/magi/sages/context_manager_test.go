package sages

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/siyuan-note/siyuan/kernel/nerv/magi/config"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

// TestMultiSessionContextManager_SessionIsolation 测试多会话隔离
func TestMultiSessionContextManager_SessionIsolation(t *testing.T) {
	strategy := &config.ContextStrategy{Type: "message_count", Count: 10}
	cm := newMultiSessionContextManager(strategy, "")

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
	cm := newMultiSessionContextManager(strategy, "")

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
	cm := newMultiSessionContextManager(nil, "")

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
	cm := newContextManager(nil, "")

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

// testTiktokenDir 定位包含 tiktoken 编码器文件的资源目录。
// 从测试源文件位置向上逐级查找，验证目录中必须存在 cl100k_base.tiktoken 或 o200k_base.tiktoken，
// 避免被 InitTokenEncodersWithDir 的 os.MkdirAll 创建的空目录误导。
func testTiktokenDir(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dir := filepath.Dir(filename)
	for {
		candidate := filepath.Join(dir, "app", "tiktoken")
		if info, err := os.Stat(candidate); err == nil && info.IsDir() {
			if hasTiktokenFile(candidate) {
				return candidate
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("cannot find app/tiktoken/ with encoder files from %s", filename)
		}
		dir = parent
	}
}

// hasTiktokenFile 检查目录中是否存在 tiktoken 编码器文件。
func hasTiktokenFile(dir string) bool {
	for _, name := range []string{"cl100k_base.tiktoken", "o200k_base.tiktoken"} {
		if info, err := os.Stat(filepath.Join(dir, name)); err == nil && !info.IsDir() {
			return true
		}
	}
	return false
}

// TestTokenPercent_RoundBasedDiscard 验证 token_percent 策略在超预算时丢弃早期低优先级轮次。
func TestTokenPercent_RoundBasedDiscard(t *testing.T) {
	InitTokenEncodersWithDir(testTiktokenDir(t))
	if !encodersReady {
		t.Skip("token encoders not ready, skipping token-based test")
	}

	longContent := strings.Repeat("The quick brown fox jumps over the lazy dog. ", 80)
	shortContent := strings.Repeat("The quick brown fox jumps over the lazy dog. ", 8)

	var messages []types.ContextMessage
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: longContent,
			RoundID: "round-1",
		})
	}
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: longContent,
			RoundID: "round-2",
		})
	}
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:     types.RoleUser,
			Content:  shortContent,
			RoundID:  "round-3",
			Dominant: true,
		})
	}
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: shortContent,
			RoundID: "round-4",
		})
	}

	trimmed := trimByRoundTokenPercent(messages, 50, "gpt-4")

	hasRound := func(rid string) bool {
		for _, msg := range trimmed {
			if msg.RoundID == rid {
				return true
			}
		}
		return false
	}

	if !hasRound("round-4") {
		t.Error("current round (round-4) should always be kept")
	}
	if !hasRound("round-3") {
		t.Error("dominant round (round-3) should be kept when within budget")
	}
	t.Logf("trimmed from %d to %d messages", len(messages), len(trimmed))
}

// TestTokenPercent_SystemPromptPreserved 验证 system prompt 在裁剪后保留。
func TestTokenPercent_SystemPromptPreserved(t *testing.T) {
	InitTokenEncodersWithDir(testTiktokenDir(t))
	if !encodersReady {
		t.Skip("token encoders not ready, skipping token-based test")
	}

	longContent := strings.Repeat("The quick brown fox jumps over the lazy dog. ", 80)

	messages := []types.ContextMessage{
		{Role: types.RoleSystem, Content: "You are a helpful assistant."},
	}
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: longContent,
			RoundID: "r1",
		})
	}
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: longContent,
			RoundID: "r2",
		})
	}
	for i := 0; i < 3; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: longContent,
			RoundID: "r3",
		})
	}

	trimmed := trimByRoundTokenPercent(messages, 50, "gpt-4")

	if len(trimmed) == 0 {
		t.Fatal("trimmed result is empty")
	}
	if trimmed[0].Role != types.RoleSystem {
		t.Error("system prompt should be preserved at position 0")
	}
}

// TestTokenPercent_NilStrategy_NoOp 验证 nil/零值策略不裁剪。
func TestTokenPercent_NilStrategy_NoOp(t *testing.T) {
	messages := []types.ContextMessage{
		{Role: types.RoleUser, Content: "hello", RoundID: "r1"},
		{Role: types.RoleAssistant, Content: "hi", RoundID: "r1"},
	}

	trimmed := trimByRoundTokenPercent(messages, 0, "gpt-4")
	if len(trimmed) != len(messages) {
		t.Errorf("zero percent should be a no-op, got %d messages", len(trimmed))
	}

	trimmed2 := trimByRoundTokenPercent(messages, 150, "gpt-4")
	if len(trimmed2) != len(messages) {
		t.Errorf("percent > 100 should be a no-op, got %d messages", len(trimmed2))
	}
}

// TestTokenPercent_NoRoundID_GroupsTogether 验证无 RoundID 的消息被归为一组。
func TestTokenPercent_NoRoundID_GroupsTogether(t *testing.T) {
	InitTokenEncodersWithDir(testTiktokenDir(t))
	if !encodersReady {
		t.Skip("token encoders not ready, skipping token-based test")
	}

	longContent := strings.Repeat("hello world ", 300)

	var messages []types.ContextMessage
	for i := 0; i < 5; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: longContent,
		})
	}
	for i := 0; i < 2; i++ {
		messages = append(messages, types.ContextMessage{
			Role:    types.RoleUser,
			Content: "short",
			RoundID: "last-round",
		})
	}

	trimmed := trimByRoundTokenPercent(messages, 30, "gpt-4")

	lastRoundFound := false
	noRoundFound := false
	for _, msg := range trimmed {
		if msg.RoundID == "last-round" {
			lastRoundFound = true
		}
		if msg.RoundID == "" {
			noRoundFound = true
		}
	}

	if !lastRoundFound {
		t.Error("last round should be preserved")
	}
	t.Logf("trimmed to %d messages, lastRound=%v, noRound=%v", len(trimmed), lastRoundFound, noRoundFound)
}

// TestMessageCount_Strategy 回归测试 message_count 策略。
func TestMessageCount_Strategy(t *testing.T) {
	strategy := &config.ContextStrategy{Type: "message_count", Count: 3}
	cm := newContextManager(strategy, "")

	for i := 0; i < 10; i++ {
		cm.AddMessage(types.ContextMessage{
			Role:    types.RoleUser,
			Content: fmt.Sprintf("message-%d", i),
		})
	}

	messages := cm.GetMessages()
	if len(messages) != 3 {
		t.Errorf("expected 3 messages, got %d", len(messages))
	}
	if messages[0].Content != "message-7" {
		t.Errorf("unexpected first kept message: %s", messages[0].Content)
	}
	if messages[2].Content != "message-9" {
		t.Errorf("unexpected last kept message: %s", messages[2].Content)
	}
}

// TestTokenPercent_LargeScale 压力测试：大量轮次、大量 token。
func TestTokenPercent_LargeScale(t *testing.T) {
	if testing.Short() {
		t.Skip("large-scale token trimming stress test")
	}
	InitTokenEncodersWithDir(testTiktokenDir(t))
	if !encodersReady {
		t.Skip("token encoders not ready, skipping token-based test")
	}

	content := strings.Repeat("the quick brown fox ", 20)

	const numRounds = 200
	var messages []types.ContextMessage
	for r := 0; r < numRounds; r++ {
		rid := fmt.Sprintf("round-%d", r)
		for i := 0; i < 4; i++ {
			messages = append(messages, types.ContextMessage{
				Role:    types.RoleUser,
				Content: content,
				RoundID: rid,
			})
		}
	}

	trimmed := trimByRoundTokenPercent(messages, 50, "gpt-4o")

	if len(trimmed) == len(messages) {
		t.Log("trimByRoundTokenPercent may not have triggered (encoders may not be available)")
	} else {
		t.Logf("large scale: trimmed from %d to %d messages", len(messages), len(trimmed))
	}

	if len(trimmed) == 0 {
		t.Error("result should not be empty")
	}

	lastFound := false
	for _, msg := range trimmed {
		if msg.RoundID == fmt.Sprintf("round-%d", numRounds-1) {
			lastFound = true
			break
		}
	}
	if !lastFound {
		t.Error("last round should always be preserved")
	}
}
