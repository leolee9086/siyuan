/** 用途：约束思考步骤和会话条目状态；使用范围：步骤归属与提交。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：构建思考会话条目；使用范围：步骤提交。 */
import type {SessionEntry} from "./imports";
/** 用途：构建当前思考步骤；使用范围：步骤提交。 */
import type {ThinkingStep} from "./imports";

/** 把思考卡片内的正文归属到最近一个思考步骤。 @同步豁免: 生命周期 */
export function attachStepContent(runtime: AgentChatRuntime, content: string) {
    const lastStep = runtime.currentThinkingSteps[runtime.currentThinkingSteps.length - 1];
    if (content && lastStep) {
        lastStep.content = content;
    }
    runtime.currentThinkingStepContent = "";
}

/** 把当前思考步骤写入会话条目并重置卡片边界状态。 @同步豁免: 生命周期 */
export function flushThinkingStep(runtime: AgentChatRuntime) {
    if (runtime.currentThinkingText) {
        runtime.currentThinkingSteps.push(createCurrentThinkingStep(runtime));
        runtime.lastStepToolCount = runtime.currentToolCalls.length;
        runtime.currentThinkingText = "";
        runtime.currentThinkingStepContent = "";
    }
    if (runtime.currentThinkingSteps.length === 0) {
        return;
    }
    const entry: SessionEntry = {
        type: "thinking",
        steps: runtime.currentThinkingSteps.slice(),
        ...(runtime.currentThinkingEntryId ? {id: runtime.currentThinkingEntryId} : {}),
        ...(runtime.currentThinkingDuration ? {duration: runtime.currentThinkingDuration} : {}),
    };
    runtime.entries.push(entry);
    runtime.currentThinkingSteps = [];
    runtime.currentThinkingEntryId = "";
    runtime.renderedToolNames = {};
}

/** 从当前流式状态创建单个可持久化思考步骤。 */
function createCurrentThinkingStep(runtime: AgentChatRuntime): ThinkingStep {
    const toolCalls = runtime.currentToolCalls.slice(runtime.lastStepToolCount);
    const toolNames = toolCalls.map((toolCall) => toolCall.name);
    const toolCallIDs = toolCalls.flatMap((toolCall) => toolCall.id ? [toolCall.id] : []);
    return {
        reasoning: runtime.currentThinkingReasoning,
        reasoningContent: runtime.currentThinkingReasoningContent,
        ...(runtime.currentRoundID ? {roundID: runtime.currentRoundID} : {}),
        ...(toolNames.length > 0 ? {toolNames} : {}),
        ...(toolCallIDs.length > 0 ? {toolCallIDs} : {}),
        ...(runtime.currentThinkingStepContent ? {content: runtime.currentThinkingStepContent} : {}),
    };
}
