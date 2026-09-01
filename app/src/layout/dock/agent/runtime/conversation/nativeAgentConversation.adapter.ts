/** 用途：约束 adapter；使用范围：native 实现对象。 */
import type {AgentConversationAdapter} from "./agentConversation.types";
/** 用途：约束 admission；使用范围：控制端点返回值。 */
import type {AgentConversationAdmission} from "./agentConversation.types";
/** 用途：约束队列快照；使用范围：队列读取返回值。 */
import type {AgentConversationQueueSnapshot} from "./agentConversation.types";
/** 用途：约束统一输入；使用范围：queue 和 steer 请求体。 */
import type {AgentConversationSubmitInput} from "./agentConversation.types";
/** 用途：约束 native adapter 的观察器参数；使用范围：统一 submit 边界；解耦评估：native 事件由独立 session stream 投影，观察器在此保持协议兼容但不持有 UI。 */
import type {AgentConversationObserver} from "./agentConversation.types";
/** 用途：约束 queue 取消；使用范围：版本化控制请求。 */
import type {AgentConversationQueueIdentity} from "./agentConversation.types";
/** 用途：约束 queue 提升；使用范围：版本化控制请求。 */
import type {AgentConversationQueuePromotion} from "./agentConversation.types";
/** 用途：约束 turn 中断；使用范围：精确控制请求。 */
import type {AgentConversationInterruptInput} from "./agentConversation.types";
/** 用途：约束 queue 编辑；使用范围：版本化控制请求。 */
import type {AgentConversationQueueMutation} from "./agentConversation.types";
/** 用途：约束动态请求头；使用范围：队列快照读取。 */
import type {AgentRequestHeaders} from "./imports";
/** 用途：访问原生控制 API；使用范围：adapter 全部命令；解耦评估：adapter 本身就是网络端口边界，继续注入会复制相同抽象。 */
import {requestAgentConversationControl} from "./imports";
/** 用途：订阅原生会话事件；使用范围：adapter 长生命周期流；解耦评估：订阅器是协议实现，由 adapter 隔离于共享 UI。 */
import {subscribeAgentConversationEvents} from "./imports";

/** 构建 queue/update 共用的稳定请求体，不把前端历史写入独立队列快照。 */
function buildQueuedInput(input: AgentConversationSubmitInput) {
    return {
        inputID: input.inputID,
        sessionID: input.sessionID,
        userEntryID: input.userEntryID,
        message: input.message,
        ...(input.blockHTML ? {blockHTML: input.blockHTML} : {}),
        language: input.language,
        references: input.references,
        ...(input.editorContext ? {editorContext: input.editorContext} : {}),
        ...(input.pluginActions ? {pluginActions: input.pluginActions} : {}),
        ...(input.frontendCapabilities ? {frontendCapabilities: input.frontendCapabilities} : {}),
        ...(input.model ? {model: input.model} : {}),
        ...(input.reasoningEffort ? {reasoningEffort: input.reasoningEffort} : {}),
        ...(input.regenerate ? {regenerate: true, contentRevision: input.contentRevision} : {}),
    };
}

/** 原生 admission 根据 delivery 选择独立端点并保留同一输入幂等键。 */
async function submitNativeInput(
    input: AgentConversationSubmitInput,
    _observer: AgentConversationObserver,
    signal: AbortSignal,
) {
    const admissionPaths = {
        turn: "/api/ai/agent/turn",
        steer: "/api/ai/agent/steer",
        queue: "/api/ai/agent/queue",
    } as const;
    const path = admissionPaths[input.delivery];
    const body = input.delivery === "steer" ? {
        inputID: input.inputID,
        sessionID: input.sessionID,
        expectedTurnID: input.expectedTurnID,
        userEntryID: input.userEntryID,
        message: input.message,
        ...(input.blockHTML ? {blockHTML: input.blockHTML} : {}),
        references: input.references,
        ...(input.editorContext ? {editorContext: input.editorContext} : {}),
    } : buildQueuedInput(input);
    return requestAgentConversationControl<AgentConversationAdmission>({
        path, body, requestHeaders: input.requestHeaders, signal,
    });
}

/** 激活或冲突恢复时读取服务端权威队列快照。 */
async function loadNativeQueue(sessionID: string, requestHeaders: AgentRequestHeaders, signal?: AbortSignal) {
    const path = `/api/ai/agent/queue?sessionID=${encodeURIComponent(sessionID)}`;
    return requestAgentConversationControl<AgentConversationQueueSnapshot>({
        path, method: "GET", requestHeaders, signal,
    });
}

/** 构建版本化 queue 编辑、取消与提升命令，保持 adapter 主工厂规模稳定。 */
function createNativeQueueCommands() {
    return {
        /** 编辑仍为 pending 的 queue 项并携带乐观版本。 */
        async updateQueue(mutation: AgentConversationQueueMutation, signal?: AbortSignal) {
            return requestAgentConversationControl<AgentConversationAdmission>({
                path: "/api/ai/agent/queue/update",
                body: {...buildQueuedInput(mutation.input), queueVersion: mutation.queueVersion},
                requestHeaders: mutation.input.requestHeaders,
                signal,
            });
        },
        /** 取消指定 pending queue 项，Kernel 负责版本冲突判定。 */
        async cancelQueue(input: AgentConversationQueueIdentity, signal?: AbortSignal) {
            return requestAgentConversationControl<AgentConversationAdmission>({
                path: "/api/ai/agent/queue/cancel",
                body: {sessionID: input.sessionID, inputID: input.inputID, queueVersion: input.queueVersion},
                requestHeaders: input.requestHeaders,
                signal,
            });
        },
        /** 把 pending queue 项原子提升为当前 turn 的 steer。 */
        async promoteQueue(input: AgentConversationQueuePromotion, signal?: AbortSignal) {
            return requestAgentConversationControl<AgentConversationAdmission>({
                path: "/api/ai/agent/queue/promote",
                body: {
                    sessionID: input.sessionID, inputID: input.inputID,
                    expectedTurnID: input.expectedTurnID, queueVersion: input.queueVersion,
                },
                requestHeaders: input.requestHeaders,
                signal,
            });
        },
    };
}

/** 构建精确 turn 控制命令，后续能力可在独立对象中扩展。 */
function createNativeTurnCommands() {
    return {
        /** 中断精确匹配的当前 turn，同时保留后续 queue。 */
        async interrupt(input: AgentConversationInterruptInput, signal?: AbortSignal) {
            return requestAgentConversationControl<AgentConversationAdmission>({
                path: "/api/ai/agent/interrupt",
                body: {sessionID: input.sessionID, expectedTurnID: input.expectedTurnID, preserveQueue: true},
                requestHeaders: input.requestHeaders,
                signal,
            });
        },
    };
}

/**
 * 创建 native Agent 执行边界；所有差异集中在控制端点和事件订阅中。
 * @同步豁免: 生命周期 - adapter 是无活动资源的不可变配置对象，组合根需要同步注册。
 */
export function createNativeAgentConversationAdapter() {
    return {
        kind: "native-agent",
        capabilities: {
            supportsSteer: true,
            supportsQueue: true,
            supportsInterrupt: true,
            supportsQueueEdit: true,
            usesSessionEvents: true,
        },
        submit: submitNativeInput,
        loadQueue: loadNativeQueue,
        /** 将长生命周期订阅原样委托给协议读取器。 */
        subscribe: subscribeAgentConversationEvents,
        ...createNativeQueueCommands(),
        ...createNativeTurnCommands(),
    } satisfies AgentConversationAdapter;
}
