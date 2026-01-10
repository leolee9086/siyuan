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

package cmd

import (
	"github.com/siyuan-note/siyuan/kernel/cronjob"
)

// cronjobAuthResponse 处理前端发送的CronJob鉴权响应
type cronjobAuthResponse struct {
	*BaseCmd
}

func (cmd *cronjobAuthResponse) Name() string {
	return "cronjob_auth_response"
}

func (cmd *cronjobAuthResponse) IsRead() bool {
	return false // 这是一个写操作
}

func (cmd *cronjobAuthResponse) Exec() {
	reqId := cmd.param["reqId"].(string)
	allow := cmd.param["allow"].(bool)

	// 调用鉴权管理器处理响应
	cronjob.HandleAuthResponse(reqId, allow)

	cmd.PushPayload.Code = 0
	cmd.PushPayload.Msg = "ok"
	cmd.Push()
}
