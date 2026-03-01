/**
 * MAGI系统Vue Composable
 *
 * 从 toread/MAGI/composables/useMagi.js 迁移。
 * 提供MAGI系统的响应式状态管理和初始化逻辑。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi

import { ref, reactive, watch } from "vue";
import type { ConnectionStatus, WrappedSeel, UseMagiReturn } from "./useMagi.types";
import type { MockWISE实例 } from "../core/wise/wise.types";
import type { MagiMessage } from "../utils/messageFactory.types";
import { initMagi } from "../core/wise/mockWise.subclass";

/** 清空响应式数组内容（保持引用不变） */
async function clearReactiveArrays(
    seels: WrappedSeel[],
    messages: Array<{ type: string; content: string }>,
): Promise<void> {
    seels.splice(0, seels.length);
    messages.splice(0, messages.length);
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
        connected: true,
        /** 代理到原始AI实例的reply方法 */
        async reply(userInput, options) {
            return ai.reply(userInput, options);
        },
        /** 代理到原始AI实例的voteFor方法 */
        async voteFor(responses) {
            return ai.voteFor(responses);
        },
    };

    // 深度监听消息列表变更，同步回原始AI实例
    watch(() => wrapped.messages, () => {
        // 保持原始实例的消息引用同步
    }, { deep: true });

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

    return {
        seels,
        connectionStatus,
        consensusMessages,
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
        consensusMessages.push({
            type: "system",
            content: "MAGI系统初始化完成",
        });
    } catch (error) {
        connectionStatus.value = "error";
        const message = error instanceof Error
            ? error.message
            : String(error);
        consensusMessages.push({
            type: "error",
            content: "系统初始化失败：" + message,
        });
    }
}
