package channel

import (
	"context"
	"time"
)

// ChannelCapability 渠道能力位掩码，描述一个通道可以做什么。
type ChannelCapability uint8

const (
	CapReceive       ChannelCapability = 1 << iota // 可接收入站消息
	CapProactiveSend                                // 可被 MAGI 主动推送消息
)

func (c ChannelCapability) Has(cap ChannelCapability) bool {
	return c&cap != 0
}

// ChannelAdapter 是所有外部消息通道必须实现的接口。
// 每个实现封装特定 IM 平台（微信/Discord/Telegram）的通信细节。
type ChannelAdapter interface {
	ID() string

	Start(ctx context.Context) error

	Stop(ctx context.Context) error

	SendMessage(ctx context.Context, msg *OutboundMessage) error

	Status() ChannelStatus

	TrustConfig() *TrustConfig

	Capabilities() ChannelCapability
}

// ChannelStatus 通道运行状态快照。
type ChannelStatus struct {
	ID            string    `json:"id"`
	Connected     bool      `json:"connected"`
	AccountID     string    `json:"accountId,omitempty"`
	UserCount     int       `json:"userCount"`
	LastMessageAt time.Time `json:"lastMessageAt"`
	Error         string    `json:"error,omitempty"`
}
