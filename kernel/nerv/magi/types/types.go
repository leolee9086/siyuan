// Package types 定义MAGI系统的核心数据类型
package types

// MessageRole 消息角色类型
type MessageRole string

const (
	RoleUser      MessageRole = "user"
	RoleAssistant MessageRole = "assistant"
	RoleSystem    MessageRole = "system"
	RoleTool      MessageRole = "tool"
)

// MessageType 消息类型
type MessageType string

const (
	TypeUser      MessageType = "user"
	TypeAI        MessageType = "ai"
	TypeMelchior  MessageType = "melchior"
	TypeBalthazar MessageType = "balthazar"
	TypeCasper    MessageType = "casper"
	TypeConsensus MessageType = "consensus"
	TypeVote      MessageType = "vote"
	TypeError     MessageType = "error"
	TypeSystem    MessageType = "system"
)

// MessageStatus 消息状态
type MessageStatus string

const (
	StatusStreaming MessageStatus = "streaming"
	StatusSuccess   MessageStatus = "success"
	StatusError     MessageStatus = "error"
	StatusPending   MessageStatus = "pending"
)

// Message MAGI消息结构（对应前端MagiMessage）
type Message struct {
	ID        string                 `json:"id"`
	Type      MessageType            `json:"type"`
	Content   string                 `json:"content"`
	Status    MessageStatus          `json:"status"`
	Timestamp int64                  `json:"timestamp"` // Unix毫秒
	Meta      map[string]interface{} `json:"meta,omitempty"`
}

// ContextMessage 上下文消息（对应前端ContextMessage）
type ContextMessage struct {
	ID               string                 `json:"id,omitempty"`
	Role             MessageRole            `json:"role"`
	Content          string                 `json:"content"`
	ReasoningContent string                 `json:"reasoning_content,omitempty"`
	ToolCalls        []ToolCall             `json:"tool_calls,omitempty"`
	ToolID           string                 `json:"tool_call_id,omitempty"`
	Meta             map[string]interface{} `json:"meta,omitempty"`
	RoundID          string                 `json:"round_id,omitempty"`
	Dominant         bool                   `json:"-"`
	Heartbeat        bool                   `json:"-"`
}

// ToolCall 工具调用结构
type ToolCall struct {
	ID       string           `json:"id,omitempty"`
	Type     string           `json:"type"` // "function"
	Function ToolCallFunction `json:"function"`
	Index    int              `json:"index,omitempty"`
}

// ToolCallFunction 工具调用函数
type ToolCallFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // JSON字符串
}

// SageResponse 贤者响应结果（对应前端SageResponse）
type SageResponse struct {
	Content              string              `json:"content"`
	Seel                 string              `json:"seel"`                           // melchior/balthazar/casper
	DisplayName          string              `json:"displayName"`                    // Melchior/Balthazar/Casper
	RequiresDeliberation bool                `json:"requiresDeliberation,omitempty"` // Melchior专用
	UsedToolCall         bool                `json:"usedToolCall,omitempty"`         // 是否使用了工具调用
	DeliberationReason   string              `json:"deliberationReason,omitempty"`   // 审慎决策原因
	ProposedAction       string              `json:"proposedAction,omitempty"`       // 建议的行动提案
	ToolCallNames        []string            `json:"toolCallNames,omitempty"`        // 工具名称列表
	ToolArgumentsByName  map[string][]string `json:"toolArgumentsByName,omitempty"`  // 按工具名聚合参数
	WantsDowntime         bool                `json:"wantsSleep,omitempty"`           // 心跳轮次是否请求休眠/工作日志记录
	DowntimeSummary       string              `json:"sleepSummary,omitempty"`         // 心跳轮次本次醒来工作摘要
	DowntimeNote          *HeartbeatDowntimeTool `json:"sleepNote,omitempty"`            // 心跳轮次结构化休息/工作笔记
	SkipAssistantMemory   bool                `json:"skipAssistantMemory,omitempty"`  // 工具调用已完整入历史时，跳过额外assistant文本写回
	DowntimeAssistantDraft string              `json:"-"` // wanna_sleep/wanna_rest 轮次暂存的 assistant 内容
	DowntimeReasoningDraft string              `json:"-"` // wanna_sleep/wanna_rest 轮次暂存的 reasoning 内容
	DowntimeToolCall       *ToolCall           `json:"-"` // wanna_sleep/wanna_rest 轮次暂存的工具调用
}

// ActionPlanProposal 贤者的行动计划提案。
type ActionPlanProposal struct {
	ProposerSeelName    string `json:"proposerSeelName"`
	ProposerDisplayName string `json:"proposerDisplayName"`
	Plan                string `json:"plan"`
}

// VoteDecision 投票决定
type VoteDecision string

const (
	VoteApprove VoteDecision = "批准"
	VoteReject  VoteDecision = "否决"
)

// VoteResult 投票结果（对应前端VoteResult）
type VoteResult struct {
	Melchior  VoteDecision `json:"melchior"`
	Balthazar VoteDecision `json:"balthazar"`
	Casper    VoteDecision `json:"casper"`
	Passed    bool         `json:"passed"`
	Round     int          `json:"round"`
}

// ConsensusMode 共识模式
type ConsensusMode string

const (
	ConsensusModeStandard ConsensusMode = "standard"
	ConsensusModeCritical ConsensusMode = "critical"
)

// ConsensusSource 共识来源
type ConsensusSource string

const (
	ConsensusSourceDominantSynthesis ConsensusSource = "dominant-synthesis"
	ConsensusSourceRuminationEntry   ConsensusSource = "rumination-entry"
)

// ConsensusMeta 共识元数据
type ConsensusMeta struct {
	Mode                   ConsensusMode   `json:"mode"`
	Source                 ConsensusSource `json:"source"`
	Vote                   *VoteResult     `json:"vote,omitempty"`
	MelchiorUsedToolCall   bool            `json:"melchiorUsedToolCall,omitempty"`
	TrinityHistoryEligible bool            `json:"trinityHistoryEligible,omitempty"`
}

// StreamChunk SSE流式chunk（OpenAI兼容格式）
type StreamChunk struct {
	ID      string        `json:"id,omitempty"`
	Object  string        `json:"object,omitempty"` // "chat.completion.chunk"
	Created int64         `json:"created,omitempty"`
	Model   string        `json:"model,omitempty"`
	Choices []ChunkChoice `json:"choices,omitempty"`
}

// ChunkChoice chunk选择项
type ChunkChoice struct {
	Index        int             `json:"index"`
	Delta        ChunkDelta      `json:"delta"`
	FinishReason *string         `json:"finish_reason"`
	ToolCalls    []ToolCallDelta `json:"tool_calls,omitempty"`
}

// ChunkDelta chunk增量数据
type ChunkDelta struct {
	Role             string          `json:"role,omitempty"`
	Content          string          `json:"content,omitempty"`
	ReasoningContent string          `json:"reasoning_content,omitempty"`
	ToolCalls        []ToolCallDelta `json:"tool_calls,omitempty"`
}

// ToolCallDelta 工具调用增量
type ToolCallDelta struct {
	Index    int                    `json:"index"`
	ID       string                 `json:"id,omitempty"`
	Type     string                 `json:"type,omitempty"`
	Function *ToolCallFunctionDelta `json:"function,omitempty"`
}

// ToolCallFunctionDelta 工具调用函数增量
type ToolCallFunctionDelta struct {
	Name      string `json:"name,omitempty"`
	Arguments string `json:"arguments,omitempty"`
}

// StreamResult 流式处理结果
type StreamResult struct {
	Content              string              `json:"content"`
	Success              bool                `json:"success"`
	HasToolCalls         bool                `json:"hasToolCalls,omitempty"`
	ToolCallNames        []string            `json:"toolCallNames,omitempty"`
	InternalToolMessages []string            `json:"internalToolMessages,omitempty"`
	ToolArgumentsByName  map[string][]string `json:"toolArgumentsByName,omitempty"`
}

// SyncChatResult 同步请求的结构化响应结果。
type SyncChatResult struct {
	Content          string     `json:"content"`
	ReasoningContent string     `json:"reasoningContent,omitempty"`
	ToolCalls        []ToolCall `json:"toolCalls,omitempty"`
	FinishReason     string     `json:"finishReason,omitempty"`
}

// DeliberationSignal 审慎决策信号（Melchior工具调用）
type DeliberationSignal struct {
	RequiresDeliberation bool   `json:"requires_deliberation"`
	Reason               string `json:"reason"`
	ProposedAction       string `json:"proposed_action"`
}

// WannaSpeakTool 三贤人 wanna_speak 工具参数
type WannaSpeakTool struct {
	Content string `json:"content"`
}

// HeartbeatDowntimeTool 三贤人心跳轮次休眠/工作日志工具参数
type HeartbeatDowntimeTool struct {
	Summary      string `json:"summary"`
	NextStepPlan string `json:"nextStepPlan,omitempty"`
	DreamScene   string `json:"dreamScene,omitempty"`
	Reflection   string `json:"reflection,omitempty"` // 睡眠时段 Melchior 回想反思
	Mood         string `json:"mood,omitempty"`       // 非睡眠时段 Balthazar 工作心情
	Deep         bool   `json:"deep,omitempty"`       // 是否进行深度休息，清理上下文记忆
}

// WriteDiaryTool 主导者向 AI 主笔记本当日日记写入 callout 容器式条目的工具参数。
type WriteDiaryTool struct {
	Motivation string `json:"motivation"`
	Markdown    string `json:"markdown"`
	CalloutType string `json:"calloutType,omitempty"`
	Title       string `json:"title,omitempty"`
}

// SynthesisSpeakTool 统合输出 speak 工具参数
type SynthesisSpeakTool struct {
	Content string `json:"content"`
	Channel string `json:"channel,omitempty"` // "public" | "internal"
}

// SourceChannel 请求来源通道
type SourceChannel string

const (
	SourceChannelGuardian      SourceChannel = "guardian"
	SourceChannelExternalAgent SourceChannel = "external-agent"
	SourceChannelSystemCron    SourceChannel = "system-cron"
	SourceChannelUnknown       SourceChannel = "unknown"
)

// TrustLevel 信任等级
type TrustLevel string

const (
	TrustLevelLow    TrustLevel = "low"
	TrustLevelMedium TrustLevel = "medium"
	TrustLevelHigh   TrustLevel = "high"
)

// AuthStrength 鉴权强度
type AuthStrength string

const (
	AuthStrengthWeak   AuthStrength = "weak"
	AuthStrengthMedium AuthStrength = "medium"
	AuthStrengthStrong AuthStrength = "strong"
)

// RequestSourceContext API层解析后下传的请求来源上下文
type RequestSourceContext struct {
	RequestID             string            `json:"requestId"`
	Channel               SourceChannel     `json:"channel"` // guardian|external-agent|system-cron|unknown
	PrincipalID           string            `json:"principalId"`
	IdentityID            string            `json:"identityId,omitempty"`
	Nickname              string            `json:"nickname,omitempty"`
	InterfaceID           string            `json:"interfaceId"`
	InterfaceKind         string            `json:"interfaceKind"` // magi-main-ui|siyuan-note-upstream|...
	ConversationID        string            `json:"conversationId,omitempty"`
	SourceSessionKey      string            `json:"sourceSessionKey"`
	DirectResponseAllowed bool              `json:"directResponseAllowed"`
	CallerID              string            `json:"callerId,omitempty"`
	TrustBase             TrustLevel        `json:"trustBase"` // low|medium|high
	RiskLevel             TrustLevel        `json:"riskLevel"` // low|medium|high
	AuthStrength          AuthStrength      `json:"authStrength"`
	ModelIntent           string            `json:"modelIntent,omitempty"`
	RawAttributes         map[string]string `json:"rawAttributes,omitempty"`
}

// ClaimedHistoryMessage 前端随请求提交的“渠道宣称最近历史”条目。
// 这类历史只能视为某个来源的声明，不可直接当作可信事实。
type ClaimedHistoryMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// PassiveRecallBasisType 被动召回查询依据类型。
type PassiveRecallBasisType string

const (
	PassiveRecallBasisUserMessage      PassiveRecallBasisType = "user_message"
	PassiveRecallBasisPreviousDialogue PassiveRecallBasisType = "previous_dialogue"
	PassiveRecallBasisPreviousDowntime PassiveRecallBasisType = "previous_downtime_note"
)

// PassiveRecallBasis 描述被动召回本轮使用的查询依据。
type PassiveRecallBasis struct {
	Type           PassiveRecallBasisType `json:"type"`
	Query          string                 `json:"query"`
	UserMessage    string                 `json:"userMessage,omitempty"`
	AssistantReply string                 `json:"assistantReply,omitempty"`
	DowntimeSummary string                 `json:"sleepSummary,omitempty"`
}

// RuntimeState MAGI 运行态
type RuntimeState string

const (
	RuntimeStateDowntime  RuntimeState = "sleeping"
	RuntimeStateHeartbeat RuntimeState = "heartbeat"
	RuntimeStateExternal  RuntimeState = "external"
)

// RuntimeStatus MAGI 全局运行时状态
type RuntimeStatus struct {
	State             RuntimeState `json:"state"`
	Awake             bool         `json:"awake"`
	WakeSource        string       `json:"wakeSource,omitempty"`
	Reason            string       `json:"reason,omitempty"`
	DominantSeel      string       `json:"dominantSeel,omitempty"`
	DominantStance    string       `json:"dominantStance,omitempty"`
	DominantUpdatedAt int64        `json:"dominantUpdatedAt,omitempty"`
	CurrentRoundID    string       `json:"currentRoundId,omitempty"`
	CurrentTask       string       `json:"currentTask,omitempty"`
	LastHeartbeatAt   int64        `json:"lastHeartbeatAt,omitempty"`
	LastWakeAt        int64        `json:"lastWakeAt,omitempty"`
	LastDowntimeAt     int64        `json:"lastSleepAt,omitempty"`
	LastDowntimeSummary string       `json:"lastSleepSummary,omitempty"`
	UpdatedAt         int64        `json:"updatedAt"`
}
