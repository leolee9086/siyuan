/**
 * MAGI系统Vue Composable
 *
 * 从 toread/MAGI/composables/useMagi.js 迁移。
 * 提供MAGI系统的响应式状态管理和初始化逻辑。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi

import { ref, reactive, computed, watch } from "vue";
import type {
    ConnectionStatus,
    MagiRuntimeStatus,
    WrappedSeel,
    UseMagiOptions,
    UseMagiReturn,
} from "./useMagi.types";
import type { MockWISE实例, MagiPromptSet } from "../core/wise/wise.types";
import type { ContextMessage, MockMessage } from "../core/core.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { initMagi } from "../core/wise/mockWise.subclass";
import { getMagiI18nText } from "../utils/magiI18n";
import { resolveStartupPromptInjectionsByActiveSeed } from "../prompts/personaRuntimePromptBuilder";
import { createMagiEventBus } from "../events/magiEventBus";
import { bindMagiProjector } from "../events/magiProjector";
import { bindMagiWebSocketEventBridge } from "../events/bindMagiWebSocketEventBridge";
import type {
    MagiRuntimeStatusUpdatedEvent,
    MagiSeelReplyStartedEvent,
} from "../events/magiEventBus.types";
import { fetchMagiPersonaStatus } from "../service/magiPersonaStatus";
import { appendConsensusMessage } from "./useMagi.consensus";
import { MAGI_RUNTIME_MONITOR_SESSION_ID } from "../adapters/magiStandardLLMAdapter.backend";

/** 清空响应式数组内容（保持引用不变） */
async function clearReactiveArrays(
    seels: WrappedSeel[],
    consensusMessages: MagiMessage[],
    clearMessages = true,
): Promise<void> {
    seels.splice(0, seels.length);
    // 需要保留对话消息时仅重置贤者实例，不清空消息数组。
    if (clearMessages) {
        consensusMessages.splice(0, consensusMessages.length);
    }
}

/**
 * 作用：把 MAGI 运行时的多个取消订阅函数组合成幂等销毁器。
 * 意图：初始化失败和 Vue 卸载必须走同一条资源释放路径。
 * 调用时机：websocket、事件总线和 projector 完成绑定后创建一次。
 */
function createMagiRuntimeDisposer(disposers: Array<() => void>) {
    let disposed = false;
    return () => {
        // 同一运行时可能同时收到初始化失败和宿主卸载，只执行一次底层释放。
        if (disposed) {
            return;
        }
        disposed = true;
        for (const dispose of disposers) {
            dispose();
        }
    };
}

/** 将底层 MockMessage 规范化为 UI 所需的 MagiMessage */
async function toMagiMessage(
    message: MockMessage,
    index: number,
): Promise<MagiMessage> {
    const normalizedMessage: MagiMessage = {
        id: `${message.type}-${message.timestamp}-${index}`,
        type: message.type,
        content: message.content ?? "",
        status: message.status ?? "success",
        timestamp: message.timestamp,
        ...(message.meta ? { meta: message.meta } : {}),
    };
    return normalizedMessage;
}

/** 同步原始实例状态到响应式包装对象，避免状态双轨 */
async function syncWrappedSeelState(
    wrapped: WrappedSeel,
    ai: MockWISE实例,
): Promise<void> {
    wrapped.loading = ai.loading;

    const latestMessages = await Promise.all(
        ai.messages.map((message, index) => toMagiMessage(message, index)),
    );
    wrapped.messages.splice(0, wrapped.messages.length, ...latestMessages);
}

function syncWrappedSeelConnectionStatus(
    seels: WrappedSeel[],
    websocketConnectionStatus: ConnectionStatus,
): void {
    const connected = websocketConnectionStatus === "connected";
    for (const seel of seels) {
        seel.connected = connected;
    }
}

/**
 * 创建流式 TTT 代理，避免 chunk 周期覆写消息数组
 *
 * 作用：包装原始 AsyncGenerator，仅同步连接态并转发流事件
 * 意图：让消息更新由流事件回调驱动，贴近后续 websocket 监听模型
 * 调用时机：wrapped.reply 收到 SSE 流式返回值后立即调用
 */
async function* createTTTStreamProxy(
    wrapped: WrappedSeel,
    ai: MockWISE实例,
    stream: AsyncGenerator<string>,
): AsyncGenerator<string> {
    try {
        for await (const chunk of stream) {
            // TTT 过渡层：仅转发流式事件，不在 chunk 周期覆写消息数组。
            yield chunk;
        }
    } finally {
        wrapped.loading = ai.loading;
    }
}


/** 初始化并写入 wrapped seels */
async function initializeWrappedSeels(
    seels: WrappedSeel[],
    websocketConnectionStatus: { value: ConnectionStatus },
    promptInjections?: MagiPromptSet,
    personaName?: string,
): Promise<void> {
    const rawSeels = await initMagi({
        delay: 800,
        autoConnect: false,
        memorySize: 7,
        ...(promptInjections ? { promptInjections } : {}),
        ...(personaName ? { personaName } : {}),
    });

    const wrappedSeels = await Promise.all(
        rawSeels.map((ai) => wrapSeelInstance(ai)),
    );
    seels.push(...wrappedSeels);
    syncWrappedSeelConnectionStatus(seels, websocketConnectionStatus.value);
}

/** 启动/重连时解析应使用的人格注入（显式参数优先，其次工作空间 active seed）。 */
async function resolvePromptInjectionsForInit(
    explicitPromptInjections?: MagiPromptSet,
): Promise<MagiPromptSet | undefined> {
    if (explicitPromptInjections) {
        return explicitPromptInjections;
    }
    const activeSeed = await resolveStartupPromptInjectionsByActiveSeed();
    return activeSeed?.promptInjections;
}

function resolvePersonaNameFromStatus(status: Awaited<ReturnType<typeof fetchMagiPersonaStatus>>): string | undefined {
    if (!status) {
        return undefined;
    }
    const subjectName = status.subjectName.trim();
    return subjectName || undefined;
}

function cloneRuntimeStatus(status: MagiRuntimeStatus): MagiRuntimeStatus {
    return { ...status };
}

function buildRuntimeStatusFromEvent(payload: MagiRuntimeStatusUpdatedEvent): MagiRuntimeStatus {
    return {
        state: payload.state,
        awake: payload.awake,
        ...(payload.wakeSource ? { wakeSource: payload.wakeSource } : {}),
        ...(payload.reason ? { reason: payload.reason } : {}),
        ...(payload.dominantSeel ? { dominantSeel: payload.dominantSeel } : {}),
        ...(payload.dominantStance ? { dominantStance: payload.dominantStance } : {}),
        ...(typeof payload.dominantUpdatedAt === "number" ? { dominantUpdatedAt: payload.dominantUpdatedAt } : {}),
        ...(payload.currentRoundId ? { currentRoundId: payload.currentRoundId } : {}),
        ...(payload.currentTask ? { currentTask: payload.currentTask } : {}),
        ...(typeof payload.lastHeartbeatAt === "number" ? { lastHeartbeatAt: payload.lastHeartbeatAt } : {}),
        ...(typeof payload.lastWakeAt === "number" ? { lastWakeAt: payload.lastWakeAt } : {}),
        ...(typeof payload.lastSleepAt === "number" ? { lastSleepAt: payload.lastSleepAt } : {}),
        ...(payload.lastSleepSummary ? { lastSleepSummary: payload.lastSleepSummary } : {}),
        ...(typeof payload.updatedAt === "number" ? { updatedAt: payload.updatedAt } : {}),
    };
}

function readMessageMetaString(message: MagiMessage | null | undefined, key: string): string | undefined {
    if (!message?.meta || typeof message.meta !== "object") {
        return undefined;
    }
    const value = Reflect.get(message.meta, key);
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function applyDominantRuntimeHintFromReplyStarted(
    current: MagiRuntimeStatus | null,
    payload: MagiSeelReplyStartedEvent,
): MagiRuntimeStatus | null {
    const dominantSeel = readMessageMetaString(payload.streamMessage, "dominantSeel");
    if (!dominantSeel) {
        return current;
    }

    const dominantStance = readMessageMetaString(payload.streamMessage, "dominantStance");
    const next: MagiRuntimeStatus = current
        ? { ...current }
        : {
            state: "external",
            awake: true,
        };

    next.state = "external";
    next.awake = true;
    next.currentRoundId = payload.roundId;
    next.dominantSeel = dominantSeel;
    if (dominantStance) {
        next.dominantStance = dominantStance;
    } else {
        delete next.dominantStance;
    }
    next.dominantUpdatedAt = payload.timestamp;
    next.updatedAt = Math.max(next.updatedAt ?? 0, payload.timestamp);
    return next;
}

function resolveConnectionStatusFromPersonaStatus(
    currentStatus: ConnectionStatus,
    status: Awaited<ReturnType<typeof fetchMagiPersonaStatus>>,
): ConnectionStatus {
    if (status?.blocked) {
        return "error";
    }
    if (status) {
        return "connected";
    }
    return currentStatus === "connected" ? currentStatus : "disconnected";
}

async function appendBlockedPersonaMessageIfNeeded(
    consensusMessages: MagiMessage[],
    status: Awaited<ReturnType<typeof fetchMagiPersonaStatus>>,
): Promise<void> {
    if (!status?.blocked || !status.message) {
        return;
    }
    await appendConsensusMessage(
        consensusMessages,
        "error",
        status.message,
        status.missingFields.length > 0 ? { missingFields: status.missingFields } : undefined,
    );
}

/**
 * 将MockWISE实例包装为Vue响应式的WrappedSeel
 *
 * 作用：桥接MockWISE实例与Vue响应式系统
 * 意图：使消息列表变更能触发Vue组件重渲染
 * 调用时机：initializeMAGI 中对每个原始实例调用
 */
async function wrapSeelInstance(ai: MockWISE实例): Promise<WrappedSeel> {
    const messages: MagiMessage[] = reactive([]);

    const wrapped: WrappedSeel = {
        _originalAI: ai,
        config: {
            name: ai.config.name,
            displayName: ai.config.displayName,
            color: ai.config.color,
            icon: ai.config.icon,
            responseType: ai.config.responseType,
            persona: ai.config.persona,
            memorySize: ai.config.memorySize,
        },
        messages,
        loading: false,
        connected: false,
        /**
         * 作用：代理底层 `reply` 并在前后同步 wrapped 状态。
         * 意图：确保消息流与 loading 状态对 Vue 响应式可见。
         * 调用时机：共识与运行时流程请求单个贤者回复时。
         */
        async reply(userInput, options) {
            await syncWrappedSeelState(wrapped, ai);
            const replyResult = await ai.reply(userInput, options);
            await syncWrappedSeelState(wrapped, ai);

            if (typeof replyResult === "string") {
                await syncWrappedSeelState(wrapped, ai);
                return replyResult;
            }

            return createTTTStreamProxy(wrapped, ai, replyResult);
        },
        /**
         * 作用：代理底层 `voteFor` 并同步投票后的消息/状态。
         * 意图：让投票消息可立即反映到 UI，不破坏原有面板显示。
         * 调用时机：共识链路命中审慎决策分支时。
         */
        async voteFor(proposedAction) {
            const result = await ai.voteFor(proposedAction);
            await syncWrappedSeelState(wrapped, ai);
            return result;
        },
        /**
         * 作用：将外部生成的历史消息写入底层贤者上下文栈并同步到响应式包装对象。
         * 意图：让共识层可把 Trinity 结果注入三贤人各自历史，而不走临时 override 拼接。
         * 调用时机：每轮最终共识生成后，命中“可复用 Trinity 历史”分支时调用。
         */
        async appendContextMessages(messages: ContextMessage[]) {
            ai.appendContextMessages(messages);
            await syncWrappedSeelState(wrapped, ai);
        },
        /**
         * 作用：将该贤者最近一条 assistant 历史替换为指定文本并同步包装状态。
         * 意图：在共享 Trinity 历史时覆盖“贤者上一轮自答”，让下一轮上下文优先看到 Trinity。
         * 调用时机：每轮最终共识判定可注入 Trinity 历史时。
         */
        async replaceLatestAssistantContextMessage(content: string) {
            ai.replaceLatestAssistantContextMessage(content);
            await syncWrappedSeelState(wrapped, ai);
        },
    };

    await syncWrappedSeelState(wrapped, ai);
    return wrapped;
}


/**
 * MAGI系统状态管理composable
 *
 * 作用：封装MAGI系统的初始化、贤者实例管理和连接状态
 * 意图：为Vue组件提供响应式的MAGI系统接口
 * 调用时机：MagiRoot 工作空间守卫通过后调用
 */
export async function useMagi(options?: UseMagiOptions): Promise<UseMagiReturn> {
    const seels: WrappedSeel[] = reactive([]);
    const connectionStatus = ref<ConnectionStatus>("connecting");
    const websocketConnectionStatus = ref<ConnectionStatus>("connecting");
    const consensusMessages: MagiMessage[] = reactive([]);
    const runtimeStatus = ref<MagiRuntimeStatus | null>(null);
    const isAnySeelLoading = computed(() =>
        seels.some((seel) => seel.loading),
    );
    const eventBus = await createMagiEventBus();
    const stopConnectionWatch = watch(
        websocketConnectionStatus,
        (nextStatus) => {
            syncWrappedSeelConnectionStatus(seels, nextStatus);
        },
        { immediate: true },
    );
    const websocketBridge = bindMagiWebSocketEventBridge(eventBus, {
        sessionId: MAGI_RUNTIME_MONITOR_SESSION_ID,
        onConnecting: () => {
            websocketConnectionStatus.value = "connecting";
        },
        onOpen: () => {
            websocketConnectionStatus.value = "connected";
        },
        onClose: () => {
            runtimeStatus.value = null;
            websocketConnectionStatus.value = "disconnected";
        },
    });
    const stopRuntimeStatusSubscription = eventBus.subscribe("RUNTIME_STATUS_UPDATED", (payload) => {
        runtimeStatus.value = buildRuntimeStatusFromEvent(payload);
    });
    const stopReplyStartedSubscription = eventBus.subscribe("SEEL_REPLY_STARTED", (payload) => {
        runtimeStatus.value = applyDominantRuntimeHintFromReplyStarted(runtimeStatus.value, payload);
    });
    const stopProjector = await bindMagiProjector(eventBus, {
        seels,
        consensusMessages,
    });
    const disposeRuntimeBindings = createMagiRuntimeDisposer([
        stopConnectionWatch,
        websocketBridge.disconnect,
        stopRuntimeStatusSubscription,
        stopReplyStartedSubscription,
        stopProjector,
    ]);

    try {
        const initialPersonaStatus = await fetchMagiPersonaStatus();
        if (initialPersonaStatus?.runtimeStatus) {
            runtimeStatus.value = cloneRuntimeStatus(initialPersonaStatus.runtimeStatus);
        }
        await appendBlockedPersonaMessageIfNeeded(consensusMessages, initialPersonaStatus);
        connectionStatus.value = resolveConnectionStatusFromPersonaStatus(
            connectionStatus.value,
            initialPersonaStatus,
        );
        const startupPromptInjections = await resolvePromptInjectionsForInit(options?.promptInjections);
        const runtimePersonaName = resolvePersonaNameFromStatus(initialPersonaStatus);
        await initializeWrappedSeels(seels, websocketConnectionStatus, startupPromptInjections, runtimePersonaName);
    } catch (error) {
        disposeRuntimeBindings();
        throw error;
    }
    return {
        seels,
        connectionStatus,
        websocketConnectionStatus,
        consensusMessages,
        isAnySeelLoading,
        runtimeStatus,
        /**
         * 作用：重新初始化 MAGI 实例并清空消息。
         * 意图：支持连接恢复与状态重建。
         * 调用时机：用户主动触发重连或上层容器请求重置时。
         */
        initializeMAGI: async (options) => {
            await reinitializeMAGI(
                seels,
                connectionStatus,
                websocketConnectionStatus,
                runtimeStatus,
                consensusMessages,
                options,
            );
        },
        destroy: () => {
            disposeRuntimeBindings();
            seels.splice(0, seels.length);
            consensusMessages.splice(0, consensusMessages.length);
            runtimeStatus.value = null;
            websocketConnectionStatus.value = "disconnected";
        },
    };
}

/**
 * 重新初始化MAGI系统（清空现有实例后重建）
 *
 * 作用：销毁现有贤者实例并重新创建
 * 意图：支持用户手动重连或配置变更后的重初始化
 * 调用时机：用户点击重连按钮时
 */
async function reinitializeMAGI(
    seels: WrappedSeel[],
    connectionStatus: { value: ConnectionStatus },
    websocketConnectionStatus: { value: ConnectionStatus },
    runtimeStatus: { value: MagiRuntimeStatus | null },
    consensusMessages: MagiMessage[],
    options?: {
        promptInjections?: MagiPromptSet;
        preserveConsensusMessages?: boolean;
    },
): Promise<void> {
    try {
        const shouldClearMessages = !options?.preserveConsensusMessages;
        await clearReactiveArrays(
            seels,
            consensusMessages,
            shouldClearMessages,
        );
        const resolvedPromptInjections = await resolvePromptInjectionsForInit(options?.promptInjections);
        const personaStatus = await fetchMagiPersonaStatus();
        if (personaStatus?.runtimeStatus) {
            runtimeStatus.value = cloneRuntimeStatus(personaStatus.runtimeStatus);
        }
        await appendBlockedPersonaMessageIfNeeded(consensusMessages, personaStatus);
        const runtimePersonaName = resolvePersonaNameFromStatus(personaStatus);
        await initializeWrappedSeels(
            seels,
            websocketConnectionStatus,
            resolvedPromptInjections,
            runtimePersonaName,
        );
        connectionStatus.value = resolveConnectionStatusFromPersonaStatus(
            connectionStatus.value,
            personaStatus,
        );
        await appendConsensusMessage(
            consensusMessages,
            "system",
            getMagiI18nText("systemInitCompleted"),
        );
    } catch (error) {
        connectionStatus.value = "error";
        const message = error instanceof Error
            ? error.message
            : String(error);
        await appendConsensusMessage(
            consensusMessages,
            "error",
            `${getMagiI18nText("systemInitFailedPrefix")}: ${message}`,
        );
    }
}
