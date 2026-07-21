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
	"encoding/json"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/observability"
	"github.com/siyuan-note/siyuan/kernel/util"
)

const MAGIAppID = "magi"

type Pusher struct {
	detailLogf func(format string, v ...interface{})
}

func NewPusher() *Pusher {
	return &Pusher{detailLogf: observability.Detailf}
}

// Push 推送MAGI事件到指定会话
// sessionId: 会话ID
// eventType: 事件类型（如 ROUND_STARTED, SEEL_REPLY_CHUNK 等）
// data: 事件数据，必须包含协议要求的元数据字段（eventId, seq, roundId, timestamp）
func (p *Pusher) Push(sessionId string, eventType string, data map[string]interface{}) error {
	if sessionId == "" {
		logging.LogWarnf("MAGI WebSocket push failed: empty sessionId")
		return nil
	}

	event := util.NewCmdResult("magiEvent", 0, util.PushModeSingleSelf)
	event.AppId = MAGIAppID
	event.SessionId = sessionId

	payload := make(map[string]interface{})
	payload["eventType"] = eventType
	payload["sessionId"] = sessionId
	for k, v := range data {
		payload[k] = v
	}

	event.Data = payload
	util.PushEvent(event)

	detailLogf := p.detailLogf
	if detailLogf == nil {
		detailLogf = observability.Detailf
	}
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		detailLogf("websocket push payload marshal failed: sessionId=%s eventType=%s error=%v payload=%#v",
			sessionId, eventType, err, payload)
		logging.LogWarnf("MAGI event payload logging failed: type=[%s] session=[%s] fields=[%d]",
			eventType, sessionId, len(payload))
		return nil
	}
	detailLogf("websocket push payload=%s", payloadJSON)
	if shouldLogEventSummary(eventType) {
		logging.LogInfof("MAGI event pushed: type=[%s] session=[%s] fields=[%d] payload=[%dB]",
			eventType, sessionId, len(payload), len(payloadJSON))
	}
	return nil
}

func shouldLogEventSummary(eventType string) bool {
	switch eventType {
	case EventRoundStarted,
		EventSeelReplyFailed,
		EventDominantSynthesisCompleted,
		EventConsensusEmitted,
		EventRoundFailed,
		EventRoundCancelled,
		EventDeliberationSignalRaised:
		return true
	default:
		return false
	}
}
