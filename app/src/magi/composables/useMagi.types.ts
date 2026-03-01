/**
 * useMagi composable 类型定义
 *
 * 为MAGI系统Vue composable提供类型约束。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi.types

import type { Ref } from "vue";
import type { MagiMessage, SageResponse, VoteResult } from "../utils/messageFactory.types";
import type { MockWISE实例 } from "../core/wise/wise.types";

/**
 * 连接状态
 *
 * 用途：标识MAGI系统当前的连接状态
 * 使用场景：UI层根据状态显示连接指示器、禁用/启用输入框
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * 包装后的SEEL实例（带Vue响应式消息列表）
 *
 * 用途：将MockWISE实例包装为Vue响应式对象，使消息列表变更能触发UI更新
 * 使用场景：SeelPanel组件绑定消息列表、loading状态
 * 关联类型：内部持有 MockWISE实例 引用，对外暴露简化的配置和方法
 */
export interface WrappedSeel {
    /** 原始AI实例引用（内部使用） */
    readonly _originalAI: MockWISE实例;
    /** 贤者配置（只读快照） */
    readonly config: {
        name: string;
        displayName: string;
        color: string;
        icon: string;
        responseType: string;
        persona: string;
        memorySize: number;
        systemPromptForChat?: string;
    };
    /** 响应式消息列表 */
    messages: MagiMessage[];
    /** 是否正在加载 */
    loading: boolean;
    /** 是否已连接 */
    connected: boolean;
    /** 回复用户输入 */
    reply: (
        userInput: string,
        options?: { context?: { responses?: SageResponse[] } },
    ) => Promise<string | AsyncGenerator<string>>;
    /** 投票评分 */
    voteFor: (responses: string[]) => Promise<VoteResult | null>;
}

/**
 * useMagi composable 返回值
 *
 * 用途：封装MAGI系统的全部响应式状态和操作方法
 * 使用场景：MagiMainPanel组件通过解构获取状态和方法
 */
export interface UseMagiReturn {
    /** 所有贤者实例列表（响应式） */
    seels: WrappedSeel[];
    /** 连接状态 */
    connectionStatus: Ref<ConnectionStatus>;
    /** 共识消息列表 */
    consensusMessages: Array<{ type: string; content: string }>;
    /** 初始化MAGI系统 */
    initializeMAGI: () => Promise<void>;
}
