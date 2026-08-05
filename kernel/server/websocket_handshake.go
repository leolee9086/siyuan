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

package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/api"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func prepareWebSocketHandshake(context *gin.Context) bool {
	if !api.IsMagiRuntimeMonitorWebSocketRequest(context.Request) {
		return true
	}
	protocol := api.NegotiateMagiRuntimeMonitorWebSocketProtocol(context.Request)
	if protocol == "" {
		context.AbortWithStatus(http.StatusBadRequest)
		return false
	}
	context.Header("Sec-WebSocket-Protocol", protocol)
	return true
}

func handleWebSocketRequest(context *gin.Context) {
	if !prepareWebSocketHandshake(context) {
		return
	}
	if err := util.WebSocketServer.HandleRequest(context.Writer, context.Request); err != nil {
		logging.LogErrorf("handle command failed: %s", err)
	}
}
