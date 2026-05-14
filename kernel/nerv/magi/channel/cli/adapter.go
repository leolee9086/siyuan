package cli

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
)

type Adapter struct {
	id       string
	conn     *websocket.Conn
	identity *Identity

	mu      sync.RWMutex
	writeMu sync.Mutex
	cfg     *channel.TrustConfig
	status  channel.ChannelStatus
	cancel  context.CancelFunc
	done    chan struct{}
}

func NewAdapter(sessionID string, conn *websocket.Conn, identity *Identity) *Adapter {
	instanceID := fmt.Sprintf("cli-%s-%s", sessionID, generateShortID())

	cfg := &channel.TrustConfig{
		DefaultTrust: channel.TrustLow,
		DefaultRisk:  channel.RiskHigh,
	}
	if identity.AuthenticatedUser != "" {
		cfg.DefaultTrust = channel.TrustMedium
		cfg.DefaultRisk = channel.RiskLow
	}

	return &Adapter{
		id:       instanceID,
		conn:     conn,
		identity: identity,
		cfg:      cfg,
		status: channel.ChannelStatus{
			ID:        instanceID,
			AccountID: sessionID,
			Connected: true,
			UserCount: 1,
		},
		done: make(chan struct{}),
	}
}

func (a *Adapter) ID() string { return a.id }

func (a *Adapter) Identity() *Identity { return a.identity }

func (a *Adapter) Start(ctx context.Context) error {
	a.mu.Lock()
	if a.cancel != nil {
		a.mu.Unlock()
		return fmt.Errorf("cli adapter already started")
	}

	newCtx, cancel := context.WithCancel(ctx)
	a.cancel = cancel
	a.status.Connected = true
	a.mu.Unlock()

	a.sendJSON(AuthResultFrame{
		Type:    "auth_result",
		OK:      true,
		Session: a.id,
	})

	go a.readLoop(newCtx)
	return nil
}

func (a *Adapter) Stop(ctx context.Context) error {
	a.mu.Lock()
	cancel := a.cancel
	a.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	a.writeMu.Lock()
	if a.conn != nil {
		a.conn.Close()
		a.conn = nil
	}
	a.writeMu.Unlock()

	select {
	case <-a.done:
	case <-ctx.Done():
		return ctx.Err()
	}

	a.mu.Lock()
	a.status.Connected = false
	a.mu.Unlock()
	return nil
}

func (a *Adapter) SendMessage(ctx context.Context, msg *channel.OutboundMessage) error {
	if msg == nil {
		return nil
	}

	text := SanitizeText(msg.Text)

	a.writeMu.Lock()
	defer a.writeMu.Unlock()

	if a.conn == nil {
		return fmt.Errorf("connection closed")
	}
	return a.conn.WriteJSON(map[string]string{
		"type": "message",
		"text": text,
	})
}

func (a *Adapter) Status() channel.ChannelStatus {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.status
}

func (a *Adapter) TrustConfig() *channel.TrustConfig {
	return a.cfg
}

func (a *Adapter) Capabilities() channel.ChannelCapability {
	return channel.CapReceive | channel.CapProactiveSend
}

func (a *Adapter) readLoop(ctx context.Context) {
	defer close(a.done)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_, raw, err := a.conn.ReadMessage()
		if err != nil {
			a.setStatus(err.Error(), false)
			return
		}

		if len(raw) > 64*1024 {
			a.sendJSON(map[string]string{"type": "error", "error": "frame too large"})
			continue
		}

		var frame messageFrame
		if err := json.Unmarshal(raw, &frame); err != nil {
			a.sendJSON(map[string]string{"type": "error", "error": "invalid JSON"})
			continue
		}

		if frame.Type != "message" {
			continue
		}

		text := SanitizeText(frame.Text)

		a.mu.Lock()
		a.status.LastMessageAt = time.Now()
		a.mu.Unlock()

		inbound := &channel.InboundMessage{
			ChannelID:   a.id,
			ChannelType: "cli",
			AccountID:   a.status.AccountID,
			UserID:      a.identity.UserID(),
			Nickname:    a.identity.DisplayName(),
			Text:        text,
			Timestamp:   time.Now().UnixMilli(),
		}

		_ = channel.GlobalBridge().Push(ctx, inbound)
		ms := channel.GlobalMessageStore()
		if ms == nil {
			logging.LogErrorf("消息存储未初始化，CLI 入站消息丢失: channel=%s user=%s", inbound.ChannelID, inbound.UserID)
		} else if err := ms.SaveInbound(ctx, inbound); err != nil {
			logging.LogErrorf("CLI 入站消息落盘失败: %v", err)
		}
	}
}

func (a *Adapter) sendJSON(v interface{}) {
	a.writeMu.Lock()
	defer a.writeMu.Unlock()
	if a.conn != nil {
		_ = a.conn.WriteJSON(v)
	}
}

func (a *Adapter) setStatus(errMsg string, connected bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.status.Connected = connected
	a.status.Error = errMsg
}
