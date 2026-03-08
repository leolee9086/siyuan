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
	"testing"
)

func TestNewPusher(t *testing.T) {
	pusher := NewPusher()
	if pusher == nil {
		t.Fatal("NewPusher() returned nil")
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
