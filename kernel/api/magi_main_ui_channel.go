package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/sashabaranov/go-openai"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/types"
)

const (
	magiMainUIChannelID   = "magi-main-ui"
	magiMainUIChannelType = "magi-main-ui"
	magiMainUIAccountID   = "workspace"
)

type magiMainUIHistoryRequest struct {
	Before int64 `json:"before"`
	Limit  int   `json:"limit"`
}

type magiMainUIHistoryMessage struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Content   string `json:"content"`
	CreatedAt int64  `json:"createdAt"`
}

type magiMainUIHistoryResponse struct {
	ConversationID string                     `json:"conversationId"`
	Messages       []magiMainUIHistoryMessage `json:"messages"`
	HasMore        bool                       `json:"hasMore"`
	OldestAt       int64                      `json:"oldestAt,omitempty"`
}

func authorizeMagiMainUIHistory(sourceCtx *types.RequestSourceContext) *magiSourceAuthError {
	if isMagiMainUISource(sourceCtx) && sourceCtx.DirectResponseAllowed {
		return nil
	}
	return &magiSourceAuthError{
		StatusCode: http.StatusForbidden,
		Code:       "magi_main_ui_history_forbidden",
		Message:    "MAGI main UI history requires a Guardian identity",
	}
}

func magiMainUIConversationID(identityID string) string {
	hash := sha256.Sum256([]byte(strings.TrimSpace(identityID)))
	return "magi-main-ui-" + hex.EncodeToString(hash[:16])
}

func isMagiMainUISource(sourceCtx *types.RequestSourceContext) bool {
	return sourceCtx != nil &&
		sourceCtx.Channel == types.SourceChannelGuardian &&
		sourceCtx.InterfaceKind == magiMainUIChannelID &&
		strings.TrimSpace(sourceCtx.IdentityID) != "" &&
		sourceCtx.ConversationID == magiMainUIConversationID(sourceCtx.IdentityID)
}

func requireMagiMainUIMessageStore() (*channel.MessageStore, error) {
	store := channel.GlobalMessageStore()
	if store == nil {
		return nil, errors.New("MAGI channel message store is not initialized")
	}
	return store, nil
}

func persistMagiMainUIInbound(ctx context.Context, req *openai.ChatCompletionRequest, sourceCtx *types.RequestSourceContext) error {
	if !isMagiMainUISource(sourceCtx) {
		return nil
	}
	store, err := requireMagiMainUIMessageStore()
	if err != nil {
		return err
	}
	return saveMagiMainUIInbound(ctx, store, req, sourceCtx)
}

func saveMagiMainUIInbound(ctx context.Context, store *channel.MessageStore, req *openai.ChatCompletionRequest, sourceCtx *types.RequestSourceContext) error {
	if store == nil {
		return errors.New("MAGI channel message store is not initialized")
	}
	history := extractClaimedRecentHistory(req.Messages)
	content, ok := findLastClaimedUserMessage(history)
	if !ok {
		return errors.New("MAGI main UI request has no user message to persist")
	}
	return store.SaveInbound(ctx, &channel.InboundMessage{
		ChannelID:           magiMainUIChannelID,
		ChannelType:         magiMainUIChannelType,
		AccountID:           magiMainUIAccountID,
		UserID:              sourceCtx.PrincipalID,
		Nickname:            sourceCtx.Nickname,
		IdentityID:          sourceCtx.IdentityID,
		IdentityDisplayName: sourceCtx.Nickname,
		Text:                content,
		ConversationToken:   sourceCtx.ConversationID,
		Timestamp:           time.Now().UnixMilli(),
	})
}

func persistMagiMainUIOutbound(ctx context.Context, message *types.Message, sourceCtx *types.RequestSourceContext) error {
	if !isMagiMainUISource(sourceCtx) {
		return nil
	}
	store, err := requireMagiMainUIMessageStore()
	if err != nil {
		return err
	}
	return saveMagiMainUIOutbound(ctx, store, message, sourceCtx)
}

func saveMagiMainUIOutbound(ctx context.Context, store *channel.MessageStore, message *types.Message, sourceCtx *types.RequestSourceContext) error {
	if store == nil {
		return errors.New("MAGI channel message store is not initialized")
	}
	if message == nil || strings.TrimSpace(message.Content) == "" {
		return errors.New("MAGI main UI response has no content to persist")
	}
	return store.SaveOutbound(ctx, &channel.OutboundMessage{
		ChannelID:           magiMainUIChannelID,
		ChannelType:         magiMainUIChannelType,
		AccountID:           magiMainUIAccountID,
		UserID:              sourceCtx.PrincipalID,
		IdentityID:          sourceCtx.IdentityID,
		IdentityDisplayName: sourceCtx.Nickname,
		Text:                message.Content,
		ConversationToken:   sourceCtx.ConversationID,
	})
}

func queryMagiMainUIHistory(ctx context.Context, store *channel.MessageStore, sourceCtx *types.RequestSourceContext, before int64, limit int) (*magiMainUIHistoryResponse, error) {
	if authErr := authorizeMagiMainUIHistory(sourceCtx); authErr != nil {
		return nil, authErr
	}
	if store == nil {
		return nil, errors.New("MAGI channel message store is not initialized")
	}
	result, err := store.Query(ctx, channel.QueryOptions{
		ChannelID:      magiMainUIChannelID,
		ChannelType:    magiMainUIChannelType,
		AccountID:      magiMainUIAccountID,
		IdentityID:     sourceCtx.IdentityID,
		ConversationID: sourceCtx.ConversationID,
		Before:         before,
		Limit:          limit,
	})
	if err != nil {
		return nil, fmt.Errorf("query MAGI main UI history: %w", err)
	}
	messages := make([]magiMainUIHistoryMessage, 0, len(result.Messages))
	for i := len(result.Messages) - 1; i >= 0; i-- {
		persisted := result.Messages[i]
		role := openai.ChatMessageRoleUser
		if persisted.Direction == channel.DirOutbound {
			role = openai.ChatMessageRoleAssistant
		}
		messages = append(messages, magiMainUIHistoryMessage{
			ID: persisted.ID, Role: role, Content: persisted.Text, CreatedAt: persisted.CreatedAt,
		})
	}
	return &magiMainUIHistoryResponse{
		ConversationID: sourceCtx.ConversationID,
		Messages:       messages,
		HasMore:        result.HasMore,
		OldestAt:       result.OldestAt,
	}, nil
}

func magiMainUIHistory(c *gin.Context) {
	var req magiMainUIHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "code": "magi_main_ui_history_request_invalid"})
		return
	}
	sourceCtx, authErr := buildRequestSourceContext(c, "magi-trinity", "", nil)
	if authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}
	if authErr = authorizeMagiMainUIHistory(sourceCtx); authErr != nil {
		writeMagiSourceAuthError(c, authErr)
		return
	}
	store, err := requireMagiMainUIMessageStore()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error(), "code": "magi_main_ui_store_unavailable"})
		return
	}
	result, err := queryMagiMainUIHistory(c.Request.Context(), store, sourceCtx, req.Before, req.Limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "code": "magi_main_ui_history_failed"})
		return
	}
	c.JSON(http.StatusOK, result)
}
