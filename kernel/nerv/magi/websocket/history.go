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

package websocket

import (
	"fmt"
	"sort"
	"strings"
	"sync"
)

type runtimeMonitorHistoryStore struct {
	mu                sync.RWMutex
	events            []map[string]interface{}
	compactionIndexes map[string]int
}

var runtimeMonitorHistory = newRuntimeMonitorHistoryStore()

func newRuntimeMonitorHistoryStore() *runtimeMonitorHistoryStore {
	return &runtimeMonitorHistoryStore{compactionIndexes: map[string]int{}}
}

func (s *runtimeMonitorHistoryStore) append(payload map[string]interface{}) {
	if s == nil || len(payload) == 0 {
		return
	}
	cloned := cloneEventPayload(payload)
	compactionKey := runtimeMonitorCompactionKey(cloned)

	s.mu.Lock()
	defer s.mu.Unlock()
	if compactionKey != "" {
		if index, ok := s.compactionIndexes[compactionKey]; ok {
			s.events[index] = cloned
			return
		}
		s.compactionIndexes[compactionKey] = len(s.events)
	}
	s.events = append(s.events, cloned)
}

func (s *runtimeMonitorHistoryStore) snapshot(afterSeq int64) []map[string]interface{} {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]map[string]interface{}, 0, len(s.events))
	for _, event := range s.events {
		if eventSequence(event) <= afterSeq {
			continue
		}
		result = append(result, cloneEventPayload(event))
	}
	sort.SliceStable(result, func(i, j int) bool {
		return eventSequence(result[i]) < eventSequence(result[j])
	})
	return result
}

func (s *runtimeMonitorHistoryStore) resetForTests() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = nil
	s.compactionIndexes = map[string]int{}
}

func cloneEventPayload(payload map[string]interface{}) map[string]interface{} {
	cloned := make(map[string]interface{}, len(payload))
	for key, value := range payload {
		cloned[key] = value
	}
	return cloned
}

func eventSequence(payload map[string]interface{}) int64 {
	switch value := payload["seq"].(type) {
	case int64:
		return value
	case int:
		return int64(value)
	case float64:
		return int64(value)
	default:
		return 0
	}
}

func runtimeMonitorCompactionKey(payload map[string]interface{}) string {
	eventType := strings.TrimSpace(fmt.Sprint(payload["eventType"]))
	roundID := strings.TrimSpace(fmt.Sprint(payload["roundId"]))
	seelName := strings.TrimSpace(fmt.Sprint(payload["seelName"]))
	switch eventType {
	case EventSeelReplyChunk:
		return strings.Join([]string{eventType, roundID, seelName}, ":")
	case EventToolCallDetected, EventSeelToolActivityUpdated:
		toolCallID := strings.TrimSpace(fmt.Sprint(payload["toolCallId"]))
		toolCallIndex := strings.TrimSpace(fmt.Sprint(payload["toolCallIndex"]))
		return strings.Join([]string{eventType, roundID, seelName, toolCallID, toolCallIndex}, ":")
	case EventRuntimeStatusUpdated:
		return strings.Join([]string{eventType, roundID}, ":")
	default:
		return ""
	}
}

// recordRuntimeMonitorEvent keeps only the current process' MAGI monitor stream.
// These entries are transient UI/debug state for reload replay, not personality
// memory and not long-term note storage. High-frequency deltas are compacted to
// their latest semantic state so a reload does not recreate atomic stream noise.
func recordRuntimeMonitorEvent(sessionID string, payload map[string]interface{}) {
	if sessionID != RuntimeMonitorSessionID {
		return
	}
	runtimeMonitorHistory.append(payload)
}

// RuntimeMonitorHistorySnapshot returns MAGI monitor events emitted since the
// current kernel process started and newer than afterSeq.
func RuntimeMonitorHistorySnapshot(afterSeq int64) []map[string]interface{} {
	return runtimeMonitorHistory.snapshot(afterSeq)
}

func resetRuntimeMonitorHistoryForTests() {
	runtimeMonitorHistory.resetForTests()
}
