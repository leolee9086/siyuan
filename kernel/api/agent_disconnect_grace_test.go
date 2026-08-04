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

func TestAgentExecutorInterruptsAfterLastSubscriberGrace(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	executor := newAgentSessionExecutor("session-disconnect", manager)
	executor.disconnectGrace = 30 * time.Millisecond
	started := make(chan struct{})
	cancelled := make(chan struct{})
	executor.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		executor.turn.TurnStarted(input.ID)
		executor.turn.SetPhase(input.ID, agent.AgentTurnProvider)
		ch := make(chan agent.AgentEvent, 1)
		ch <- agent.AgentEvent{Type: "turn", TurnID: input.ID}
		close(started)
		go func() {
			<-ctx.Done()
			executor.turn.TurnTerminated(input.ID)
			close(cancelled)
			close(ch)
		}()
		return ch
	}
	go executor.run()
	t.Cleanup(executor.stop)

	subscriberCtx, subscriberCancel := context.WithCancel(context.Background())
	defer subscriberCancel()
	_, unsubscribe := executor.hub.subscribe(subscriberCtx, 0)
	for _, id := range []string{"queue-1", "queue-2"} {
		if _, err := manager.Submit(&agentqueue.Input{
			ID: id, SessionID: "session-disconnect", Semantics: agentqueue.SemanticsQueue,
		}); err != nil {
			t.Fatal(err)
		}
	}
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("turn did not start")
	}
	unsubscribe()
	select {
	case <-cancelled:
	case <-time.After(5 * time.Second):
		t.Fatal("turn was not interrupted after disconnect grace")
	}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		snapshot := manager.SnapshotVersioned("session-disconnect")
		if len(snapshot.Items) == 2 && snapshot.Items[0].State == agentqueue.StatusCancelled && snapshot.Items[1].State == agentqueue.StatusPending {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	snapshot := manager.SnapshotVersioned("session-disconnect")
	if len(snapshot.Items) != 2 || snapshot.Items[0].State != agentqueue.StatusCancelled || snapshot.Items[1].State != agentqueue.StatusPending {
		t.Fatalf("disconnect changed queued work: %+v", snapshot)
	}
	replayCtx, replayCancel := context.WithCancel(context.Background())
	defer replayCancel()
	replay, unsubscribeReplay := executor.hub.subscribe(replayCtx, 0)
	defer unsubscribeReplay()
	seenInterrupted := false
	for !seenInterrupted {
		select {
		case event := <-replay:
			seenInterrupted = event.Type == "interrupted" && event.Data["turnID"] == "queue-1"
		case <-time.After(5 * time.Second):
			t.Fatal("interrupted event was not retained for replay")
		}
	}
}

func TestAgentExecutorReconnectCancelsDisconnectGrace(t *testing.T) {
	manager := agentqueue.NewInboxManager(10)
	executor := newAgentSessionExecutor("session-reconnect", manager)
	executor.disconnectGrace = 80 * time.Millisecond
	started := make(chan struct{})
	release := make(chan struct{})
	contextCancelled := make(chan struct{})
	finished := make(chan struct{})
	executor.runTurnFn = func(ctx context.Context, input *agentqueue.Input) <-chan agent.AgentEvent {
		executor.turn.TurnStarted(input.ID)
		executor.turn.SetPhase(input.ID, agent.AgentTurnProvider)
		ch := make(chan agent.AgentEvent, 2)
		ch <- agent.AgentEvent{Type: "turn", TurnID: input.ID}
		close(started)
		go func() {
			select {
			case <-ctx.Done():
				close(contextCancelled)
			case <-release:
				ch <- agent.AgentEvent{Type: "done", TurnID: input.ID}
			}
			executor.turn.TurnTerminated(input.ID)
			close(ch)
			close(finished)
		}()
		return ch
	}
	go executor.run()
	t.Cleanup(executor.stop)

	firstCtx, firstCancel := context.WithCancel(context.Background())
	defer firstCancel()
	_, unsubscribeFirst := executor.hub.subscribe(firstCtx, 0)
	if _, err := manager.Submit(&agentqueue.Input{
		ID: "queue-1", SessionID: "session-reconnect", Semantics: agentqueue.SemanticsQueue,
	}); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("turn did not start")
	}
	unsubscribeFirst()
	time.Sleep(20 * time.Millisecond)
	secondCtx, secondCancel := context.WithCancel(context.Background())
	defer secondCancel()
	_, unsubscribeSecond := executor.hub.subscribe(secondCtx, 0)
	defer unsubscribeSecond()

	select {
	case <-contextCancelled:
		t.Fatal("turn was interrupted despite reconnecting within grace")
	case <-time.After(2 * executor.disconnectGrace):
	}
	close(release)
	select {
	case <-finished:
	case <-time.After(5 * time.Second):
		t.Fatal("turn did not finish after release")
	}
	select {
	case <-contextCancelled:
		t.Fatal("reconnected turn context was cancelled")
	default:
	}
}
