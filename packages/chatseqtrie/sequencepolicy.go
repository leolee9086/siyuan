package chatseqtrie

// SequencePolicy 定义消息进入前缀树前的序列投影。
//
// 许多 OpenAI-compatible 网关和 chat template 不按 request.messages 的表面顺序
// 消费 system 消息：它们会抽取会话中所有 system，并合并/前置到有效 prompt 顶部。
// 因此，中途新增一条 system 时，原始消息数组仍可能完整包含上一次请求作为前缀，
// 但服务端有效 prompt 会在顶部 system 块内提前分叉。若前缀树只看原始顺序，
// 就会把巨量缓存失效误判为高命中。
type SequencePolicy struct {
	// SystemMessagesFirst 使用稳定分区：system 保持相对顺序并前置，
	// 其它角色也保持原相对顺序。
	SystemMessagesFirst bool
	// PinnedPrefixCount 保留最前面的辅助节点不参与角色分区。
	// 例如调用方可固定 tools_fingerprint 在绝对首位，再投影后续真实消息。
	PinnedPrefixCount int
	RoleField         string
	SystemRole        string
}

// DefaultSequencePolicy 返回默认策略。默认模拟常见 provider 的有效 prompt：
// 所有 system 消息先于其它角色被消费。
func DefaultSequencePolicy() *SequencePolicy {
	return SystemMessagesFirstSequencePolicy(0)
}

// SystemMessagesFirstSequencePolicy 返回 system 前置策略。
func SystemMessagesFirstSequencePolicy(pinnedPrefixCount int) *SequencePolicy {
	if pinnedPrefixCount < 0 {
		pinnedPrefixCount = 0
	}
	return &SequencePolicy{
		SystemMessagesFirst: true,
		PinnedPrefixCount:   pinnedPrefixCount,
		RoleField:           "role",
		SystemRole:          "system",
	}
}

// PreserveOrderSequencePolicy 返回严格保留输入数组顺序的策略。
// 仅在已确认目标 provider 不会抽取/合并 system 消息时使用。
func PreserveOrderSequencePolicy() *SequencePolicy {
	return &SequencePolicy{
		SystemMessagesFirst: false,
		RoleField:           "role",
		SystemRole:          "system",
	}
}

func normalizeSequencePolicy(policy *SequencePolicy) SequencePolicy {
	if policy == nil {
		return *DefaultSequencePolicy()
	}
	normalized := *policy
	if normalized.PinnedPrefixCount < 0 {
		normalized.PinnedPrefixCount = 0
	}
	if normalized.RoleField == "" {
		normalized.RoleField = "role"
	}
	if normalized.SystemRole == "" {
		normalized.SystemRole = "system"
	}
	return normalized
}

func (p SequencePolicy) project(messages []Message) []Message {
	if !p.SystemMessagesFirst || len(messages) < 2 {
		return messages
	}
	pinned := p.PinnedPrefixCount
	if pinned > len(messages) {
		pinned = len(messages)
	}

	seenOther := false
	requiresProjection := false
	for _, msg := range messages[pinned:] {
		role, _ := msg[p.RoleField].(string)
		if role == p.SystemRole {
			if seenOther {
				requiresProjection = true
				break
			}
			continue
		}
		seenOther = true
	}
	if !requiresProjection {
		return messages
	}

	projected := make([]Message, 0, len(messages))
	projected = append(projected, messages[:pinned]...)
	for _, msg := range messages[pinned:] {
		role, _ := msg[p.RoleField].(string)
		if role == p.SystemRole {
			projected = append(projected, msg)
		}
	}
	for _, msg := range messages[pinned:] {
		role, _ := msg[p.RoleField].(string)
		if role != p.SystemRole {
			projected = append(projected, msg)
		}
	}
	return projected
}
