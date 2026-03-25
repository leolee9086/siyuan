package prompts

import "fmt"

// BuildAvatarCreationKnowledgeBase 构建 Avatar 创建知识输入。
func BuildAvatarCreationKnowledgeBase(
	roleID,
	displayName,
	identityID,
	nickname,
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
- source_identity_id=%s
- source_nickname=%s
- avatar_binding_key=%s
- source_session_key=%s
- channel=%s
- interface_kind=%s
- trust_base=%s
- risk_level=%s
- first_user_message=%s

硬约束：
1. Avatar 是你的分身，将被dummysys（傀儡系统）用于替代你执行各种工作任务。
2. 化身的行为由你编写的系统提示词控制，但是也会被它们所处于的工作环境（例如claude code、gemini cli等）的提示词影响。
3. 傀儡系统的工作机制是在工具的系统提示词发送之前，将你编写的化身提示词插入到工具的系统提示词之前。
4. 因此你编写的化身提示词需要由极其明确的自我认知约束，它必须始终明确而且坚实地知晓自身作为你的化身的身份和存在目的。
5. 提示词必须包含 report_to_core 约束与 heartbeat 约束，傀儡系统会监控化身是否在每一轮工作中调用这些工具向作为本体的你汇报。
6. 为了保证你的系统提示词切实地约束了化身的行为，没有在每一次响应中包含汇报内容的化身将被视为失控，傀儡系统会立即终止它的运行。
`,
		roleID, displayName, identityID, nickname, bindingKey, sourceSessionKey, channel, interfaceKind, trust, risk, firstUserMessage)
}

// BuildMelchiorBuildAvatarTask 构建 Melchior 的 buildAvatar 工具任务输入。
func BuildMelchiorBuildAvatarTask(knowledgeBase string) string {
	return fmt.Sprintf(`现在有一个avatar需要被创建,你需要起草一个系统提示词来指导这个avatar的行为。
你可以根据传入的信息,判断化身所需要的能力和特征,并将这些内容整合到系统提示词中,以确保化身能够正确地理解和执行它的任务。
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

// BuildDominantSynthesizeAvatarTask 构建由主导者承担的 synthesizeAvatar 工具任务输入。
func BuildDominantSynthesizeAvatarTask(
	string,
	knowledgeBase string,
	proposalsPayload string,
) string {
	return fmt.Sprintf(`请根据给定材料输出最终 Avatar 原型。
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
