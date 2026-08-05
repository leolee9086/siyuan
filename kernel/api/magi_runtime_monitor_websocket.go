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

package api

import (
	"net/http"
	"strings"
	"time"

	magiwebsocket "github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
)

func isMagiRuntimeMonitorWebSocketRequest(request *http.Request) bool {
	if request == nil || request.URL == nil {
		return false
	}
	query := request.URL.Query()
	return strings.TrimSpace(query.Get("app")) == magiwebsocket.MAGIAppID &&
		strings.TrimSpace(query.Get("id")) == magiwebsocket.RuntimeMonitorSessionID &&
		strings.TrimSpace(query.Get("type")) == "main"
}

func resolveMagiArmorTokenFromWebSocketRequest(request *http.Request) string {
	if request == nil {
		return ""
	}
	for _, protocol := range strings.Split(request.Header.Get("Sec-WebSocket-Protocol"), ",") {
		candidate := strings.TrimSpace(protocol)
		if strings.HasPrefix(candidate, magiArmorTokenPrefix) {
			return candidate
		}
	}
	return ""
}

func negotiateMagiRuntimeMonitorWebSocketProtocol(request *http.Request) string {
	if !isMagiRuntimeMonitorWebSocketRequest(request) {
		return ""
	}
	for _, protocol := range strings.Split(request.Header.Get("Sec-WebSocket-Protocol"), ",") {
		candidate := strings.TrimSpace(protocol)
		if candidate == magiwebsocket.RuntimeMonitorSubprotocol {
			return candidate
		}
	}
	return ""
}

func authorizeMagiRuntimeMonitorWebSocket(request *http.Request) (*magiArmorClaimsV1, *magiSourceAuthError) {
	claims, authErr := verifyMagiArmorToken(resolveMagiArmorTokenFromWebSocketRequest(request))
	if authErr != nil {
		return nil, authErr
	}
	if _, authErr = ensureMagiArmorIdentityConsistency(claims); authErr != nil {
		return nil, authErr
	}
	if claims.Rtc != magiRouteClassGuardian || claims.Chn != magiRequestChannelMainUI {
		return nil, &magiSourceAuthError{
			StatusCode: http.StatusForbidden,
			Code:       "magi_main_ui_history_forbidden",
			Message:    "MAGI main UI history requires a Guardian identity",
		}
	}
	return claims, nil
}

// IsMagiRuntimeMonitorWebSocketRequest 标识会暴露三贤人实时思考及本次启动历史的监控连接。
func IsMagiRuntimeMonitorWebSocketRequest(request *http.Request) bool {
	return isMagiRuntimeMonitorWebSocketRequest(request)
}

// NegotiateMagiRuntimeMonitorWebSocketProtocol 选择 runtime monitor 的公开协议，armor 仍由独立鉴权路径处理。
func NegotiateMagiRuntimeMonitorWebSocketProtocol(request *http.Request) string {
	return negotiateMagiRuntimeMonitorWebSocketProtocol(request)
}

// AuthorizeMagiRuntimeMonitorWebSocket 校验监控连接的 armor 身份，并返回服务端强制断开的到期时间。
func AuthorizeMagiRuntimeMonitorWebSocket(request *http.Request) (time.Time, error) {
	claims, authErr := authorizeMagiRuntimeMonitorWebSocket(request)
	if authErr != nil {
		return time.Time{}, authErr
	}
	return time.Unix(claims.Exp, 0), nil
}
