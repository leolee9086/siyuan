/**
 * MAGI系统Vue Composable
 *
 * 从 toread/MAGI/composables/useMagi.js 迁移。
 * 提供MAGI系统的响应式状态管理和初始化逻辑。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi

import { ref, reactive, computed } from "vue";
import type {
    ConnectionStatus,
    SendUserMessageOptions,
    WrappedSeel,
    UseMagiOptions,
    UseMagiReturn,
} from "./useMagi.types";
import type { MockWISE实例, MagiPromptSet } from "../core/wise/wise.types";
import type { ContextMessage, MockMessage } from "../core/core.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { initMagi } from "../core/wise/mockWise.subclass";
import { getMagiI18nText } from "../utils/magiI18n";
import {
    appendConsensusMessage,
} from "./useMagi.consensus";
import { resolveStartupPromptInjectionsByActiveSeed } from "../prompts/personaRuntimePromptBuilder";
import { createMagiEventBus } from "../events/magiEventBus";
import { bindMagiProjector } from "../events/magiProjector";
import { createStandardLLMAdapter } from "../adapters/standardLLMAdapterFactory";
import type { ChatRequestParams } from "../../ai/types";

const SOURCE_SIMULATION_TAG = "magi_request_source";

/** 将来源模拟上下文编码为标准 system 消息（保持 OpenAI-compatible 外观）。 */
function buildSourceSimulationSystemMessage(
    options?: SendUserMessageOptions,
): ChatRequestParams["messages"][number] | null {
    const sourceSimulation = options?.sourceSimulation;
    if (!sourceSimulation) {
        return null;
    }
    const payload = JSON.stringify(sourceSimulation);
    return {
        role: "system",
        content: `<${SOURCE_SIMULATION_TAG}>${payload}</${SOURCE_SIMULATION_TAG}>`,
    };
}

/** 清空响应式数组内容（保持引用不变） */
async function clearReactiveArrays(
    seels: WrappedSeel[],
    messages: MagiMessage[],
    clearMessages = true,
): Promise<void> {
    seels.splice(0, seels.length);
    // 需要保留对话消息时仅重置贤者实例，不清空消息数组。
    if (clearMessages) {
        messages.splice(0, messages.length);
    }
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
    wrapped.connected = ai.connected;

    const latestMessages = await Promise.all(
        ai.messages.map((message, index) => toMagiMessage(message, index)),
    );
    wrapped.messages.splice(0, wrapped.messages.length, ...latestMessages);
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
            wrapped.connected = ai.connected;
            yield chunk;
        }
    } finally {
        wrapped.connected = ai.connected;
        wrapped.loading = ai.loading;
    }
}


/** 初始化并写入 wrapped seels */
async function initializeWrappedSeels(
    seels: WrappedSeel[],
    connectionStatus: { value: ConnectionStatus },
    promptInjections?: MagiPromptSet,
): Promise<void> {
    const rawSeels = await initMagi({
        delay: 800,
        autoConnect: true,
        memorySize: 7,
        ...(promptInjections ? { promptInjections } : {}),
    });

    const wrappedSeels = await Promise.all(
        rawSeels.map((ai) => wrapSeelInstance(ai)),
    );
    seels.push(...wrappedSeels);
    connectionStatus.value = "connected";
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
         * 调用时机：`sendUserMessageInternal` 与共识模块发起回复时。
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
 * 调用时机：MagiMainPanel组件setup阶段调用
 */
export async function useMagi(options?: UseMagiOptions): Promise<UseMagiReturn> {
    const seels: WrappedSeel[] = reactive([]);
    const connectionStatus = ref<ConnectionStatus>("disconnected");
    const consensusMessages: MagiMessage[] = reactive([]);
    const isAnySeelLoading = computed(() => seels.some((seel) => seel.loading));
    const eventBus = await createMagiEventBus();
    const stopProjector = await bindMagiProjector(eventBus, {
        seels,
        consensusMessages,
    });
    void stopProjector;

    const startupPromptInjections = await resolvePromptInjectionsForInit(options?.promptInjections);
    await initializeWrappedSeels(seels, connectionStatus, startupPromptInjections);
    const llmAdapter = await createStandardLLMAdapter({
        model: "magi-trinity",
        connectionStatus,
        consensusMessages,
        seels,
        eventBus,
    });

    return {
        seels,
        connectionStatus,
        consensusMessages,
        isAnySeelLoading,
        /**
         * 作用：把 UI 输入文本接入完整共识链路。
         * 意图：对外暴露稳定入口，避免上层组件感知内部实现细节。
         * 调用时机：`MagiMainPanel` 的 `submit-input` 事件上抛到容器后调用。
         */
        sendUserMessage: async (text: string, options?: SendUserMessageOptions) => {
            const userInput = text.trim();
            if (!userInput) {
                return "";
            }
            const sourceSystemMessage = buildSourceSimulationSystemMessage(options);
            const messages: ChatRequestParams["messages"] = [];
            if (sourceSystemMessage) {
                messages.push(sourceSystemMessage);
            }
            messages.push({ role: "user", content: userInput });
            const request: ChatRequestParams = {
                model: "magi-trinity",
                messages,
                stream: false,
            };
            const response = await llmAdapter.createChatCompletion(request);
            return response.choices?.[0]?.message?.content ?? "";
        },
        /**
         * 作用：重新初始化 MAGI 实例并清空消息。
         * 意图：支持连接恢复与状态重建。
         * 调用时机：用户主动触发重连或上层容器请求重置时。
         */
        initializeMAGI: async (options) => {
            await reinitializeMAGI(seels, connectionStatus, consensusMessages, options);
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
    consensusMessages: MagiMessage[],
    options?: {
        promptInjections?: MagiPromptSet;
        preserveConsensusMessages?: boolean;
    },
): Promise<void> {
    try {
        connectionStatus.value = "connecting";
        const shouldClearMessages = !options?.preserveConsensusMessages;
        await clearReactiveArrays(seels, consensusMessages, shouldClearMessages);
        const resolvedPromptInjections = await resolvePromptInjectionsForInit(options?.promptInjections);
        await initializeWrappedSeels(seels, connectionStatus, resolvedPromptInjections);
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
