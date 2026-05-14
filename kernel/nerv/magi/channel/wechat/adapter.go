package wechat

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/util"
)

// Adapter 实现 channel.ChannelAdapter 的微信 iLink Bot 通道。
type Adapter struct {
	id       string
	acctID   string
	stateDir string

	mu     sync.RWMutex
	cli    *apiClient
	cfg    *channel.TrustConfig
	status channel.ChannelStatus
	cancel context.CancelFunc
	done   chan struct{}
}

// NewAdapter 创建微信通道适配器。
// 如果磁盘上已有该 accountID 的凭证，自动加载。
func NewAdapter(accountID string) *Adapter {
	stateDir := util.ConfDir
	instanceID := "wechat-" + accountID
	a := &Adapter{
		id:       instanceID,
		acctID:   accountID,
		stateDir: stateDir,
		cli:      newAPIClient("", ""),
		cfg: &channel.TrustConfig{
			DefaultTrust: channel.TrustLow,
			DefaultRisk:  channel.RiskHigh,
		},
		status: channel.ChannelStatus{
			ID:        instanceID,
			AccountID: accountID,
			Connected: false,
		},
		done: make(chan struct{}),
	}

	// 尝试从磁盘加载已保存的凭证
	if saved := LoadAccount(stateDir, accountID); saved != nil && saved.Token != "" {
		a.cli = newAPIClient(saved.BaseURL, saved.Token)
	}
	return a
}

// AccountID 返回适配器的账号 ID。
func (a *Adapter) AccountID() string { return a.acctID }

// IsConfigured 返回是否已有有效的 token（已登录过）。
func (a *Adapter) IsConfigured() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.cli.token != ""
}

// ApplyCredentials 在 QR 扫码确认后设置 token/baseURL 并持久化到磁盘。
func (a *Adapter) ApplyCredentials(token, baseURL, botID, userID string) {
	a.mu.Lock()
	a.cli = newAPIClient(baseURL, token)
	a.mu.Unlock()

	// 持久化到磁盘
	SaveAccount(a.stateDir, a.acctID, &AccountData{
		Token:   token,
		BaseURL: baseURL,
		UserID:  userID,
	})

	// 注册到索引
	RegisterAccountID(a.stateDir, a.acctID)

	// 清理同一微信用户的旧账号（避免 context_token 歧义）
	ClearStaleAccountsForUserID(a.stateDir, a.acctID, userID)
}

func (a *Adapter) ID() string { return a.id }

func (a *Adapter) Start(ctx context.Context) error {
	a.mu.Lock()
	defer a.mu.Unlock()

	if a.cancel != nil {
		return fmt.Errorf("wechat adapter already started")
	}
	if a.cli.token == "" {
		return fmt.Errorf("wechat adapter not authenticated, perform QR login first")
	}

	newCtx, cancel := context.WithCancel(ctx)
	a.cancel = cancel
	a.status.Connected = true
	go a.runMonitor(newCtx)
	return nil
}

func (a *Adapter) Stop(ctx context.Context) error {
	a.mu.Lock()
	cancel := a.cancel
	a.mu.Unlock()

	if cancel != nil {
		cancel()
	}
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
	return a.cli.sendMessage(ctx, msg.UserID, msg.Text, msg.ConversationToken)
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

func (a *Adapter) runMonitor(ctx context.Context) {
	defer close(a.done)

	var buf string
	pollInterval := 35 * time.Second
	consecutiveErrors := 0

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		resp, err := a.cli.getUpdates(ctx, buf, int(pollInterval.Milliseconds()))
		if err != nil {
			consecutiveErrors++
			a.setStatus(err.Error(), false)
			backoff := time.Duration(consecutiveErrors) * 2 * time.Second
			if backoff > 60*time.Second {
				backoff = 60 * time.Second
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			continue
		}

		consecutiveErrors = 0

		if resp.Ret != 0 {
			if resp.ErrCode == -14 {
				a.setStatus(fmt.Sprintf("session expired, pausing 1h (errcode=%d)", resp.ErrCode), false)
				select {
				case <-ctx.Done():
					return
				case <-time.After(1 * time.Hour):
				}
				continue
			}
			a.setStatus(fmt.Sprintf("getUpdates ret=%d err=%s", resp.Ret, resp.ErrMsg), false)
			time.Sleep(5 * time.Second)
			continue
		}

		buf = resp.GetUpdatesBuf
		if resp.LongPollingTimeout > 0 {
			pollInterval = time.Duration(resp.LongPollingTimeout) * time.Millisecond
		}

		if len(resp.Msgs) > 0 {
			t := time.Now()
			a.mu.Lock()
			a.status.Connected = true
			a.status.LastMessageAt = t
			a.mu.Unlock()

			for _, wxMsg := range resp.Msgs {
				if wxMsg.MessageType != messageTypeUser {
					continue
				}
				inbound := convertToInbound(a.id, a.acctID, &wxMsg)
				if inbound != nil {
					_ = channel.GlobalBridge().Push(ctx, inbound)
					ms := channel.GlobalMessageStore()
					if ms == nil {
						logging.LogErrorf("消息存储未初始化，入站消息丢失: channel=%s user=%s", inbound.ChannelID, inbound.UserID)
					} else if err := ms.SaveInbound(ctx, inbound); err != nil {
						logging.LogErrorf("入站消息落盘失败: %v", err)
					}
				}
			}
		}
	}
}

func (a *Adapter) setStatus(errMsg string, connected bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.status.Connected = connected
	a.status.Error = errMsg
}
