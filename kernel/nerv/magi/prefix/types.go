// Package prefix 实现即时通讯渠道的前缀指令路由系统。
//
// 设计参考 s-code 的 PrefixCommand 服务，核心思路：
//   - 用户消息以特定前缀开头时触发指令，不走 MAGI 智能体对话流程
//   - 最长前缀优先匹配，支持中英文双语 + 全角/半角冒号
//   - 每个指令可配置 notifyMagi，执行后通知 MAGI 做后续处理
//   - 支持 Go（内置高性能）和 JS（用户自定义灵活）两种 handler
package prefix

import "github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"

// HandlerKind 标识 handler 的执行方式。
type HandlerKind string

const (
	HandlerKindGo HandlerKind = "go" // Go 内置 handler，通过 Builtin 字段路由
	HandlerKindJS HandlerKind = "js" // JS 自定义 handler，通过 Metadata.script 定位脚本
)

// PrefixCommand 定义一个前缀指令。
type PrefixCommand struct {
	ID          string            `json:"id"`          // 唯一标识，如 "inbox"、"todo"
	Prefixes    []string          `json:"prefixes"`    // 前缀别名，如 ["收集:", "收集：", "inbox:"]
	Description string            `json:"description"` // 人类可读描述
	Builtin     string            `json:"builtin"`     // 内置指令标识（Go handler 路由用），自定义指令留空
	HandlerKind HandlerKind       `json:"handlerKind"` // handler 类型：go / js
	NotifyMagi  bool              `json:"notifyMagi"`  // 执行后是否通知 MAGI（注入 synthetic message）
	TrustLevel  channel.TrustLevel `json:"trustLevel"`  // 最低信任等级要求
	Enabled     bool              `json:"enabled"`     // 是否启用
	Metadata    map[string]any    `json:"metadata"`    // 指令特定配置（如收集箱的目标笔记本）
}

// MatchResult 包含前缀匹配结果。
type MatchResult struct {
	Command *PrefixCommand
	Prefix  string // 实际匹配的前缀
	Args    string // 前缀后的剩余文本
}

// CommandResult 是指令执行结果。
type CommandResult struct {
	ReplyText string         // 回复用户的消息（空则不回复）
	Summary   string         // 给 MAGI 的摘要（NotifyMagi=true 时使用）
	Data      map[string]any // 附加数据（供日志/调试用）
}

// GoHandlerFunc 是 Go 内置指令的处理器函数签名。
type GoHandlerFunc func(ctx *HandlerContext) (*CommandResult, error)

// HandlerContext 是传给 handler 的执行上下文。
type HandlerContext struct {
	Match    *MatchResult
	Inbound  *channel.InboundMessage
	Metadata map[string]any
	// Reply 向渠道发送回复消息（不依赖 handler 返回 ReplyText）。
	Reply func(text string) error
}
