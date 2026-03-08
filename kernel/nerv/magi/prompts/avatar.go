package prompts

import "fmt"

// BuildAvatarCreationKnowledgeBase 构建 Avatar 创建知识输入。
func BuildAvatarCreationKnowledgeBase(
	roleID,
	displayName,
	bindingKey,
	sourceSessionKey,
	channel,
	interfaceKind,
	trust,
	risk,
	firstUserMessage string,
) string {
	return fmt.Sprintf(`Avatar创建知识库：
- avatar_role_id=%s
- avatar_display_name=%s
- avatar_binding_key=%s
- source_session_key=%s
- channel=%s
- interface_kind=%s
- trust_base=%s
- risk_level=%s
- first_user_message=%s

硬约束：
1. Avatar 是绑定来源的执行分身，只服务当前绑定来源。
2. 提示词必须包含 report_to_core 约束与 heartbeat 约束。
3. 提示词不得暴露 MAGI 内部路由、投票细节。`,
		roleID, displayName, bindingKey, sourceSessionKey, channel, interfaceKind, trust, risk, firstUserMessage)
}

// BuildMelchiorBuildAvatarTask 构建 Melchior 的 buildAvatar 工具任务输入。
func BuildMelchiorBuildAvatarTask(knowledgeBase string) string {
	return fmt.Sprintf(`你是 Avatar 创建发起者。
你必须调用工具 buildAvatar，禁止输出普通文本。

%s

调用要求：
1. 当应创建 Avatar 时，initiate=true。
2. 必须给出 reason、systemPromptProposal、requirements。
3. systemPromptProposal 必须显式包含 avatar_role_id、channel、report_to_core 与 heartbeat 约束。`, knowledgeBase)
}

// BuildReviewerModifyAvatarTask 构建 Balthazar/Casper 的 modifyAvatar 工具任务输入。
func BuildReviewerModifyAvatarTask(
	knowledgeBase string,
	melchiorProposal string,
) string {
	return fmt.Sprintf(`你正在复核 Avatar 原型并执行修改。
你必须调用工具 modifyAvatar，禁止输出普通文本。

%s

Melchior 发起结果：
%s

调用要求：
1. decision 只能是 approved 或 rejected。
2. 必须给出 reason、systemPromptProposal、requirements。
3. systemPromptProposal 必须显式包含 avatar_role_id、channel、report_to_core 与 heartbeat 约束。`,
		knowledgeBase, melchiorProposal)
}

// BuildTrinitySynthesizeAvatarTask 构建 Trinity 的 synthesizeAvatar 工具任务输入。
func BuildTrinitySynthesizeAvatarTask(
	knowledgeBase string,
	proposalsPayload string,
) string {
	return fmt.Sprintf(`你负责综合 Avatar 修改提案并输出最终原型。
你必须调用工具 synthesizeAvatar，禁止输出普通文本。

%s

候选提案：
%s

调用要求：
1. finalSystemPrompt 必须是可直接用于 Avatar system prompt 的正文。
2. finalSystemPrompt 必须显式包含 avatar_role_id、channel、report_to_core 与 heartbeat 约束。
3. 不允许拒绝输出。`,
		knowledgeBase, proposalsPayload)
}
