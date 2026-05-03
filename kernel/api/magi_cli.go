package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/model"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/cli"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func cliWebSocketHandler(c *gin.Context) {
	conn, err := wsUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logging.LogErrorf("CLI WebSocket upgrade failed: %v", err)
		return
	}

	_, raw, err := conn.ReadMessage()
	if err != nil {
		logging.LogErrorf("CLI WebSocket read auth frame failed: %v", err)
		conn.Close()
		return
	}

	if len(raw) > 4096 {
		_ = conn.WriteJSON(map[string]string{"type": "auth_result", "error": "auth frame too large"})
		conn.Close()
		return
	}

	var auth cli.AuthFrame
	if err := json.Unmarshal(raw, &auth); err != nil {
		_ = conn.WriteJSON(map[string]string{"type": "auth_result", "error": "invalid auth JSON"})
		conn.Close()
		return
	}

	if auth.Type != "auth" {
		_ = conn.WriteJSON(map[string]string{"type": "auth_result", "error": "first frame must be auth"})
		conn.Close()
		return
	}

	toolName, err := cli.SanitizeField(auth.ToolName)
	if err != nil {
		_ = conn.WriteJSON(map[string]string{"type": "auth_result", "error": "invalid toolName"})
		conn.Close()
		return
	}

	workingDir, err := cli.SanitizeField(auth.WorkingDir)
	if err != nil {
		_ = conn.WriteJSON(map[string]string{"type": "auth_result", "error": "invalid workingDir"})
		conn.Close()
		return
	}

	scenario, err := cli.SanitizeField(auth.Scenario)
	if err != nil {
		scenario = "general"
	}

	identity := &cli.Identity{
		ToolName:   toolName,
		WorkingDir: workingDir,
		Scenario:   scenario,
	}

	if auth.Token != "" {
		delegation, verifyErr := verifyCLIToken(auth.Token)
		if verifyErr != nil {
			_ = conn.WriteJSON(map[string]string{"type": "auth_result", "error": "invalid token: " + verifyErr.Error()})
			conn.Close()
			return
		}
		identity.Delegation = delegation
	}

	sessionID := generateCLISessionID()

	adapter := cli.NewAdapter(sessionID, conn, identity)
	channel.Register(adapter)

	if err := adapter.Start(context.Background()); err != nil {
		logging.LogErrorf("CLI adapter start failed: %v", err)
		channel.Unregister(adapter.ID())
		conn.Close()
		return
	}

	<-c.Request.Context().Done()

	_ = adapter.Stop(context.Background())
	channel.Unregister(adapter.ID())
}

func magiIssueCLIToken(c *gin.Context) {
	var req struct {
		UserID string `json:"userId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}
	if req.UserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "userId is required"})
		return
	}
	token, err := model.IssueCLIDelegationToken(req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "issue token failed: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

func generateCLISessionID() string {
	b := make([]byte, 8)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// verifyCLIToken 验证 CLI 代理身份 token 并返回解析后的委托身份。
func verifyCLIToken(token string) (*cli.Delegation, error) {
	if token == "" {
		return nil, nil
	}
	userID, scope, err := model.ParseCLIDelegationToken(token)
	if err != nil {
		return nil, fmt.Errorf("invalid delegation token: %w", err)
	}
	return &cli.Delegation{
		UserID: userID,
		Scope:  scope,
	}, nil
}
