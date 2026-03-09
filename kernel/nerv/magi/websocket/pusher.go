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
	"github.com/siyuan-note/siyuan/kernel/util"
)

const MAGIAppID = "magi"

type Pusher struct{}

func NewPusher() *Pusher {
	return &Pusher{}
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

	if payloadJSON, err := json.Marshal(payload); err == nil {
		logging.LogInfof("MAGI WebSocket push payload=%s", payloadJSON)
	} else {
		logging.LogInfof("MAGI WebSocket push: sessionId=%s, eventType=%s", sessionId, eventType)
	}
	return nil
}
