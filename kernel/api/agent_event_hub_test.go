// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package api

import (
	"context"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/agent"
)

func receiveAgentSessionEvent(t *testing.T, events <-chan agentSessionEvent) agentSessionEvent {
	t.Helper()
	select {
	case event := <-events:
		return event
	case <-time.After(time.Second):
		t.Fatal("agent session event timeout")
		return agentSessionEvent{}
	}
}

func TestAgentEventHubBroadcastsAndReplaysInOrder(t *testing.T) {
	hub := newAgentSessionEventHub("session-events")
	ctx1, cancel1 := context.WithCancel(context.Background())
	defer cancel1()
	first, unsubscribe1 := hub.subscribe(ctx1, 0)
	defer unsubscribe1()
	for _, token := range []string{"a", "b", "c"} {
		hub.publishAgentEvent(agent.AgentEvent{Type: "content", Token: token})
	}
	for index, expected := range []string{"a", "b", "c"} {
		select {
		case event := <-first:
			if event.EventSeq != int64(index+1) || event.Data["token"] != expected {
				t.Fatalf("live event %d: %+v", index, event)
			}
		case <-time.After(time.Second):
			t.Fatal("live event timeout")
		}
	}

	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	replay, unsubscribe2 := hub.subscribe(ctx2, 1)
	defer unsubscribe2()
	for index, expectedSeq := range []int64{2, 3} {
		select {
		case event := <-replay:
			if event.EventSeq != expectedSeq {
				t.Fatalf("replay event %d: %+v", index, event)
			}
		case <-time.After(time.Second):
			t.Fatal("replay timeout")
		}
	}
}

func TestAgentEventHubInitialReplayStartsAfterLatestCommittedTurn(t *testing.T) {
	hub := newAgentSessionEventHub("session-committed-replay")
	hub.publish("turn", map[string]any{"turnID": "turn-1"})
	hub.publish("content", map[string]any{"turnID": "turn-1", "token": "old"})
	hub.publish("done", map[string]any{"turnID": "turn-1"})
	hub.publish("turn_committed", map[string]any{"turnID": "turn-1"})
	hub.publish("turn", map[string]any{"turnID": "turn-2"})
	hub.publishAgentEvent(agent.AgentEvent{
		Type: "steer_injected", TurnID: "turn-2", InputID: "input-2", UserEntryID: "entry-2",
		Content: "continue", BlockHTML: "<p>continue</p>",
		References: []agent.Reference{{ID: "ref-2", Title: "Reference"}},
	})

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, unsubscribe := hub.subscribe(ctx, 0)
	defer unsubscribe()
	for index, expected := range []struct {
		seq      int64
		typeName string
	}{
		{seq: 5, typeName: "turn"},
		{seq: 6, typeName: "steer_injected"},
	} {
		select {
		case event := <-events:
			if event.EventSeq != expected.seq || event.Type != expected.typeName {
				t.Fatalf("initial replay event %d: %+v", index, event)
			}
			if event.Type == "steer_injected" {
				if event.Data["blockHTML"] != "<p>continue</p>" || event.Data["inputID"] != "input-2" {
					t.Fatalf("steer payload fields were not projected: %+v", event.Data)
				}
			}
		case <-time.After(time.Second):
			t.Fatalf("initial replay event %d timeout", index)
		}
	}
}

func TestAgentEventHubResyncsOldCursor(t *testing.T) {
	hub := newAgentSessionEventHub("session-resync")
	hub.replayLimit = 2
	for i := 0; i < 4; i++ {
		hub.publish("content", map[string]any{"token": i})
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, unsubscribe := hub.subscribe(ctx, 0)
	defer unsubscribe()
	first := <-events
	if first.Type != "resync_required" || first.Data["oldestEventSeq"] != int64(3) {
		t.Fatalf("resync event: %+v", first)
	}
	if got := <-events; got.EventSeq != 3 {
		t.Fatalf("first replay after resync: %+v", got)
	}
	if got := <-events; got.EventSeq != 4 {
		t.Fatalf("second replay after resync: %+v", got)
	}
}

func TestAgentEventHubResyncsCursorAfterHubRestart(t *testing.T) {
	hub := newAgentSessionEventHub("session-restart")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	events, unsubscribe := hub.subscribe(ctx, 50)
	defer unsubscribe()

	resync := receiveAgentSessionEvent(t, events)
	if resync.Type != "resync_required" || resync.EventSeq != 51 || resync.Data["reason"] != "event_history_unavailable" {
		t.Fatalf("restart resync event: %+v", resync)
	}
	state := hub.publish("session_state", map[string]any{"phase": "idle"})
	if state.EventSeq != 52 {
		t.Fatalf("post-restart sequence: got %d want 52", state.EventSeq)
	}
	forwarded := receiveAgentSessionEvent(t, events)
	if forwarded.Type != "session_state" || forwarded.EventSeq != 52 {
		t.Fatalf("post-restart state event: %+v", forwarded)
	}
}

func TestAgentEventHubDropsOnlySlowSubscriber(t *testing.T) {
	hub := newAgentSessionEventHub("session-slow")
	hub.replayLimit = 0
	slowCtx, slowCancel := context.WithCancel(context.Background())
	defer slowCancel()
	slow, _ := hub.subscribe(slowCtx, 0)
	fastCtx, fastCancel := context.WithCancel(context.Background())
	defer fastCancel()
	fast, unsubscribeFast := hub.subscribe(fastCtx, 0)
	defer unsubscribeFast()
	received := make(chan int, 1)
	consumed := make(chan int)
	started := make(chan struct{})
	go func() {
		close(started)
		count := 0
		for range fast {
			count++
			consumed <- count
		}
		received <- count
	}()
	<-started
	for i := 0; i < agentSessionEventBufferSize+32; i++ {
		hub.publish("content", map[string]any{"token": i})
		// 确认活跃订阅者已消费本次事件，再继续填满完全独立的慢订阅者缓冲。
		select {
		case count := <-consumed:
			if count != i+1 {
				t.Fatalf("fast subscriber count: got %d want %d", count, i+1)
			}
		case <-time.After(time.Second):
			t.Fatalf("fast subscriber stalled after event %d", i+1)
		}
	}
	unsubscribeFast()
	select {
	case _, ok := <-slow:
		if ok {
			// Drain until the hub closes this slow subscriber.
			for range slow {
			}
		}
	case <-time.After(time.Second):
		t.Fatal("slow subscriber did not receive/drop")
	}
	select {
	case count := <-received:
		if count != agentSessionEventBufferSize+32 {
			t.Fatalf("fast subscriber lost events: %d", count)
		}
	case <-time.After(time.Second):
		t.Fatal("fast subscriber did not finish")
	}
}

func TestAgentEventHubReportsSubscriberCountChanges(t *testing.T) {
	hub := newAgentSessionEventHub("session-count")
	counts := make(chan int, 4)
	hub.setSubscriberCountChanged(func(count int) { counts <- count })
	ctx1, cancel1 := context.WithCancel(context.Background())
	defer cancel1()
	_, unsubscribe1 := hub.subscribe(ctx1, 0)
	ctx2, cancel2 := context.WithCancel(context.Background())
	defer cancel2()
	_, unsubscribe2 := hub.subscribe(ctx2, 0)
	unsubscribe1()
	unsubscribe2()
	for index, expected := range []int{1, 2, 1, 0} {
		select {
		case count := <-counts:
			if count != expected {
				t.Fatalf("subscriber count change %d: got %d want %d", index, count, expected)
			}
		case <-time.After(time.Second):
			t.Fatalf("subscriber count change %d timeout", index)
		}
	}
}
