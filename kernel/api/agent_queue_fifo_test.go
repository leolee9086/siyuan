// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
	"github.com/siyuan-note/siyuan/packages/agentqueue"
)

func TestAgentExecutorAdvancesThreeQueuedTurnsOneCommitAtATime(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	executor := newAgentSessionExecutor("session-fifo", manager)
	started := make(chan string, 3)
	executor.runTurnFn = func(_ context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		executor.turn.TurnStarted(input.ID)
		executor.turn.SetPhase(input.ID, agent.AgentTurnProvider)
		started <- input.ID
		ch := make(chan agent.AgentEvent, 2)
		ch <- agent.AgentEvent{Type: "turn", TurnID: input.ID}
		ch <- agent.AgentEvent{Type: "done", TurnID: input.ID}
		executor.turn.TurnTerminated(input.ID)
		close(ch)
		return ch
	}
	go executor.run()
	t.Cleanup(executor.stop)
	subscriberCtx, subscriberCancel := context.WithCancel(context.Background())
	defer subscriberCancel()
	_, unsubscribe := executor.hub.subscribe(subscriberCtx, 0)
	defer unsubscribe()

	for _, id := range []string{"queue-1", "queue-2", "queue-3"} {
		if _, err := manager.Submit(&agentqueue.Input{
			ID: id, SessionID: "session-fifo", Semantics: agentqueue.SemanticsQueue,
		}); err != nil {
			t.Fatal(err)
		}
	}

	for index, expected := range []string{"queue-1", "queue-2", "queue-3"} {
		select {
		case actual := <-started:
			if actual != expected {
				t.Fatalf("turn %d: got %s want %s", index, actual, expected)
			}
		case <-time.After(5 * time.Second):
			t.Fatalf("turn %d did not start", index)
		}
		deadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(deadline) {
			if state := executor.turn.State(); state.TurnID == expected && state.AwaitingCommit {
				break
			}
			time.Sleep(time.Millisecond)
		}
		if state := executor.turn.State(); state.TurnID != expected || !state.AwaitingCommit {
			t.Fatalf("turn %d did not reach commit barrier: %+v", index, state)
		}
		select {
		case unexpected := <-started:
			t.Fatalf("turn advanced before commit: %s", unexpected)
		case <-time.After(20 * time.Millisecond):
		}
		if err := executor.commitTurn(expected); err != nil {
			t.Fatal(err)
		}
	}

	snapshot := manager.SnapshotVersioned("session-fifo")
	if len(snapshot.Items) != 3 {
		t.Fatalf("queue history length: %+v", snapshot)
	}
	for _, item := range snapshot.Items {
		if item.State != agentqueue.StatusInjected {
			t.Fatalf("queue input did not complete: %+v", snapshot)
		}
	}
}
