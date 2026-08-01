package agentqueue

// QueueDropPolicy 定义队列容量溢出时的处理策略。
// 对齐 OpenClaw `queue-helpers.ts` 的 QueueDropPolicy（old / new / summarize）。
type QueueDropPolicy string

const (
	// DropNew 队列已满时拒绝新输入（返回 ErrQueueFull）。默认策略，最保守。
	DropNew QueueDropPolicy = "new"
	// DropOld 队列已满时丢弃最旧的 pending 输入，接纳新输入。
	// 适用于低价值、可丢失的输入（如日志类渠道消息）。
	DropOld QueueDropPolicy = "old"
	// DropSummarize 队列已满时丢弃最旧 pending 输入，并记录一行摘要，
	// 供上层在后续投递时告知模型「有 N 条消息因溢出被合并」。
	// 对齐 OpenClaw 的 summarize 溢出摘要机制。
	DropSummarize QueueDropPolicy = "summarize"
)

// QueueDedupeMode 定义入队时的重复检测粒度。
// 对齐 OpenClaw `queue/types.ts` 的 QueueDedupeMode（message-id / prompt / none）。
type QueueDedupeMode string

const (
	// DedupeNone 不进行重复检测（每次提交都入队）。
	DedupeNone QueueDedupeMode = "none"
	// DedupeMessageID 按 Input.ID 去重（幂等键）。默认模式。
	// 同一 ID 重复提交返回 ErrDuplicateInput（幂等命中）。
	DedupeMessageID QueueDedupeMode = "message-id"
	// DedupePrompt 按 Content 文本去重：同一会话内存在相同文本的 pending
	// 输入时拒绝重复提交（防止用户连发相同消息导致重复处理）。
	DedupePrompt QueueDedupeMode = "prompt"
)

// DefaultQueueSettings 返回默认队列策略。
// 与历史行为保持一致：容量 DefaultCapacity、拒绝新输入、按消息 ID 去重、
// 不启用 collect 批量、不启用 injecting 超时恢复。
func DefaultQueueSettings() QueueSettings {
	return QueueSettings{
		Cap:            DefaultCapacity,
		DropPolicy:     DropNew,
		DedupeMode:     DedupeMessageID,
		CollectMax:     0, // 0 = 不启用 collect
		RecoverStaleMs: 0, // 0 = 不启用超时恢复
	}
}

// QueueSettings 描述单个会话输入队列的调度策略。
type QueueSettings struct {
	// Cap 队列容量上限（pending 项数）。<=0 使用 DefaultCapacity。
	Cap int
	// DropPolicy 溢出策略。空值使用 DropNew。
	DropPolicy QueueDropPolicy
	// DedupeMode 去重模式。空值使用 DedupeMessageID。
	DedupeMode QueueDedupeMode
	// CollectMax collect 批量取出上限：TakeBatch 单次最多取出的 pending 数。
	// <=0 表示不启用 collect（TakeBatch 退化为单条 Take）。
	CollectMax int
	// RecoverStaleMs injecting 状态超时恢复阈值（毫秒）。
	// 超过该时长仍处于 injecting 的输入会被 RecoverStale 重置为 pending，
	// 防止执行方崩溃/卡死后输入永久滞留。<=0 表示不启用自动恢复。
	RecoverStaleMs int64
}

// normalize 返回补齐默认值后的规范化副本（不修改接收者）。
func (s QueueSettings) normalize() QueueSettings {
	out := s
	if out.Cap <= 0 {
		out.Cap = DefaultCapacity
	}
	if out.DropPolicy == "" {
		out.DropPolicy = DropNew
	}
	if out.DedupeMode == "" {
		out.DedupeMode = DedupeMessageID
	}
	if out.CollectMax < 0 {
		out.CollectMax = 0
	}
	if out.RecoverStaleMs < 0 {
		out.RecoverStaleMs = 0
	}
	return out
}

// QueueSummary 是 DropSummarize 策略下被丢弃输入的摘要状态。
// 上层可在投递前读取并注入模型上下文，告知溢出合并情况。
type QueueSummary struct {
	// DroppedCount 因溢出被丢弃的累计条数。
	DroppedCount int `json:"droppedCount"`
	// SummaryLines 被丢弃输入的文本摘要（每行一条，已截断）。
	SummaryLines []string `json:"summaryLines"`
}
