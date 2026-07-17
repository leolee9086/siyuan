package agent

import (
	"context"
	"testing"
	"time"
)

func TestSendCriticalEventPreservesToolLifecycleEvent(t *testing.T) {
	ch := make(chan AgentEvent, 1)
	want := AgentEvent{Type: "tool_progress", Name: "web_search", CallID: "call-1"}

	sendCriticalEvent(context.Background(), ch, want)

	select {
	case got := <-ch:
		if got.Type != want.Type || got.Name != want.Name || got.CallID != want.CallID {
			t.Fatalf("unexpected lifecycle event: got %+v want %+v", got, want)
		}
	default:
		t.Fatal("critical lifecycle event was not delivered")
	}
}

func TestSendCriticalEventStopsAfterCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	start := make(chan struct{})
	done := make(chan struct{})
	ch := make(chan AgentEvent)
	go func() {
		close(start)
		sendCriticalEvent(ctx, ch, AgentEvent{Type: "tool_result"})
		close(done)
	}()
	<-start

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("critical event did not stop after cancellation")
	}
}
