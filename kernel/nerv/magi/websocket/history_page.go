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

import "encoding/json"

const (
	RuntimeMonitorHistoryDefaultPageLimit = 400
	RuntimeMonitorHistoryMaxPageLimit     = 1000
	RuntimeMonitorHistoryDefaultPageBytes = 2 << 20
	RuntimeMonitorHistoryMaxPageBytes     = 4 << 20
)

// RuntimeMonitorHistoryQuery 定义一次受限历史读取。
type RuntimeMonitorHistoryQuery struct {
	AfterSeq  int64
	BeforeSeq int64
	Limit     int
	MaxBytes  int
}

// RuntimeMonitorHistoryPage 是按序返回的有界监控历史窗口。
type RuntimeMonitorHistoryPage struct {
	Events        []json.RawMessage `json:"events"`
	OldestSeq     int64             `json:"oldestSeq"`
	LatestSeq     int64             `json:"latestSeq"`
	Truncated     bool              `json:"truncated"`
	HasMoreBefore bool              `json:"hasMoreBefore"`
}

func normalizeRuntimeMonitorHistoryQuery(query RuntimeMonitorHistoryQuery) RuntimeMonitorHistoryQuery {
	if query.Limit <= 0 {
		query.Limit = RuntimeMonitorHistoryDefaultPageLimit
	}
	if query.Limit > RuntimeMonitorHistoryMaxPageLimit {
		query.Limit = RuntimeMonitorHistoryMaxPageLimit
	}
	if query.MaxBytes <= 0 {
		query.MaxBytes = RuntimeMonitorHistoryDefaultPageBytes
	}
	if query.MaxBytes > RuntimeMonitorHistoryMaxPageBytes {
		query.MaxBytes = RuntimeMonitorHistoryMaxPageBytes
	}
	return query
}

func (s *runtimeMonitorHistoryStore) snapshot(query RuntimeMonitorHistoryQuery) RuntimeMonitorHistoryPage {
	page := RuntimeMonitorHistoryPage{Events: []json.RawMessage{}}
	if s == nil {
		return page
	}
	query = normalizeRuntimeMonitorHistoryQuery(query)
	s.mu.RLock()
	defer s.mu.RUnlock()
	page.Truncated = s.evicted
	if query.AfterSeq > 0 {
		s.appendForwardPageLocked(&page, query)
	} else {
		s.appendLatestPageLocked(&page, query)
	}
	s.finishPageMetadataLocked(&page)
	return page
}

func appendHistoryEntry(
	page *RuntimeMonitorHistoryPage,
	entry *runtimeMonitorHistoryEntry,
	usedBytes *int,
	maxBytes int,
) bool {
	separatorBytes := 0
	if len(page.Events) > 0 {
		separatorBytes = 1
	}
	if *usedBytes+separatorBytes+entry.encodedSize > maxBytes {
		return false
	}
	page.Events = append(page.Events, append(json.RawMessage(nil), entry.encoded...))
	*usedBytes += separatorBytes + entry.encodedSize
	return true
}

func (s *runtimeMonitorHistoryStore) appendForwardPageLocked(page *RuntimeMonitorHistoryPage, query RuntimeMonitorHistoryQuery) {
	usedBytes := 0
	for element := s.entries.Front(); element != nil; element = element.Next() {
		entry := element.Value.(*runtimeMonitorHistoryEntry)
		if entry.seq <= query.AfterSeq || query.BeforeSeq > 0 && entry.seq >= query.BeforeSeq {
			continue
		}
		if len(page.Events) >= query.Limit || !appendHistoryEntry(page, entry, &usedBytes, query.MaxBytes) {
			page.Truncated = true
			break
		}
	}
}

func (s *runtimeMonitorHistoryStore) appendLatestPageLocked(page *RuntimeMonitorHistoryPage, query RuntimeMonitorHistoryQuery) {
	usedBytes := 0
	reversed := make([]json.RawMessage, 0, query.Limit)
	for element := s.entries.Back(); element != nil; element = element.Prev() {
		entry := element.Value.(*runtimeMonitorHistoryEntry)
		if query.BeforeSeq > 0 && entry.seq >= query.BeforeSeq {
			continue
		}
		separatorBytes := 0
		if len(reversed) > 0 {
			separatorBytes = 1
		}
		if len(reversed) >= query.Limit || usedBytes+separatorBytes+entry.encodedSize > query.MaxBytes {
			page.Truncated = true
			page.HasMoreBefore = true
			break
		}
		reversed = append(reversed, append(json.RawMessage(nil), entry.encoded...))
		usedBytes += separatorBytes + entry.encodedSize
	}
	for index := len(reversed) - 1; index >= 0; index-- {
		page.Events = append(page.Events, reversed[index])
	}
}

func (s *runtimeMonitorHistoryStore) finishPageMetadataLocked(page *RuntimeMonitorHistoryPage) {
	if len(page.Events) == 0 {
		return
	}
	var first map[string]interface{}
	var last map[string]interface{}
	_ = json.Unmarshal(page.Events[0], &first)
	_ = json.Unmarshal(page.Events[len(page.Events)-1], &last)
	page.OldestSeq = eventSequence(first)
	page.LatestSeq = eventSequence(last)
	if front := s.entries.Front(); front != nil {
		page.HasMoreBefore = page.HasMoreBefore || front.Value.(*runtimeMonitorHistoryEntry).seq < page.OldestSeq
	}
}

// RuntimeMonitorHistorySnapshot 返回符合游标、条数和字节预算的历史窗口。
func RuntimeMonitorHistorySnapshot(query RuntimeMonitorHistoryQuery) RuntimeMonitorHistoryPage {
	return runtimeMonitorHistory.snapshot(query)
}
