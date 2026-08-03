// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package websocket

import "testing"

func TestRuntimeMonitorHistoryCompactsStreamingDeltas(t *testing.T) {
	store := newRuntimeMonitorHistoryStore()
	store.append(map[string]interface{}{
		"eventType": EventSeelReplyChunk,
		"eventId":   "chunk-1",
		"seq":       int64(1),
		"roundId":   "round-1",
		"seelName":  "melchior",
		"content":   "first",
	})
	store.append(map[string]interface{}{
		"eventType": EventSeelReplyChunk,
		"eventId":   "chunk-2",
		"seq":       int64(2),
		"roundId":   "round-1",
		"seelName":  "melchior",
		"content":   "complete thought",
	})
	store.append(map[string]interface{}{
		"eventType": EventSeelReplyCompleted,
		"eventId":   "complete-3",
		"seq":       int64(3),
		"roundId":   "round-1",
		"seelName":  "melchior",
	})

	history := store.snapshot(0)
	if len(history) != 2 {
		t.Fatalf("expected compacted chunk plus completion, got %d", len(history))
	}
	if got := history[0]["eventId"]; got != "chunk-2" {
		t.Fatalf("expected latest streaming chunk, got %v", got)
	}
	if got := history[1]["eventId"]; got != "complete-3" {
		t.Fatalf("expected completion after compacted chunk, got %v", got)
	}
}

func TestRuntimeMonitorHistoryFiltersAfterSequence(t *testing.T) {
	store := newRuntimeMonitorHistoryStore()
	for seq := int64(1); seq <= 3; seq++ {
		store.append(map[string]interface{}{
			"eventType": EventRoundStarted,
			"eventId":   seq,
			"seq":       seq,
			"roundId":   seq,
		})
	}

	history := store.snapshot(2)
	if len(history) != 1 || eventSequence(history[0]) != 3 {
		t.Fatalf("expected only seq 3 after cursor, got %+v", history)
	}
}

func TestRuntimeMonitorHistorySnapshotDoesNotExposeStoredMap(t *testing.T) {
	store := newRuntimeMonitorHistoryStore()
	store.append(map[string]interface{}{
		"eventType": EventRoundStarted,
		"eventId":   "event-1",
		"seq":       int64(1),
		"roundId":   "round-1",
	})

	first := store.snapshot(0)
	first[0]["eventId"] = "mutated"
	second := store.snapshot(0)
	if got := second[0]["eventId"]; got != "event-1" {
		t.Fatalf("snapshot mutation changed stored history: %v", got)
	}
}
