// Package llm 提供MAGI系统的LLM客户端封装。
package llm

import (
	"context"
	"strings"
)

// RequestSource 描述一次 LLM 请求的来源上下文。
//
// 用途：前缀缓存监控（PrefixCacheMonitor）在记录命中/未命中数据时，
// 需要知道这次请求来自哪条调用路径（哪个 sage、什么业务类型、哪个会话/轮次），
// 否则事后无法从 [prefix-cache] 日志定位低命中率的来源。
// 调用方在发起 LLM 请求前用 WithRequestSource 注入 ctx，
// go-openai 会用 http.NewRequestWithContext 构造 HTTP 请求（request_builder.go），
// 因此 MonitorTransport.Do 里通过 req.Context() 即可读取到来源信息。
type RequestSource struct {
	SageName    string // sage 内部名（如 balthazar）
	DisplayName string // 展示名（如 Balthazar）
	RequestType string // 业务类型：heartbeat / vote / election / action-plan / avatar / security-review / synthesis / sage-chat 等
	SessionID   string
	RoundID     string
	URL         string // 请求 URL（MonitorTransport 在拦截时填充，调用方无需注入）
}

// String 返回适合写入日志的来源描述。
// 未注入任何字段时返回「来源未知」，保证日志可读。
func (s RequestSource) String() string {
	var b strings.Builder
	if s.SageName != "" {
		b.WriteString("sage=" + s.SageName + " ")
	}
	if s.DisplayName != "" {
		b.WriteString("display=" + s.DisplayName + " ")
	}
	if s.RequestType != "" {
		b.WriteString("type=" + s.RequestType + " ")
	}
	if s.SessionID != "" {
		b.WriteString("session=" + s.SessionID + " ")
	}
	if s.RoundID != "" {
		b.WriteString("round=" + s.RoundID + " ")
	}
	if s.URL != "" {
		b.WriteString("url=" + s.URL + " ")
	}
	if b.Len() == 0 {
		return "来源未知"
	}
	return strings.TrimSpace(b.String())
}

// requestSourceKey context 键类型（避免与字符串键冲突）。
type requestSourceKey struct{}

// WithRequestSource 将请求来源注入 ctx。
func WithRequestSource(ctx context.Context, src RequestSource) context.Context {
	return context.WithValue(ctx, requestSourceKey{}, src)
}

// RequestSourceFromContext 从 ctx 读取请求来源；未注入时返回零值。
func RequestSourceFromContext(ctx context.Context) RequestSource {
	src, _ := ctx.Value(requestSourceKey{}).(RequestSource)
	return src
}
