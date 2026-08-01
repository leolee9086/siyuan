package agentqueue

import (
	"sync"
)

// InputSemantics 描述一条输入的业务语义，决定其投递方式与调度规则。
// 语义与优先级分离：语义由消息来源方（API 端点 / 渠道桥 / 工具执行器）声明，
// 调度核心按语义选择投递策略（注入 / 排队 / 中断 / 回填），按优先级选择调度顺序。
type InputSemantics string

const (
	// SemanticsUserMessage 用户主消息：开启或继续一轮对话（对应现有 /api/agent/chat）。
	SemanticsUserMessage InputSemantics = "user_message"
	// SemanticsSteer 运行中引导：在下一个安全 provider-turn 边界注入当前 turn。
	SemanticsSteer InputSemantics = "steer"
	// SemanticsQueue 排队消息：当前 turn 结束后按序投递。
	SemanticsQueue InputSemantics = "queue"
	// SemanticsInterrupt 中断当前 turn，可携带引导消息随新 turn 恢复。
	SemanticsInterrupt InputSemantics = "interrupt"
	// SemanticsToolResult 异步工具返回：回填挂起的工具调用结果。
	SemanticsToolResult InputSemantics = "tool_result"
	// SemanticsChannelInbound 外部渠道入站消息（微信 / CLI 等，复用 MAGI Bridge）。
	SemanticsChannelInbound InputSemantics = "channel_inbound"
	// SemanticsSystem 系统任务（心跳 / 定时任务等）。
	SemanticsSystem InputSemantics = "system"
	// SemanticsCrossAgent 跨 agent 消息（预留，多 agent 协作）。
	SemanticsCrossAgent InputSemantics = "cross_agent"
)

// InputPriority 输入优先级，映射到 RingQueue 的保护环层级。
// 数值越小优先级越高，与 Ring 常量一一对应。
type InputPriority int

const (
	// PriorityUnset 未设置（零值），实际优先级由语义默认决定。
	// 注意：不要将有效优先级定义为 0，否则与「未设置」无法区分。
	PriorityUnset InputPriority = 0
	// PriorityImmediate 即时交互（steer / interrupt / tool_result），对应 Ring0。
	PriorityImmediate InputPriority = 1
	// PriorityHigh 外部渠道 / 跨 agent 消息，对应 Ring1。
	PriorityHigh InputPriority = 2
	// PriorityNormal 用户消息与排队消息，对应 Ring2。
	PriorityNormal InputPriority = 3
	// PriorityLow 后台系统任务，对应 Ring3。
	PriorityLow InputPriority = 4
)

// priorityRing 是优先级 → 保护环的映射表。新增优先级只需在此登记，无需修改 Ring 方法。
var priorityRing = map[InputPriority]Ring{
	PriorityImmediate: Ring0,
	PriorityHigh:      Ring1,
	PriorityNormal:    Ring2,
	PriorityLow:       Ring3,
}

// Ring 返回该优先级对应的保护环层级。
func (p InputPriority) Ring() Ring {
	if r, ok := priorityRing[p]; ok {
		return r
	}
	// PriorityUnset 及未知值：按普通优先级处理。
	return Ring2
}

// SemanticsMeta 描述一种输入语义的调度特性。
// 新增语义时调用 RegisterSemantics 注册，无需修改任何既有函数（开闭原则）。
type SemanticsMeta struct {
	// DefaultPriority 未显式指定优先级时使用的默认值。
	DefaultPriority InputPriority
	// Immediate 是否为即时交互语义（steer / interrupt / tool_result）。
	// 即时语义在取用时优先于普通排队消息，并受 ExpectedTurnID 前置校验约束。
	Immediate bool
}

// semanticsMeta 是语义 → 调度特性的注册表。
// 未注册的语义按普通排队消息处理（默认优先级 PriorityNormal、非即时）。
var (
	semanticsMetaMu sync.RWMutex
	semanticsMeta   = map[InputSemantics]SemanticsMeta{
		SemanticsUserMessage:    {DefaultPriority: PriorityNormal, Immediate: false},
		SemanticsSteer:          {DefaultPriority: PriorityImmediate, Immediate: true},
		SemanticsQueue:          {DefaultPriority: PriorityNormal, Immediate: false},
		SemanticsInterrupt:      {DefaultPriority: PriorityImmediate, Immediate: true},
		SemanticsToolResult:     {DefaultPriority: PriorityImmediate, Immediate: true},
		SemanticsChannelInbound: {DefaultPriority: PriorityHigh, Immediate: false},
		SemanticsSystem:         {DefaultPriority: PriorityLow, Immediate: false},
		SemanticsCrossAgent:     {DefaultPriority: PriorityHigh, Immediate: false},
	}
)

// RegisterSemantics 注册或覆盖一种语义的调度特性。
// 供扩展方在包外注册新语义（如新增渠道 / 工具类别）时调用。
func RegisterSemantics(s InputSemantics, meta SemanticsMeta) {
	semanticsMetaMu.Lock()
	semanticsMeta[s] = meta
	semanticsMetaMu.Unlock()
}

// Meta 返回语义的调度特性；未注册的语义返回默认普通特性。
func (s InputSemantics) Meta() SemanticsMeta {
	semanticsMetaMu.RLock()
	meta, ok := semanticsMeta[s]
	semanticsMetaMu.RUnlock()
	if !ok {
		return SemanticsMeta{DefaultPriority: PriorityNormal, Immediate: false}
	}
	return meta
}

// DefaultPriority 返回各语义的默认优先级，供调用方省略优先级时使用。
func (s InputSemantics) DefaultPriority() InputPriority {
	return s.Meta().DefaultPriority
}

// IsImmediate 判断语义是否为即时交互类（需要 turn 匹配校验）。
func (s InputSemantics) IsImmediate() bool {
	return s.Meta().Immediate
}

// SourceChannel 输入来源通道分类，与 MAGI types.RequestSourceContext 的 Channel 字段对齐。
type SourceChannel string

const (
	SourceChannelGuardian      SourceChannel = "guardian"       // 设备主人（主 UI）
	SourceChannelExternalAgent SourceChannel = "external-agent" // 外部渠道（微信 / CLI）
	SourceChannelSystemCron    SourceChannel = "system-cron"    // 系统定时任务
	SourceChannelUnknown       SourceChannel = "unknown"        // 未知来源
)

// TrustLevel 信任等级，与 MAGI types.TrustLevel 对齐。
type TrustLevel string

const (
	TrustLevelLow    TrustLevel = "low"
	TrustLevelMedium TrustLevel = "medium"
	TrustLevelHigh   TrustLevel = "high"
)

// AuthStrength 鉴权强度，与 MAGI types.AuthStrength 对齐。
type AuthStrength string

const (
	AuthStrengthWeak   AuthStrength = "weak"
	AuthStrengthMedium AuthStrength = "medium"
	AuthStrengthStrong AuthStrength = "strong"
)

// SourceContext 输入来源上下文。
// 字段与 MAGI types.RequestSourceContext 对齐，但本包不依赖 kernel 任何包，
// 由调用方负责从 MAGI / native agent 的来源结构映射过来。
type SourceContext struct {
	RequestID     string        `json:"requestId,omitempty"`
	Channel       SourceChannel `json:"channel"`
	PrincipalID   string        `json:"principalId,omitempty"`
	IdentityID    string        `json:"identityId,omitempty"`
	Nickname      string        `json:"nickname,omitempty"`
	InterfaceID   string        `json:"interfaceId,omitempty"`
	InterfaceKind string        `json:"interfaceKind,omitempty"`

	// SourceSessionKey 来源会话键（如 "wechat:acct:user"），用于跨消息关联同一会话。
	SourceSessionKey string `json:"sourceSessionKey,omitempty"`
	// ConversationID 来源对话 ID。
	ConversationID string `json:"conversationId,omitempty"`

	// DirectResponseAllowed 是否允许直接回复（不经 Avatar 路径）。
	DirectResponseAllowed bool         `json:"directResponseAllowed"`
	TrustBase             TrustLevel   `json:"trustBase,omitempty"`
	RiskLevel             TrustLevel   `json:"riskLevel,omitempty"`
	AuthStrength          AuthStrength `json:"authStrength,omitempty"`
	ModelIntent           string       `json:"modelIntent,omitempty"`

	// RawAttributes 来源附加属性（原始消息、渠道原始字段等）。
	RawAttributes map[string]string `json:"rawAttributes,omitempty"`
}

// InboxStatus 输入项在队列中的生命周期状态。
type InboxStatus string

const (
	// StatusPending 已入队，等待投递。
	StatusPending InboxStatus = "pending"
	// StatusInjecting 已取出，正在注入 agent 输入（尚未确认完成）。
	StatusInjecting InboxStatus = "injecting"
	// StatusInjected 已确认注入完成（进入 LLM 上下文）。
	StatusInjected InboxStatus = "injected"
	// StatusCancelled 已取消（用户主动取消 / 过期）。
	StatusCancelled InboxStatus = "cancelled"
	// StatusFailed 投递失败（持久化失败 / 校验失败）。
	StatusFailed InboxStatus = "failed"
)

// Input 是进入 agent 输入的统一消息信封。
// 所有来源（用户 UI、外部渠道、异步工具返回、系统任务）都包装为 Input，
// 由 InboxManager 按语义与优先级调度。
type Input struct {
	// ID 全局唯一输入 ID，作为幂等键（网络重试 / 重复投递防护）。
	ID string `json:"id"`
	// SessionID 目标 agent 会话。
	SessionID string `json:"sessionId"`
	// Semantics 输入语义。
	Semantics InputSemantics `json:"semantics"`
	// Priority 输入优先级；0 时按语义默认优先级。
	Priority InputPriority `json:"priority,omitempty"`

	// Content 消息正文（user_message / steer / queue / channel_inbound 使用）。
	Content string `json:"content,omitempty"`

	// Source 输入来源上下文。
	Source *SourceContext `json:"source,omitempty"`

	// ExpectedTurnID 前置校验：steer / interrupt / tool_result 必须匹配当前活动 turn，
	// 防止跨 turn 注入错乱。为空表示不限定（如 user_message 开新 turn）。
	ExpectedTurnID string `json:"expectedTurnId,omitempty"`

	// ToolCallID 异步工具返回专用：对应的工具调用 ID。
	ToolCallID string `json:"toolCallId,omitempty"`
	// Result 异步工具返回专用：工具返回结果（原始文本）。
	Result string `json:"result,omitempty"`
	// IsError 异步工具返回专用：结果是否为错误。
	IsError bool `json:"isError,omitempty"`

	// CreatedAt 创建时间（Unix 毫秒）。
	CreatedAt int64 `json:"createdAt"`

	// Metadata 附加元数据（扩展字段，不参与调度）。
	Metadata map[string]any `json:"metadata,omitempty"`
}

// EffectivePriority 返回实际生效的优先级（显式设置优先，否则用语义默认）。
func (in *Input) EffectivePriority() InputPriority {
	if in == nil {
		return PriorityNormal
	}
	if in.Priority != PriorityUnset {
		return in.Priority
	}
	return in.Semantics.DefaultPriority()
}

// EffectiveRing 返回实际生效的保护环层级。
func (in *Input) EffectiveRing() Ring {
	if in == nil {
		return Ring2
	}
	return in.EffectivePriority().Ring()
}
