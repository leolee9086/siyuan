package channel

import (
	"context"
	"sync"
)

// Bridge 全局入站消息桥接器。
// 通道适配器收到消息后调用 Push 推入 MAGI 调度队列。
// MAGI 初始化时通过 SetHandler 注册处理回调，避免包循环依赖。
type Bridge struct {
	mu      sync.RWMutex
	handler func(ctx context.Context, msg *InboundMessage) error
}

var globalBridge = &Bridge{}

// GlobalBridge 返回全局桥接器实例。
func GlobalBridge() *Bridge {
	return globalBridge
}

// SetHandler 注册入站消息处理函数。由 MAGI 核心初始化时调用。
func (b *Bridge) SetHandler(handler func(ctx context.Context, msg *InboundMessage) error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handler = handler
}

// Push 将入站消息推入处理管线。在 handler 注册前调用会被静默丢弃。
func (b *Bridge) Push(ctx context.Context, msg *InboundMessage) error {
	b.mu.RLock()
	handler := b.handler
	b.mu.RUnlock()
	if handler == nil {
		return nil
	}
	return handler(ctx, msg)
}
