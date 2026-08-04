// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org

package websocket

import (
	"encoding/json"
	"strings"
	"testing"
)

func decodeRuntimeMonitorHistoryEvent(t *testing.T, raw json.RawMessage) map[string]interface{} {
	t.Helper()
	var event map[string]interface{}
	if err := json.Unmarshal(raw, &event); err != nil {
		t.Fatalf("decode history event failed: %v", err)
	}
	return event
}

func snapshotRuntimeMonitorHistoryForTests(store *runtimeMonitorHistoryStore, afterSeq int64) RuntimeMonitorHistoryPage {
	return store.snapshot(RuntimeMonitorHistoryQuery{
		AfterSeq: afterSeq,
		Limit:    100,
		MaxBytes: 1 << 20,
	})
}

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

	page := snapshotRuntimeMonitorHistoryForTests(store, 0)
	if len(page.Events) != 2 {
		t.Fatalf("expected compacted chunk plus completion, got %d", len(page.Events))
	}
	if got := decodeRuntimeMonitorHistoryEvent(t, page.Events[0])["eventId"]; got != "chunk-2" {
		t.Fatalf("expected latest streaming chunk, got %v", got)
	}
	if got := decodeRuntimeMonitorHistoryEvent(t, page.Events[1])["eventId"]; got != "complete-3" {
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

	page := snapshotRuntimeMonitorHistoryForTests(store, 2)
	if len(page.Events) != 1 || eventSequence(decodeRuntimeMonitorHistoryEvent(t, page.Events[0])) != 3 {
		t.Fatalf("expected only seq 3 after cursor, got %+v", page.Events)
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

	first := snapshotRuntimeMonitorHistoryForTests(store, 0)
	first.Events[0][0] = 'x'
	second := snapshotRuntimeMonitorHistoryForTests(store, 0)
	if got := decodeRuntimeMonitorHistoryEvent(t, second.Events[0])["eventId"]; got != "event-1" {
		t.Fatalf("snapshot mutation changed stored history: %v", got)
	}
}

func TestRuntimeMonitorHistoryBoundsRetainedEventCount(t *testing.T) {
	store := newRuntimeMonitorHistoryStoreWithLimits(runtimeMonitorHistoryLimits{maxEvents: 3, maxBytes: 1 << 20})
	for seq := int64(1); seq <= 5; seq++ {
		store.append(map[string]interface{}{
			"eventType": EventRoundStarted,
			"eventId":   seq,
			"seq":       seq,
			"roundId":   seq,
		})
	}

	page := snapshotRuntimeMonitorHistoryForTests(store, 0)
	if len(page.Events) != 3 {
		t.Fatalf("expected three retained events, got %d", len(page.Events))
	}
	if got := eventSequence(decodeRuntimeMonitorHistoryEvent(t, page.Events[0])); got != 3 {
		t.Fatalf("expected oldest retained seq 3, got %d", got)
	}
	if !page.Truncated || page.HasMoreBefore {
		t.Fatalf("expected retained-window truncation metadata, got %+v", page)
	}
}

func TestRuntimeMonitorHistoryBoundsRetainedEncodedBytes(t *testing.T) {
	limits := runtimeMonitorHistoryLimits{maxEvents: 10, maxBytes: 900}
	store := newRuntimeMonitorHistoryStoreWithLimits(limits)
	for seq := int64(1); seq <= 5; seq++ {
		store.append(map[string]interface{}{
			"eventType": EventRoundStarted,
			"eventId":   seq,
			"seq":       seq,
			"roundId":   seq,
			"content":   strings.Repeat("x", 300),
		})
	}

	if store.totalBytes > limits.maxBytes {
		t.Fatalf("retained history exceeded byte budget: got %d, max %d", store.totalBytes, limits.maxBytes)
	}
	page := snapshotRuntimeMonitorHistoryForTests(store, 0)
	if len(page.Events) >= 5 {
		t.Fatalf("expected byte budget to evict old events, got %d", len(page.Events))
	}
}

func TestRuntimeMonitorHistoryMovesCompactedEventToNewestPosition(t *testing.T) {
	store := newRuntimeMonitorHistoryStoreWithLimits(runtimeMonitorHistoryLimits{maxEvents: 2, maxBytes: 1 << 20})
	store.append(map[string]interface{}{
		"eventType": EventSeelReplyChunk,
		"eventId":   "chunk-1",
		"seq":       int64(1),
		"roundId":   "round-1",
		"seelName":  "melchior",
	})
	store.append(map[string]interface{}{
		"eventType": EventRoundStarted,
		"eventId":   "round-2",
		"seq":       int64(2),
		"roundId":   "round-2",
	})
	store.append(map[string]interface{}{
		"eventType": EventSeelReplyChunk,
		"eventId":   "chunk-3",
		"seq":       int64(3),
		"roundId":   "round-1",
		"seelName":  "melchior",
	})
	store.append(map[string]interface{}{
		"eventType": EventRoundStarted,
		"eventId":   "round-4",
		"seq":       int64(4),
		"roundId":   "round-4",
	})

	page := snapshotRuntimeMonitorHistoryForTests(store, 0)
	if len(page.Events) != 2 {
		t.Fatalf("expected two retained events, got %d", len(page.Events))
	}
	if got := decodeRuntimeMonitorHistoryEvent(t, page.Events[0])["eventId"]; got != "chunk-3" {
		t.Fatalf("expected updated compacted chunk to survive eviction, got %v", got)
	}
}

func TestRuntimeMonitorHistorySnapshotRespectsCountAndByteBudgets(t *testing.T) {
	store := newRuntimeMonitorHistoryStoreWithLimits(runtimeMonitorHistoryLimits{maxEvents: 20, maxBytes: 1 << 20})
	for seq := int64(1); seq <= 6; seq++ {
		store.append(map[string]interface{}{
			"eventType": EventRoundStarted,
			"eventId":   seq,
			"seq":       seq,
			"roundId":   seq,
			"content":   strings.Repeat("x", 180),
		})
	}

	page := store.snapshot(RuntimeMonitorHistoryQuery{Limit: 2, MaxBytes: 600})
	if len(page.Events) != 2 {
		t.Fatalf("expected response count limit 2, got %d", len(page.Events))
	}
	encoded, err := json.Marshal(page.Events)
	if err != nil {
		t.Fatalf("encode page events failed: %v", err)
	}
	if len(encoded) > 602 {
		t.Fatalf("response exceeded approximate event byte budget: %d", len(encoded))
	}
	if page.OldestSeq != 5 || page.LatestSeq != 6 || !page.Truncated {
		t.Fatalf("unexpected latest-window metadata: %+v", page)
	}
}

func TestRuntimeMonitorHistoryPaginatesBeforeSequenceWithoutEmptyPageLoop(t *testing.T) {
	store := newRuntimeMonitorHistoryStoreWithLimits(runtimeMonitorHistoryLimits{maxEvents: 20, maxBytes: 1 << 20})
	for seq := int64(1); seq <= 6; seq++ {
		store.append(map[string]interface{}{
			"eventType": EventRoundStarted,
			"eventId":   seq,
			"seq":       seq,
			"roundId":   seq,
		})
	}

	page := store.snapshot(RuntimeMonitorHistoryQuery{BeforeSeq: 5, Limit: 2, MaxBytes: 1 << 20})
	if page.OldestSeq != 3 || page.LatestSeq != 4 || !page.HasMoreBefore {
		t.Fatalf("unexpected first backward page: %+v", page)
	}
	oldestPage := store.snapshot(RuntimeMonitorHistoryQuery{BeforeSeq: page.OldestSeq, Limit: 2, MaxBytes: 1 << 20})
	if oldestPage.OldestSeq != 1 || oldestPage.LatestSeq != 2 || oldestPage.HasMoreBefore {
		t.Fatalf("unexpected oldest backward page: %+v", oldestPage)
	}
	emptyPage := store.snapshot(RuntimeMonitorHistoryQuery{BeforeSeq: oldestPage.OldestSeq, Limit: 2, MaxBytes: 1 << 20})
	if len(emptyPage.Events) != 0 || emptyPage.HasMoreBefore {
		t.Fatalf("cursor before retained history must terminate pagination: %+v", emptyPage)
	}
}
