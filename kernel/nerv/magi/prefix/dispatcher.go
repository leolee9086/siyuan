package prefix

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
	"github.com/siyuan-note/siyuan/kernel/nerv/magi/channel/trust"
)

// ReplyFunc 是向渠道发送回复消息的函数签名。
type ReplyFunc func(text string) error

// MagiNotifyFunc 是将指令执行结果通知 MAGI 的函数签名。
type MagiNotifyFunc func(ctx context.Context, inbound *channel.InboundMessage, match *MatchResult, result *CommandResult)

// Dispatcher 前缀指令路由器。
// 在 handleChannelInbound 中最前置调用，命中前缀则执行 handler 不走 MAGI 对话流程。
type Dispatcher struct {
	mu          sync.RWMutex
	commands    []*PrefixCommand
	goHandlers  map[string]GoHandlerFunc // builtin → handler
	trustMgr    *trust.Manager
	notifyMagi  MagiNotifyFunc
}

// NewDispatcher 创建前缀指令路由器。
func NewDispatcher(trustMgr *trust.Manager) *Dispatcher {
	d := &Dispatcher{
		goHandlers: make(map[string]GoHandlerFunc),
		trustMgr:   trustMgr,
	}
	// 注册内置 Go handler
	d.RegisterGoHandler("inbox", inboxHandler)
	d.RegisterGoHandler("todo", todoHandler)
	return d
}

// RegisterGoHandler 注册一个 Go 内置 handler。
func (d *Dispatcher) RegisterGoHandler(builtin string, fn GoHandlerFunc) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.goHandlers[builtin] = fn
}

// SetCommands 从配置加载指令列表。
func (d *Dispatcher) SetCommands(cmds []*PrefixCommand) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.commands = cmds
}

// SetNotifyMagi 设置 MAGI 通知回调。
func (d *Dispatcher) SetNotifyMagi(fn MagiNotifyFunc) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.notifyMagi = fn
}

// Match 对输入文本执行最长前缀匹配。
// 参考 s-code 的 PrefixCommand.match：trimStart 归一化 + 最长前缀优先。
func (d *Dispatcher) Match(text string) *MatchResult {
	d.mu.RLock()
	defer d.mu.RUnlock()

	normalized := strings.TrimLeft(text, " \t\n\r")
	var best *MatchResult
	for _, cmd := range d.commands {
		if !cmd.Enabled {
			continue
		}
		for _, prefix := range cmd.Prefixes {
			if strings.HasPrefix(normalized, prefix) {
				args := normalized[len(prefix):]
				if best == nil || len(prefix) > len(best.Prefix) {
					best = &MatchResult{
						Command: cmd,
						Prefix:  prefix,
						Args:    args,
					}
				}
			}
		}
	}
	return best
}

// Dispatch 处理入站消息。返回 (handled, error)：
//   - handled=true 表示命中前缀指令（无论执行是否成功），调用方不再走 MAGI 对话流程
//   - handled=false 表示无匹配，调用方继续原有 MAGI 智能体对话流程
func (d *Dispatcher) Dispatch(ctx context.Context, inbound *channel.InboundMessage) (bool, error) {
	if inbound == nil || inbound.Text == "" {
		return false, nil
	}

	match := d.Match(inbound.Text)
	if match == nil {
		return false, nil
	}

	// 信任等级检查
	if d.trustMgr != nil && match.Command.TrustLevel != "" {
		trustResult := d.trustMgr.Resolve(inbound.ChannelType, inbound.AccountID, inbound.UserID)
		if trustResult.Blocked {
			logging.LogInfof("prefix dispatch: user blocked, cmd=%s channel=%s user=%s",
				match.Command.ID, inbound.ChannelType, inbound.UserID)
			return true, nil // 静默丢弃，不回复不通知
		}
		if trustLevelWeight(trustResult.TrustBase) < trustLevelWeight(string(match.Command.TrustLevel)) {
			logging.LogInfof("prefix dispatch: trust insufficient, cmd=%s required=%s actual=%s",
				match.Command.ID, match.Command.TrustLevel, trustResult.TrustBase)
			return true, nil // 信任不足，静默丢弃
		}
	}

	// 构造回复函数
	reply := func(text string) error {
		if text == "" {
			return nil
		}
		adapter, ok := channel.Get(inbound.ChannelID)
		if !ok {
			return fmt.Errorf("channel adapter not found: %s", inbound.ChannelID)
		}
		return adapter.SendMessage(ctx, &channel.OutboundMessage{
			ChannelID:         inbound.ChannelID,
			ChannelType:       inbound.ChannelType,
			AccountID:         inbound.AccountID,
			UserID:            inbound.UserID,
			Text:              text,
			ConversationToken: inbound.ConversationToken,
		})
	}

	// 构造执行上下文
	hctx := &HandlerContext{
		Match:    match,
		Inbound:  inbound,
		Metadata: match.Command.Metadata,
		Reply:    reply,
	}

	// 执行 handler
	var result *CommandResult
	var err error
	switch match.Command.HandlerKind {
	case HandlerKindGo:
		result, err = d.executeGoHandler(match.Command, hctx)
	case HandlerKindJS:
		// JS handler 在 Phase 3 实现，当前返回未实现提示
		result = &CommandResult{
			ReplyText: "该指令的 JS handler 尚未实现",
		}
	default:
		err = fmt.Errorf("unknown handler kind: %s", match.Command.HandlerKind)
	}

	if err != nil {
		logging.LogErrorf("prefix dispatch: handler error, cmd=%s err=%v", match.Command.ID, err)
		_ = reply(fmt.Sprintf("指令执行失败: %v", err))
		return true, err
	}

	// 回复执行结果
	if result != nil && result.ReplyText != "" {
		if replyErr := reply(result.ReplyText); replyErr != nil {
			logging.LogErrorf("prefix dispatch: reply error, cmd=%s err=%v", match.Command.ID, replyErr)
		}
	}

	// 可选：通知 MAGI
	if match.Command.NotifyMagi && result != nil {
		d.mu.RLock()
		notifyFn := d.notifyMagi
		d.mu.RUnlock()
		if notifyFn != nil {
			notifyFn(ctx, inbound, match, result)
		}
	}

	logging.LogInfof("prefix dispatch: cmd=%s args=%q channel=%s user=%s",
		match.Command.ID, match.Args, inbound.ChannelType, inbound.UserID)
	return true, nil
}

// executeGoHandler 根据 Builtin 字段路由到对应的 Go handler。
func (d *Dispatcher) executeGoHandler(cmd *PrefixCommand, hctx *HandlerContext) (*CommandResult, error) {
	d.mu.RLock()
	fn, ok := d.goHandlers[cmd.Builtin]
	d.mu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("no Go handler registered for builtin: %s", cmd.Builtin)
	}
	return fn(hctx)
}

// trustLevelWeight 将信任等级转换为数值用于比较。
// 与 trust/resolve.go 中的 trustLevelWeight 逻辑一致。
func trustLevelWeight(t string) int {
	switch t {
	case "low":
		return 0
	case "medium":
		return 1
	case "high":
		return 2
	default:
		return -1
	}
}
