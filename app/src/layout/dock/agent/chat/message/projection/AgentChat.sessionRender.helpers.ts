import type {AgentChatRuntime} from "./imports";
import type {AgentToolCall} from "./imports";
import type {SessionEntry} from "./imports";
import type {ThinkingStep} from "./imports";
import type {AgentSession} from "./imports";
import {resolveTargetPolicy} from "./imports";
import {appendPersistedToolCalls} from "./AgentChat.persisted.methods";
import {appendPersistedAssistant} from "./AgentChat.persisted.methods";
import {appendPersistedConfirm} from "./AgentChat.persisted.methods";
import {appendPersistedQuestion} from "./AgentChat.persisted.methods";
import {appendUserMessage} from "./imports";
import {appendSnapshotInfo} from "./imports";
import {appendRollbackInfo} from "./imports";
import {renderMergedThinkingCard} from "./imports";

/** 表示后端会话中单条宽松兼容记录，转换后再进入前端判别联合。 */
type StoredEntry = NonNullable<AgentSession["entries"]>[number];
type PersistedEntry = Omit<StoredEntry, "type"> & {
    type: StoredEntry["type"] | "todo";
    result?: string;
    callID?: string;
};

/** 兼容旧思考步骤字段，并恢复合并后的思考卡片。 */
function renderLoadedThinkingEntry(runtime: AgentChatRuntime, entry: PersistedEntry) {
    if (!entry.steps?.length) {
        return;
    }
    /**
     * `匿名函数` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
     * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
     */
    const steps = entry.steps.map((step): ThinkingStep => ({
        reasoning: step.reasoning || "",
        reasoningContent: step.reasoningContent || "",
        ...(step.roundID ? {roundID: step.roundID} : {}),
        ...(step.toolCallIDs?.length ? {toolCallIDs: step.toolCallIDs} : {}),
        ...(step.toolNames?.length ? {toolNames: step.toolNames} :
            (step.toolCalls ? {toolNames: step.toolCalls.map((tool) => tool.name)} : {})),
        ...(step.content !== undefined ? {content: step.content} : {}),
    }));
    let duration = entry.duration;
    const lastText = entry.steps[entry.steps.length - 1]?.text;
    const legacyDuration = lastText?.match(/([\d.]+)\s*s/i)?.[1];
    // 条件 duration === undefined && legacyDuration 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (duration === undefined && legacyDuration) {
        duration = parseFloat(legacyDuration);
    }
    renderMergedThinkingCard(runtime, {
        steps,
        ...(entry.id !== undefined ? {entryID: entry.id} : {}),
        ...(duration !== undefined ? {duration} : {}),
    });
}

/** 将后端宽松工具记录转换为前端要求 arguments 始终存在的结构。 */
/**
 * `normalizeToolCalls` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function normalizeToolCalls(toolCalls: PersistedEntry["toolCalls"]): AgentToolCall[] {
    return (toolCalls || []).map((toolCall) => ({
        name: toolCall.name,
        arguments: toolCall.arguments || {},
        ...(toolCall.id ? {id: toolCall.id} : {}),
        ...(toolCall.argumentsJSON !== undefined ? {argumentsJSON: toolCall.argumentsJSON} : {}),
        ...(toolCall.result !== undefined ? {result: toolCall.result} : {}),
        ...(toolCall.state !== undefined ? {state: toolCall.state} : {}),
        ...(toolCall.providerData !== undefined ? {providerData: toolCall.providerData} : {}),
    }));
}

/** 恢复持久化助手内容，并根据工具调用选择对应渲染器。 */
function renderLoadedAssistantEntry(runtime: AgentChatRuntime, entry: PersistedEntry) {
    const toolCalls = normalizeToolCalls(entry.toolCalls);
    // 条件 toolCalls.length > 0 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (toolCalls.length > 0) {
        appendPersistedToolCalls(runtime, {
            content: entry.content || "",
            toolCalls,
            ...(entry.timestamp !== undefined ? {timestamp: entry.timestamp} : {}),
            ...(entry.id !== undefined ? {entryId: entry.id} : {}),
        });
        return;
    }
    appendPersistedAssistant(runtime, {
        content: entry.content || "",
        ...(entry.timestamp !== undefined ? {timestamp: entry.timestamp} : {}),
        ...(entry.id !== undefined ? {entryId: entry.id} : {}),
        allowRegenerate: resolveTargetPolicy(runtime).regenerationVisible,
    });
}

/** 渲染完整字段齐备的确认记录，忽略损坏的旧记录。 */
function renderLoadedConfirmEntry(runtime: AgentChatRuntime, entry: PersistedEntry) {
    if (!entry.name || !entry.args || !entry.confirmID) {
        return;
    }
    appendPersistedConfirm(runtime, {
        name: entry.name,
        args: entry.args,
        confirmID: entry.confirmID,
        ...(entry.id ? {id: entry.id} : {}),
        ...(entry.effects ? {effects: entry.effects} : {}),
        ...(entry.status ? {status: entry.status} : {}),
    });
}

/** 渲染完整字段齐备的提问记录，忽略损坏的旧记录。 */
function renderLoadedQuestionEntry(runtime: AgentChatRuntime, entry: PersistedEntry) {
    if (!entry.questionID || !entry.questions) {
        return;
    }
    appendPersistedQuestion(runtime, {
        questionID: entry.questionID,
        questions: entry.questions,
        ...(entry.id ? {id: entry.id} : {}),
        ...(entry.status ? {status: entry.status} : {}),
        ...(entry.answers ? {answers: entry.answers} : {}),
    });
}

/** 渲染单条持久化记录，并按类型分派到现有卡片渲染能力。 */
export function renderLoadedSessionEntry(runtime: AgentChatRuntime, entry: PersistedEntry) {
    // 条件 entry.type === "user" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "user") {
        appendUserMessage(runtime, entry.content || "", {
            ...(entry.timestamp !== undefined ? {timestamp: entry.timestamp} : {}),
            ...(entry.id !== undefined ? {entryId: entry.id} : {}),
            ...(entry.blockHTML !== undefined ? {blockHTML: entry.blockHTML} : {}),
        });
        return;
    }
    // 条件 entry.type === "thinking" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "thinking") {
        renderLoadedThinkingEntry(runtime, entry);
        return;
    }
    // 条件 entry.type === "assistant" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "assistant") {
        renderLoadedAssistantEntry(runtime, entry);
        return;
    }
    // 条件 entry.type === "confirm" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "confirm") {
        renderLoadedConfirmEntry(runtime, entry);
        return;
    }
    // 条件 entry.type === "question" 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "question") {
        renderLoadedQuestionEntry(runtime, entry);
        return;
    }
    if (entry.type === "todo" && entry.result) {
        appendPersistedToolCalls(runtime, {
            content: "",
            toolCalls: [{
                ...(entry.callID ? {id: entry.callID} : {}),
                name: "todo_write",
                arguments: {},
                result: entry.result,
                state: "completed",
            }],
            ...(entry.id ? {entryId: entry.id} : {}),
        });
        return;
    }
    // 条件 entry.type === "snapshot" && entry.snapshotID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "snapshot" && entry.snapshotID) {
        appendSnapshotInfo(runtime, entry.snapshotID, entry.id);
        return;
    }
    // 条件 entry.type === "rollback" && entry.snapshotID 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (entry.type === "rollback" && entry.snapshotID) {
        appendRollbackInfo(runtime, entry.snapshotID, entry.id);
    }
}

/** 转换持久化用户条目，保留存在的编辑器上下文字段。 */
/**
 * `deserializeUserEntry` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function deserializeUserEntry(entry: PersistedEntry): SessionEntry {
    return {type: "user", content: entry.content || "", ...(entry.id ? {id: entry.id} : {}),
        ...(entry.blockHTML ? {blockHTML: entry.blockHTML} : {}),
        ...(entry.references ? {references: entry.references} : {}),
        ...(entry.editorContext ? {editorContext: entry.editorContext} : {}),
        ...(entry.timestamp !== undefined ? {timestamp: entry.timestamp} : {})};
}

/** 转换持久化思考条目并丢弃只属于旧渲染协议的字段。 */
/**
 * `deserializeThinkingEntry` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function deserializeThinkingEntry(entry: PersistedEntry): SessionEntry {
    return {type: "thinking", steps: (entry.steps || []).map((step) => ({
        reasoning: step.reasoning,
        reasoningContent: step.reasoningContent,
        ...(step.roundID ? {roundID: step.roundID} : {}),
        ...(step.toolNames ? {toolNames: step.toolNames} : {}),
        ...(step.toolCallIDs ? {toolCallIDs: step.toolCallIDs} : {}),
        ...(step.text !== undefined ? {text: step.text} : {}),
        ...(step.toolCalls !== undefined ? {toolCalls: step.toolCalls} : {}),
        ...(step.content !== undefined ? {content: step.content} : {}),
    })), ...(entry.id ? {id: entry.id} : {}),
    ...(entry.duration !== undefined ? {duration: entry.duration} : {}),
    ...(entry.roundID ? {roundID: entry.roundID} : {})};
}

/** 转换持久化助手条目，并补齐工具调用的 arguments。 */
/**
 * `deserializeAssistantEntry` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function deserializeAssistantEntry(entry: PersistedEntry): SessionEntry {
    return {type: "assistant", ...(entry.id ? {id: entry.id} : {}),
        ...(entry.content !== undefined ? {content: entry.content} : {}),
        ...(entry.reasoningContent !== undefined ? {reasoningContent: entry.reasoningContent} : {}),
        ...(entry.responseOutput !== undefined ? {responseOutput: entry.responseOutput} : {}),
        ...(entry.responseOutputTokens !== undefined ? {responseOutputTokens: entry.responseOutputTokens} : {}),
        ...(entry.roundID ? {roundID: entry.roundID} : {}),
        ...(entry.toolCalls ? {toolCalls: normalizeToolCalls(entry.toolCalls)} : {}),
        ...(entry.timestamp !== undefined ? {timestamp: entry.timestamp} : {})};
}

/** 转换字段完整的确认条目；损坏记录不进入运行时。 */
/**
 * `deserializeConfirmEntry` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function deserializeConfirmEntry(entry: PersistedEntry): SessionEntry | null {
    if (!entry.name || !entry.args || !entry.confirmID) {
        return null;
    }
    return {type: "confirm", name: entry.name, args: entry.args, confirmID: entry.confirmID,
        ...(entry.id ? {id: entry.id} : {}), ...(entry.effects ? {effects: entry.effects} : {}),
        ...(entry.status ? {status: entry.status} : {}), ...(entry.roundID ? {roundID: entry.roundID} : {})};
}

/** 转换字段完整的提问条目；损坏记录不进入运行时。 */
/**
 * `deserializeQuestionEntry` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function deserializeQuestionEntry(entry: PersistedEntry): SessionEntry | null {
    if (!entry.questionID || !entry.questions) {
        return null;
    }
    return {type: "question", questionID: entry.questionID, questions: entry.questions,
        ...(entry.id ? {id: entry.id} : {}), ...(entry.status ? {status: entry.status} : {}),
        ...(entry.roundID ? {roundID: entry.roundID} : {}),
        ...(entry.answers ? {answers: entry.answers} : {})};
}

/** 将后端宽松条目转换为运行时判别联合，缺失关键字段的记录返回空值。 */
/**
 * `deserializeSessionEntry` 负责消息处理流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
export function deserializeSessionEntry(entry: PersistedEntry): SessionEntry | null {
    if (entry.type === "user") {
return deserializeUserEntry(entry);
}
    if (entry.type === "thinking") {
return deserializeThinkingEntry(entry);
}
    if (entry.type === "assistant") {
return deserializeAssistantEntry(entry);
}
    if (entry.type === "confirm") {
return deserializeConfirmEntry(entry);
}
    if (entry.type === "question") {
return deserializeQuestionEntry(entry);
}
    if (entry.type === "todo" && entry.result) {
        return {type: "todo", result: entry.result, ...(entry.id ? {id: entry.id} : {}),
            ...(entry.callID ? {callID: entry.callID} : {}), ...(entry.roundID ? {roundID: entry.roundID} : {})};
    }
    if (entry.type === "snapshot" && entry.snapshotID) {
        return {type: "snapshot", snapshotID: entry.snapshotID, ...(entry.id ? {id: entry.id} : {}),
            ...(entry.roundID ? {roundID: entry.roundID} : {})};
    }
    return entry.type === "rollback" && entry.snapshotID
        ? {type: "rollback", snapshotID: entry.snapshotID, ...(entry.id ? {id: entry.id} : {}),
            ...(entry.roundID ? {roundID: entry.roundID} : {})}
        : null;
}
