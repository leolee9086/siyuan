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
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/olahol/melody"
	magiwebsocket "github.com/siyuan-note/siyuan/kernel/nerv/magi/websocket"
	"github.com/siyuan-note/siyuan/kernel/util"
)

func newWebSocketHandshakeTestEndpoint(t *testing.T) string {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previousServer := util.WebSocketServer
	webSocketServer := melody.New()
	util.WebSocketServer = webSocketServer
	engine := gin.New()
	engine.GET("/ws", handleWebSocketRequest)
	server := httptest.NewServer(engine)
	t.Cleanup(func() {
		_ = webSocketServer.Close()
		server.Close()
		util.WebSocketServer = previousServer
	})
	return "ws" + strings.TrimPrefix(server.URL, "http") + "/ws"
}

func runtimeMonitorWebSocketURL(endpoint string) string {
	return endpoint + "?app=magi&id=" + magiwebsocket.RuntimeMonitorSessionID + "&type=main"
}

func TestMagiRuntimeMonitorWebSocketNegotiatesPublicProtocolOnWire(t *testing.T) {
	endpoint := newWebSocketHandshakeTestEndpoint(t)
	armorToken := "magi_ak_v1_probe.signature"
	dialer := websocket.Dialer{Subprotocols: []string{
		magiwebsocket.RuntimeMonitorSubprotocol,
		armorToken,
	}}

	connection, response, err := dialer.Dial(runtimeMonitorWebSocketURL(endpoint), nil)
	if err != nil {
		t.Fatalf("websocket handshake failed: %v", err)
	}
	defer connection.Close()
	if got := connection.Subprotocol(); got != magiwebsocket.RuntimeMonitorSubprotocol {
		t.Fatalf("selected protocol = %q, want %q", got, magiwebsocket.RuntimeMonitorSubprotocol)
	}
	if got := response.Header.Get("Sec-WebSocket-Protocol"); got != magiwebsocket.RuntimeMonitorSubprotocol {
		t.Fatalf("response protocol = %q, want %q", got, magiwebsocket.RuntimeMonitorSubprotocol)
	}
	if strings.Contains(response.Header.Get("Sec-WebSocket-Protocol"), armorToken) {
		t.Fatal("websocket response exposed the armor token")
	}
}

func TestMagiRuntimeMonitorWebSocketRejectsMissingPublicProtocolBeforeUpgrade(t *testing.T) {
	endpoint := newWebSocketHandshakeTestEndpoint(t)
	dialer := websocket.Dialer{Subprotocols: []string{"magi_ak_v1_probe.signature"}}

	connection, response, err := dialer.Dial(runtimeMonitorWebSocketURL(endpoint), nil)
	if connection != nil {
		connection.Close()
	}
	if err == nil {
		t.Fatal("expected websocket handshake to reject a missing public protocol")
	}
	if response == nil {
		t.Fatal("expected an HTTP response for the rejected handshake")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusBadRequest {
		t.Fatalf("handshake status = %d, want %d", response.StatusCode, http.StatusBadRequest)
	}
}

func TestOrdinaryWebSocketStillConnectsWithoutSubprotocol(t *testing.T) {
	endpoint := newWebSocketHandshakeTestEndpoint(t)

	connection, _, err := websocket.DefaultDialer.Dial(endpoint+"?app=siyuan&id=ordinary&type=main", nil)
	if err != nil {
		t.Fatalf("ordinary websocket handshake failed: %v", err)
	}
	defer connection.Close()
	if got := connection.Subprotocol(); got != "" {
		t.Fatalf("ordinary websocket selected unexpected protocol %q", got)
	}
}
