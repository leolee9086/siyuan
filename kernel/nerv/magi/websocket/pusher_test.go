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
	"strings"
	"testing"
)

func TestNewPusher(t *testing.T) {
	pusher := NewPusher()
	if pusher == nil {
		t.Fatal("NewPusher() returned nil")
	}
}

func TestPusherWritesFullPayloadToDetailLog(t *testing.T) {
	var detail string
	pusher := &Pusher{detailLogf: func(format string, v ...interface{}) {
		detail = fmt.Sprintf(format, v...)
	}}

	err := pusher.Push("session-detail", EventRoundStarted, map[string]interface{}{
		"content": "full prompt content",
	})
	if err != nil {
		t.Fatalf("Push failed: %v", err)
	}
	if !strings.Contains(detail, "full prompt content") {
		t.Fatalf("detail log did not receive full payload: %s", detail)
	}
}

func TestShouldLogEventSummary(t *testing.T) {
	quietEvents := []string{
		EventSeelReplyChunk,
		EventRuntimeStatusUpdated,
		EventLLMRequestSent,
		EventToolCallDetected,
		EventContextHistoryTrimmed,
	}
	for _, eventType := range quietEvents {
		if shouldLogEventSummary(eventType) {
			t.Fatalf("high-frequency event %s must not create CLI summaries", eventType)
		}
	}
	if !shouldLogEventSummary(EventRoundStarted) || !shouldLogEventSummary(EventRoundFailed) ||
		!shouldLogEventSummary(EventConsensusEmitted) {
		t.Fatal("round lifecycle events must remain visible as CLI summaries")
	}
}

func TestPusher_Push(t *testing.T) {
	pusher := NewPusher()

	tests := []struct {
		name      string
		sessionId string
		eventType string
		data      map[string]interface{}
		wantErr   bool
	}{
		{
			name:      "正常推送",
			sessionId: "test-session-123",
			eventType: "ROUND_STARTED",
			data: map[string]interface{}{
				"eventId":   "magi-event-1234567890-1",
				"seq":       1,
				"roundId":   "round-1234567890-1",
				"timestamp": 1234567890000,
				"userInput": "测试输入",
			},
			wantErr: false,
		},
		{
			name:      "空sessionId",
			sessionId: "",
			eventType: "ROUND_STARTED",
			data: map[string]interface{}{
				"eventId": "magi-event-1234567890-1",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := pusher.Push(tt.sessionId, tt.eventType, tt.data)
			if (err != nil) != tt.wantErr {
				t.Errorf("Push() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
