/**
 * MAGI系统Vue Composable
 *
 * 从 toread/MAGI/composables/useMagi.js 迁移。
 * 提供MAGI系统的响应式状态管理和初始化逻辑。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi

import { ref, reactive, computed } from "vue";
import type { ConnectionStatus, WrappedSeel, UseMagiReturn } from "./useMagi.types";
import type { MockWISE实例 } from "../core/wise/wise.types";
import type { MockMessage } from "../core/core.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { initMagi } from "../core/wise/mockWise.subclass";
import { getMagiI18nText } from "../utils/magiI18n";
import {
    appendConsensusMessage,
    sendUserMessageWithConsensus,
} from "./useMagi.consensus";

/** 清空响应式数组内容（保持引用不变） */
async function clearReactiveArrays(
    seels: WrappedSeel[],
    messages: MagiMessage[],
): Promise<void> {
    seels.splice(0, seels.length);
    messages.splice(0, messages.length);
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
 * 创建带状态同步的流式结果，确保每个 chunk 都驱动 UI 更新
 *
 * 作用：包装原始 AsyncGenerator，在每次 yield 前后同步 wrapped 状态
 * 意图：消除“底层状态变了但 UI 不刷新”的双轨状态问题
 * 调用时机：wrapped.reply 收到 SSE 流式返回值后立即调用
 */
async function* createSyncedStreamGenerator(
    wrapped: WrappedSeel,
    ai: MockWISE实例,
    stream: AsyncGenerator<string>,
): AsyncGenerator<string> {
    try {
        for await (const chunk of stream) {
            await syncWrappedSeelState(wrapped, ai);
            yield chunk;
        }
    } finally {
        await syncWrappedSeelState(wrapped, ai);
    }
}


/** 初始化并写入 wrapped seels */
async function initializeWrappedSeels(
    seels: WrappedSeel[],
    connectionStatus: { value: ConnectionStatus },
): Promise<void> {
    const rawSeels = await initMagi({
        delay: 800,
        autoConnect: true,
        memorySize: 7,
    });

    const wrappedSeels = await Promise.all(
        rawSeels.map((ai) => wrapSeelInstance(ai)),
    );
    seels.push(...wrappedSeels);
    connectionStatus.value = "connected";
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

            return createSyncedStreamGenerator(wrapped, ai, replyResult);
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
export async function useMagi(): Promise<UseMagiReturn> {
    const seels: WrappedSeel[] = reactive([]);
    const connectionStatus = ref<ConnectionStatus>("disconnected");
    const consensusMessages: MagiMessage[] = reactive([]);
    const isAnySeelLoading = computed(() => seels.some((seel) => seel.loading));

    await initializeWrappedSeels(seels, connectionStatus);

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
        sendUserMessage: (text: string) => sendUserMessageWithConsensus(
            text,
            connectionStatus,
            consensusMessages,
            seels,
        ),
        /**
         * 作用：重新初始化 MAGI 实例并清空消息。
         * 意图：支持连接恢复与状态重建。
         * 调用时机：用户主动触发重连或上层容器请求重置时。
         */
        initializeMAGI: async () => {
            await reinitializeMAGI(seels, connectionStatus, consensusMessages);
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
): Promise<void> {
    try {
        connectionStatus.value = "connecting";
        await clearReactiveArrays(seels, consensusMessages);

        await initializeWrappedSeels(seels, connectionStatus);
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
