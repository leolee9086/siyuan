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

/** 清空响应式数组内容（保持引用不变） */
async function clearReactiveArrays(
    seels: WrappedSeel[],
    messages: Array<{ type: string; content: string }>,
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
        // @内联回调
        for await (const chunk of stream) {
            await syncWrappedSeelState(wrapped, ai);
            yield chunk;
        }
    } finally {
        await syncWrappedSeelState(wrapped, ai);
    }
}

/** 汇总 reply 结果为完整文本（兼容字符串与流式 AsyncGenerator） */
async function collectReplyContent(replyResult: string | AsyncGenerator<string>): Promise<string> {
    if (typeof replyResult === "string") {
        return replyResult;
    }

    let content = "";
    for await (const chunk of replyResult) {
        content += chunk;
    }
    return content;
}

/** 单个贤者执行回复并规整为统一结果结构 */
async function replySingleSage(
    seel: WrappedSeel,
    userMessage: string,
): Promise<{ success: boolean; seel: WrappedSeel; content: string }> {
    try {
        const replyResult = await seel.reply(userMessage);
        const content = (await collectReplyContent(replyResult)).trim();
        return {
            success: true,
            seel,
            content,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            seel,
            content: message,
        };
    }
}

/**
 * 将三贤者回复结果写入共识消息流
 *
 * 作用：把并行回复结果转换为主消息区可渲染的消息项
 * 意图：集中管理成功/失败分支，避免主链路重复判断
 * 调用时机：sendUserMessageInternal 完成并行 reply 后调用
 */
async function appendSageReplyMessages(
    consensusMessages: Array<{ type: string; content: string }>,
    replyResults: Array<{ success: boolean; seel: WrappedSeel; content: string }>,
): Promise<void> {
    for (const result of replyResults) {
        // 仅当贤者实际返回可展示文本时，才追加到消息流，避免空气泡污染主面板。
        if (result.success && result.content) {
            consensusMessages.push({
                type: "consensus",
                content: `${result.seel.config.displayName}: ${result.content}`,
            });
            continue;
        }

        // 失败分支统一落为 error 消息，便于面板上直接定位具体失败贤者。
        if (!result.success) {
            consensusMessages.push({
                type: "error",
                content: `${result.seel.config.displayName} 响应失败: ${result.content}`,
            });
        }
    }
}

/**
 * 用户对话基础链路（T2.1）
 *
 * 作用：接收输入并触发三贤者并行回复，再把结果回写到共识消息流
 * 意图：先恢复最小可用对话闭环，不引入 Trinity/投票链路（留给 T2.2）
 * 调用时机：输入栏 submit 事件映射到 useMagi.sendUserMessage 时调用
 */
async function sendUserMessageInternal(
    text: string,
    connectionStatus: { value: ConnectionStatus },
    consensusMessages: Array<{ type: string; content: string }>,
    seels: WrappedSeel[],
): Promise<void> {
    const userMessage = text.trim();
    if (!userMessage || connectionStatus.value !== "connected") {
        return;
    }

    consensusMessages.push({
        type: "user",
        content: userMessage,
    });

    const sages = seels.filter((seel) => seel.config.name !== "TRINITY-00");
    const replyResults = await Promise.all(
        sages.map((seel) => replySingleSage(seel, userMessage)),
    );
    await appendSageReplyMessages(consensusMessages, replyResults);
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
        /** 代理到原始AI实例的reply方法，并同步状态到UI */
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
        /** 代理到原始AI实例的voteFor方法，并同步状态到UI */
        async voteFor(responses) {
            const result = await ai.voteFor(responses);
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
    const consensusMessages: Array<{ type: string; content: string }> = reactive([]);
    const isAnySeelLoading = computed(() => seels.some((seel) => seel.loading));

    await initializeWrappedSeels(seels, connectionStatus);

    return {
        seels,
        connectionStatus,
        consensusMessages,
        isAnySeelLoading,
        /**
         * 发送用户输入并触发三贤者基础回复链路
         *
         * 作用：把 UI 输入文本接入 sendUserMessageInternal
         * 意图：在不暴露内部状态参数的前提下，提供最小可调用接口给面板层
         * 调用时机：MagiMainPanel 的 submit-input 事件上抛到容器后调用
         */
        sendUserMessage: (text: string) => sendUserMessageInternal(
            text,
            connectionStatus,
            consensusMessages,
            seels,
        ),
        /** 重新初始化MAGI系统（清空现有实例后重建） */
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
    consensusMessages: Array<{ type: string; content: string }>,
): Promise<void> {
    try {
        connectionStatus.value = "connecting";
        await clearReactiveArrays(seels, consensusMessages);

        await initializeWrappedSeels(seels, connectionStatus);
        consensusMessages.push({
            type: "system",
            content: getMagiI18nText("systemInitCompleted"),
        });
    } catch (error) {
        connectionStatus.value = "error";
        const message = error instanceof Error
            ? error.message
            : String(error);
        consensusMessages.push({
            type: "error",
            content: `${getMagiI18nText("systemInitFailedPrefix")}: ${message}`,
        });
    }
}
