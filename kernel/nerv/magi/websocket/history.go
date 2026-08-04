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
	"container/list"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
)

const (
	runtimeMonitorHistoryMaxEvents = 4096
	runtimeMonitorHistoryMaxBytes  = 16 << 20
)

type runtimeMonitorHistoryLimits struct {
	maxEvents int
	maxBytes  int
}

type runtimeMonitorHistoryEntry struct {
	encoded       json.RawMessage
	encodedSize   int
	seq           int64
	compactionKey string
}

type runtimeMonitorHistoryStore struct {
	mu                sync.RWMutex
	entries           *list.List
	compactionEntries map[string]*list.Element
	limits            runtimeMonitorHistoryLimits
	totalBytes        int
	evicted           bool
}

var runtimeMonitorHistory = newRuntimeMonitorHistoryStore()

func newRuntimeMonitorHistoryStore() *runtimeMonitorHistoryStore {
	return newRuntimeMonitorHistoryStoreWithLimits(runtimeMonitorHistoryLimits{
		maxEvents: runtimeMonitorHistoryMaxEvents,
		maxBytes:  runtimeMonitorHistoryMaxBytes,
	})
}

func newRuntimeMonitorHistoryStoreWithLimits(limits runtimeMonitorHistoryLimits) *runtimeMonitorHistoryStore {
	if limits.maxEvents <= 0 {
		limits.maxEvents = runtimeMonitorHistoryMaxEvents
	}
	if limits.maxBytes <= 0 {
		limits.maxBytes = runtimeMonitorHistoryMaxBytes
	}
	return &runtimeMonitorHistoryStore{
		entries:           list.New(),
		compactionEntries: map[string]*list.Element{},
		limits:            limits,
	}
}

func (s *runtimeMonitorHistoryStore) append(payload map[string]interface{}) {
	if s == nil || len(payload) == 0 {
		return
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return
	}
	entry := &runtimeMonitorHistoryEntry{
		encoded:       append(json.RawMessage(nil), encoded...),
		encodedSize:   len(encoded),
		seq:           eventSequence(payload),
		compactionKey: runtimeMonitorCompactionKey(payload),
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	if entry.compactionKey != "" {
		if element, ok := s.compactionEntries[entry.compactionKey]; ok {
			previous := element.Value.(*runtimeMonitorHistoryEntry)
			s.totalBytes -= previous.encodedSize
			element.Value = entry
			s.totalBytes += entry.encodedSize
			s.entries.MoveToBack(element)
			s.trimLocked()
			return
		}
	}
	element := s.entries.PushBack(entry)
	if entry.compactionKey != "" {
		s.compactionEntries[entry.compactionKey] = element
	}
	s.totalBytes += entry.encodedSize
	s.trimLocked()
}

func (s *runtimeMonitorHistoryStore) trimLocked() {
	for s.entries.Len() > s.limits.maxEvents || s.totalBytes > s.limits.maxBytes {
		oldest := s.entries.Front()
		if oldest == nil {
			return
		}
		s.removeElementLocked(oldest)
		s.evicted = true
	}
}

func (s *runtimeMonitorHistoryStore) removeElementLocked(element *list.Element) {
	entry := element.Value.(*runtimeMonitorHistoryEntry)
	if entry.compactionKey != "" && s.compactionEntries[entry.compactionKey] == element {
		delete(s.compactionEntries, entry.compactionKey)
	}
	s.totalBytes -= entry.encodedSize
	s.entries.Remove(element)
}

func (s *runtimeMonitorHistoryStore) resetForTests() {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = list.New()
	s.compactionEntries = map[string]*list.Element{}
	s.totalBytes = 0
	s.evicted = false
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
		return eventType
	default:
		return ""
	}
}

// recordRuntimeMonitorEvent 只保存当前进程内可丢弃的 MAGI 监控窗口。
func recordRuntimeMonitorEvent(sessionID string, payload map[string]interface{}) {
	if sessionID != RuntimeMonitorSessionID {
		return
	}
	runtimeMonitorHistory.append(payload)
}

func resetRuntimeMonitorHistoryForTests() {
	runtimeMonitorHistory.resetForTests()
}
