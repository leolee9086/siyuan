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
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

// newTestExecutor 创建带独立 manager 的测试执行器（不污染全局 agentInboxManager）。
func newTestExecutor(t *testing.T, sessionID string) (*agentSessionExecutor, *agentqueue.InboxManager) {
	t.Helper()
	manager := agentqueue.NewInboxManager(10)
	ex := newAgentSessionExecutor(sessionID, manager)
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 4)
		ch <- agent.AgentEvent{Type: "turn", TurnID: "turn-test"}
		ch <- agent.AgentEvent{Type: "thinking", Reasoning: "analyzing"}
		ch <- agent.AgentEvent{Type: "content", Token: "hello"}
		ch <- agent.AgentEvent{Type: "done", TurnID: "turn-test"}
		close(ch)
		return ch
	}
	go ex.run()
	t.Cleanup(func() { close(ex.stopCh) })
	return ex, manager
}

// collectUntilClosed 读取订阅 channel 直到关闭，带超时保护（防止测试挂死）。
func collectUntilClosed(t *testing.T, subCh <-chan agent.AgentEvent, timeout time.Duration) []agent.AgentEvent {
	t.Helper()
	done := make(chan []agent.AgentEvent, 1)
	go func() {
		var events []agent.AgentEvent
		for ev := range subCh {
			events = append(events, ev)
		}
		done <- events
	}()
	select {
	case events := <-done:
		return events
	case <-time.After(timeout):
		t.Fatal("subscription channel did not close within timeout")
		return nil
	}
}

// TestAgentExecutorForwardsTurnEvents 验证：Submit 入队后执行器被唤醒，
// 启动 turn 并把事件全部转发到订阅 channel，结束后关闭 channel。
func TestAgentExecutorForwardsTurnEvents(t *testing.T) {
	ex, manager := newTestExecutor(t, "sess-1")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	subCh, err := ex.subscribe(ctx)
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}
	defer ex.unsubscribe()

	input := &agentqueue.Input{
		ID:        "in-1",
		SessionID: "sess-1",
		Semantics: agentqueue.SemanticsUserMessage,
		Content:   "hello",
	}
	if _, err := manager.Submit(input); err != nil {
		t.Fatalf("submit failed: %v", err)
	}

	events := collectUntilClosed(t, subCh, 5*time.Second)
	if len(events) != 4 {
		t.Fatalf("forwarded events: got %d, want 4 (%+v)", len(events), events)
	}
	if events[0].Type != "turn" || events[3].Type != "done" {
		t.Fatalf("event sequence mismatch: first=%s last=%s", events[0].Type, events[3].Type)
	}

	// 输入应标记为 injected（投递完成）。
	snaps := manager.Snapshot("sess-1")
	if len(snaps) != 1 || snaps[0].State != agentqueue.StatusInjected {
		t.Fatalf("input state: got %+v, want injected", snaps)
	}
}

// TestAgentExecutorCancelOnRequestCancel 验证：请求 ctx 取消后执行器排空
// 剩余事件、标记输入 cancelled、关闭订阅 channel。
func TestAgentExecutorCancelOnRequestCancel(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	ex := newAgentSessionExecutor("sess-1", manager)
	started := make(chan struct{})
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 2)
		ch <- agent.AgentEvent{Type: "turn", TurnID: "turn-test"}
		close(started) // turn 已入队后才通知测试，消除转发竞态
		// 模拟 AgentChat 阻塞在 ctx 上：请求取消后自行关闭 channel。
		go func() {
			<-ctx.Done()
			close(ch)
		}()
		return ch
	}
	go ex.run()
	t.Cleanup(func() { close(ex.stopCh) })

	ctx, cancel := context.WithCancel(context.Background())
	subCh, err := ex.subscribe(ctx)
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}
	defer ex.unsubscribe()

	if _, err := manager.Submit(&agentqueue.Input{
		ID: "in-1", SessionID: "sess-1", Semantics: agentqueue.SemanticsUserMessage,
	}); err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	<-started // turn 已入 events channel
	// 先确认 turn 已被转发到订阅 channel，再取消（确定性时序，避免 select 竞态）。
	select {
	case ev := <-subCh:
		if ev.Type != "turn" {
			t.Fatalf("first event: got %s, want turn", ev.Type)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("turn event was not forwarded")
	}
	cancel() // 模拟前端断开 / 请求取消

	// cancel 后 channel 应关闭（forwardEvents 排空结束 → finishTurn close）。
	events := collectUntilClosed(t, subCh, 5*time.Second)
	if len(events) != 0 {
		t.Fatalf("events after cancel: got %+v, want none", events)
	}
	snaps := manager.Snapshot("sess-1")
	if len(snaps) != 1 || snaps[0].State != agentqueue.StatusCancelled {
		t.Fatalf("input state after cancel: got %+v, want cancelled", snaps)
	}
}

// TestAgentExecutorMarksFailedWithoutSubscriber 验证：无订阅者（正常流程不可达）
// 时输入被标记 failed，不启动 turn。
func TestAgentExecutorMarksFailedWithoutSubscriber(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	ex := newAgentSessionExecutor("sess-1", manager)
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "done"}
		close(ch)
		return ch
	}
	go ex.run()
	t.Cleanup(func() { close(ex.stopCh) })

	if _, err := manager.Submit(&agentqueue.Input{
		ID: "in-1", SessionID: "sess-1", Semantics: agentqueue.SemanticsUserMessage,
	}); err != nil {
		t.Fatalf("submit failed: %v", err)
	}

	// 执行器异步处理：轮询等待状态收敛。
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		snaps := manager.Snapshot("sess-1")
		if len(snaps) > 0 && snaps[0].State == agentqueue.StatusFailed {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("input was not marked failed without a subscriber")
}

// TestAgentExecutorSequentialTurns 验证：同一会话连续两次请求串行处理，
// 每个请求独立订阅并收到自己的 turn 事件流。
func TestAgentExecutorSequentialTurns(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	ex := newAgentSessionExecutor("sess-1", manager)
	var turnSeq int
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		turnSeq++
		ch := make(chan agent.AgentEvent, 2)
		ch <- agent.AgentEvent{Type: "turn", TurnID: input.ID}
		ch <- agent.AgentEvent{Type: "done", TurnID: input.ID}
		close(ch)
		return ch
	}
	go ex.run()
	t.Cleanup(func() { close(ex.stopCh) })

	for i := 1; i <= 2; i++ {
		ctx, cancel := context.WithCancel(context.Background())
		subCh, err := ex.subscribe(ctx)
		if err != nil {
			t.Fatalf("subscribe %d failed: %v", i, err)
		}
		if _, err := manager.Submit(&agentqueue.Input{
			ID:        "in-" + string(rune('0'+i)),
			SessionID: "sess-1",
			Semantics: agentqueue.SemanticsUserMessage,
			Content:   "msg",
		}); err != nil {
			t.Fatalf("submit %d failed: %v", i, err)
		}
		events := collectUntilClosed(t, subCh, 5*time.Second)
		if len(events) != 2 || events[0].TurnID != events[1].TurnID {
			t.Fatalf("turn %d events mismatch: %+v", i, events)
		}
		ex.unsubscribe()
		cancel()
	}
}

// registerTestExecutor 把测试执行器注册到全局注册表并启动，测试结束自动清理。
// selfStop 检查全局 map，因此空闲回收类测试必须显式注册。
func registerTestExecutor(t *testing.T, sessionID string, ex *agentSessionExecutor) {
	t.Helper()
	agentExecutorsMu.Lock()
	agentExecutors[sessionID] = ex
	agentExecutorsMu.Unlock()
	go ex.run()
	t.Cleanup(func() {
		agentExecutorsMu.Lock()
		delete(agentExecutors, sessionID)
		agentExecutorsMu.Unlock()
		select {
		case <-ex.doneCh:
		default:
			close(ex.stopCh)
		}
	})
}

// TestAgentExecutorIdleRecycle 验证：队列持续为空超过 idleTimeout 后执行器
// 自我停止（doneCh 关闭、注册表移除），不随会话数无限常驻。
func TestAgentExecutorIdleRecycle(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	sessionID := "sess-idle-recycle"
	ex := newAgentSessionExecutor(sessionID, manager)
	ex.idleTimeout = 50 * time.Millisecond
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "done"}
		close(ch)
		return ch
	}
	registerTestExecutor(t, sessionID, ex)

	select {
	case <-ex.doneCh:
	case <-time.After(5 * time.Second):
		t.Fatal("executor did not recycle after idle timeout")
	}
	agentExecutorsMu.Lock()
	_, exists := agentExecutors[sessionID]
	agentExecutorsMu.Unlock()
	if exists {
		t.Fatal("executor should be removed from registry after idle recycle")
	}
}

// TestAgentExecutorRecreateAfterRecycle 验证：空闲回收后 getAgentExecutor
// 懒重建新执行器，新消息正常处理（常驻能力不因回收而丢失）。
func TestAgentExecutorRecreateAfterRecycle(t *testing.T) {
	sessionID := "sess-recreate-test"
	t.Cleanup(func() { stopAgentExecutor(sessionID) })

	// 第一代执行器（独立 manager），注册后等空闲回收。
	manager := agentqueue.NewInboxManager(10)
	ex1 := newAgentSessionExecutor(sessionID, manager)
	ex1.idleTimeout = 50 * time.Millisecond
	ex1.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "done"}
		close(ch)
		return ch
	}
	registerTestExecutor(t, sessionID, ex1)

	select {
	case <-ex1.doneCh:
	case <-time.After(5 * time.Second):
		t.Fatal("executor 1 did not recycle")
	}

	// 懒重建：getAgentExecutor 创建第二代（注入测试 turn 函数）。
	ex2 := getAgentExecutor(sessionID)
	if ex2 == ex1 {
		t.Fatal("getAgentExecutor should create a new executor after recycle")
	}
	ex2.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 2)
		ch <- agent.AgentEvent{Type: "turn", TurnID: input.ID}
		ch <- agent.AgentEvent{Type: "done", TurnID: input.ID}
		close(ch)
		return ch
	}

	// 第二代正常处理消息（经全局 manager 入队）。
	ctx, cancel := context.WithCancel(context.Background())
	subCh, err := ex2.subscribe(ctx)
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}
	if _, err := agentInboxManager.Submit(&agentqueue.Input{
		ID: "in-2", SessionID: sessionID, Semantics: agentqueue.SemanticsUserMessage,
	}); err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	events := collectUntilClosed(t, subCh, 5*time.Second)
	if len(events) != 2 || events[0].TurnID != "in-2" {
		t.Fatalf("recreated executor events mismatch: %+v", events)
	}
	ex2.unsubscribe()
	cancel()
}

// TestAgentExecutorPruneHistory 验证：每批消息处理后历史项被截断至 maxRetained。
func TestAgentExecutorPruneHistory(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	sessionID := "sess-prune-test"
	ex := newAgentSessionExecutor(sessionID, manager)
	ex.maxRetained = 2
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "done"}
		close(ch)
		return ch
	}
	go ex.run()
	t.Cleanup(func() { close(ex.stopCh) })

	// 连续 3 个 turn，每个独立订阅（单流限制）。
	for i := 1; i <= 3; i++ {
		ctx, cancel := context.WithCancel(context.Background())
		subCh, err := ex.subscribe(ctx)
		if err != nil {
			t.Fatalf("subscribe %d failed: %v", i, err)
		}
		if _, err := manager.Submit(&agentqueue.Input{
			ID: "in-" + string(rune('0'+i)), SessionID: sessionID, Semantics: agentqueue.SemanticsUserMessage,
		}); err != nil {
			t.Fatalf("submit %d failed: %v", i, err)
		}
		collectUntilClosed(t, subCh, 5*time.Second)
		ex.unsubscribe()
		cancel()
	}

	// 3 条 injected 历史项应被 Prune 截断至 maxRetained=2。
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if snaps := manager.Snapshot(sessionID); len(snaps) <= 2 {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("history was not pruned to maxRetained: got %d items", len(manager.Snapshot(sessionID)))
}

// TestAgentExecutorSubscribeBusy 验证：同一会话已有活动订阅时再次 subscribe
// 返回 ErrAgentSessionBusy（单流限制，不 close 旧 channel）。
func TestAgentExecutorSubscribeBusy(t *testing.T) {
	ex, _ := newTestExecutor(t, "sess-subscribe-busy")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	subCh1, err := ex.subscribe(ctx)
	if err != nil {
		t.Fatalf("first subscribe failed: %v", err)
	}
	if _, err := ex.subscribe(ctx); err != ErrAgentSessionBusy {
		t.Fatalf("second subscribe: got %v, want ErrAgentSessionBusy", err)
	}
	ex.unsubscribe()
	subCh2, err := ex.subscribe(ctx)
	if err != nil {
		t.Fatalf("subscribe after unsubscribe failed: %v", err)
	}
	if subCh1 == subCh2 {
		t.Fatal("unsubscribe should detach the old subscription")
	}
}

// TestAgentExecutorSelfStopSkipsNonEmptyQueue 验证：队列有 pending 时
// selfStop 放弃回收（防止 idle 超时与消息到达竞态导致消息丢失）。
func TestAgentExecutorSelfStopSkipsNonEmptyQueue(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	sessionID := "sess-selfstop-test"
	ex := newAgentSessionExecutor(sessionID, manager)
	ex.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "done"}
		close(ch)
		return ch
	}
	agentExecutorsMu.Lock()
	agentExecutors[sessionID] = ex
	agentExecutorsMu.Unlock()
	t.Cleanup(func() {
		agentExecutorsMu.Lock()
		delete(agentExecutors, sessionID)
		agentExecutorsMu.Unlock()
	})

	// 队列非空：selfStop 应拒绝回收。
	if _, err := manager.Submit(&agentqueue.Input{
		ID: "in-1", SessionID: sessionID, Semantics: agentqueue.SemanticsUserMessage,
	}); err != nil {
		t.Fatalf("submit failed: %v", err)
	}
	if ex.selfStop() {
		t.Fatal("selfStop should refuse to recycle a non-empty queue")
	}
	agentExecutorsMu.Lock()
	_, exists := agentExecutors[sessionID]
	agentExecutorsMu.Unlock()
	if !exists {
		t.Fatal("executor should remain registered after refused recycle")
	}

	// 取空后：selfStop 成功回收。
	if _, err := manager.Take(sessionID, ""); err != nil || manager.PendingCount(sessionID) != 0 {
		t.Fatalf("drain failed: err=%v pending=%d", err, manager.PendingCount(sessionID))
	}
	if !ex.selfStop() {
		t.Fatal("selfStop should recycle an empty queue")
	}
}

// TestAgentExecutorRecreatePreservesInbox 验证竞态 1 的修复：空闲回收后 inbox
// 保留在 manager 中，重建执行器（GetOrCreateInbox 复用）不覆盖竞态窗口内
// 刚入队的消息——保留的消息最终被新执行器处理（不丢失）。
func TestAgentExecutorRecreatePreservesInbox(t *testing.T) {
	sessionID := "sess-recreate-preserve"
	t.Cleanup(func() { stopAgentExecutor(sessionID) })

	// 第一代：全局 manager，短 idle（模拟 getAgentExecutor 但允许注入 idleTimeout）。
	ex1 := newAgentSessionExecutor(sessionID, agentInboxManager)
	ex1.idleTimeout = 50 * time.Millisecond
	ex1.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "done"}
		close(ch)
		return ch
	}
	registerTestExecutor(t, sessionID, ex1)

	// 等空闲回收（selfStop 移出注册表，inbox 保留）。
	select {
	case <-ex1.doneCh:
	case <-time.After(5 * time.Second):
		t.Fatal("executor 1 did not recycle")
	}

	// 竞态窗口：回收后、重建前，消息入队到保留的 inbox。
	if _, err := agentInboxManager.Submit(&agentqueue.Input{
		ID: "in-keep", SessionID: sessionID, Semantics: agentqueue.SemanticsUserMessage,
	}); err != nil {
		t.Fatalf("submit failed: %v", err)
	}

	// 重建：先设置 runTurnFn 再启动（避免 run goroutine 抢先读到 nil 走真实 AgentChat），
	// GetOrCreateInbox 复用保留 inbox（含 in-keep）。
	ex2 := newAgentSessionExecutor(sessionID, agentInboxManager)
	ex2.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		ch := make(chan agent.AgentEvent, 2)
		ch <- agent.AgentEvent{Type: "turn", TurnID: input.ID}
		ch <- agent.AgentEvent{Type: "done", TurnID: input.ID}
		close(ch)
		return ch
	}
	agentExecutorsMu.Lock()
	agentExecutors[sessionID] = ex2
	agentExecutorsMu.Unlock()
	go ex2.run()
	t.Cleanup(func() {
		agentExecutorsMu.Lock()
		delete(agentExecutors, sessionID)
		agentExecutorsMu.Unlock()
		select {
		case <-ex2.doneCh:
		default:
			close(ex2.stopCh)
		}
	})

	// 订阅 + 等待：应处理到保留的消息（in-keep），证明未被覆盖丢失。
	ctx, cancel := context.WithCancel(context.Background())
	subCh, err := ex2.subscribe(ctx)
	if err != nil {
		t.Fatalf("subscribe failed: %v", err)
	}
	events := collectUntilClosed(t, subCh, 5*time.Second)
	if len(events) != 2 || events[0].TurnID != "in-keep" {
		t.Fatalf("preserved message was not processed: %+v", events)
	}
	ex2.unsubscribe()
	cancel()
}
