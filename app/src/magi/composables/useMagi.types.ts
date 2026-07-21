/**
 * useMagi composable 类型定义
 *
 * 为MAGI系统Vue composable提供类型约束。
 */

// [TASK] T2.2 迁移composables和工具函数 - useMagi.types

import type { Ref } from "vue";
import type { MagiMessage, VoteResult } from "../utils/messageFactory.types";
import type { MockWISE实例, MagiPromptSet } from "../core/wise/wise.types";
import type { ContextMessage, ReplyOptions } from "../core/core.types";

/**
 * 连接状态
 *
 * 用途：标识MAGI系统当前的连接状态
 * 使用场景：UI层根据状态显示连接指示器、禁用/启用输入框
 */
export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

/** MAGI 全局运行态。 */
export interface MagiRuntimeStatus {
    state: "sleeping" | "heartbeat" | "external";
    awake: boolean;
    wakeSource?: string;
    reason?: string;
    dominantSeel?: string;
    dominantStance?: string;
    dominantUpdatedAt?: number;
    currentRoundId?: string;
    currentTask?: string;
    lastHeartbeatAt?: number;
    lastWakeAt?: number;
    lastSleepAt?: number;
    lastSleepSummary?: string;
    updatedAt?: number;
}

/** MAGI 会话导出模式 */
export type MagiSessionExportMode = "raw" | "sanitized";

/** MAGI 导出轮次中的贤者响应 */
export interface MagiSessionExportSageResponse {
    seel: string;
    displayName: string;
    content: string;
    requiresDeliberation?: boolean;
    timestamp: number;
}

/** MAGI 导出轮次中的投票状态节点 */
export interface MagiSessionExportVoteStatus {
    progress: number;
    details: Array<{ name: string; decision: string }>;
    proposedAction?: string;
    timestamp: number;
    deliberationInitiator?: string;
    deliberationReason?: string;
}

/** MAGI 导出轮次 */
export interface MagiSessionExportRound {
    roundId: string;
    startedAt: number;
    endedAt: number;
    durationMs: number;
    userInput: string;
    sageResponses: MagiSessionExportSageResponse[];
    voteStatuses: MagiSessionExportVoteStatus[];
    finalConsensus: MagiMessage | null;
    errors: MagiMessage[];
    messages: MagiMessage[];
}

/** MAGI 人格重载事件 */
export interface MagiSessionExportPersonaReloadEvent {
    status: "loaded" | "failed_load" | "failed_reload" | "skipped";
    profilePath?: string;
    message: string;
    timestamp: number;
}

/** MAGI 会话导出记录 */
export interface MagiSessionExportRecord {
    schemaVersion: "MAGI-SESSION-EXPORT-v1";
    exportedAt: string;
    mode: MagiSessionExportMode;
    sessionId: string;
    summary: {
        totalMessages: number;
        totalRounds: number;
        totalErrors: number;
        connectionStatus: ConnectionStatus;
    };
    rounds: MagiSessionExportRound[];
    personaReloadEvents: MagiSessionExportPersonaReloadEvent[];
    timeline: MagiMessage[];
    seelLogs: Array<{ seelName: string; displayName: string; messages: MagiMessage[] }>;
}

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
        options?: ReplyOptions,
    ) => Promise<string | AsyncGenerator<string>>;
    /** 对拟议行动进行二元表决 */
    voteFor: (proposedAction: string) => Promise<VoteResult | null>;
    /** 由共识层向该贤者注入外部上下文历史 */
    appendContextMessages: (messages: ContextMessage[]) => Promise<void>;
    /** 由共识层替换该贤者最近 assistant 历史消息 */
    replaceLatestAssistantContextMessage: (content: string) => Promise<void>;
}

/**
 * useMagi composable 返回值
 *
 * 用途：封装MAGI系统的全部响应式状态和操作方法
 * 使用场景：MagiRoot 与监控面板通过解构获取状态和方法
 */
export interface UseMagiReturn {
    /** 所有贤者实例列表（响应式） */
    seels: WrappedSeel[];
    /** 后端可用性状态 */
    connectionStatus: Ref<ConnectionStatus>;
    /** 监控 websocket 连接状态（用于贤者卡片指示） */
    websocketConnectionStatus: Ref<ConnectionStatus>;
    /** 共识消息列表 */
    consensusMessages: MagiMessage[];
    /** 是否存在任一贤者正在响应 */
    isAnySeelLoading: Ref<boolean>;
    /** MAGI 全局运行态 */
    runtimeStatus: Ref<MagiRuntimeStatus | null>;
    /** 初始化MAGI系统 */
    initializeMAGI: (options?: {
        /** 在基础提示词后追加的人格注入文本 */
        promptInjections?: MagiPromptSet;
        /** 是否保留既有共识消息 */
        preserveConsensusMessages?: boolean;
    }) => Promise<void>;
    /** 释放 websocket、事件订阅和响应式运行态。 */
    destroy: () => void;
}

/**
 * useMagi 初始化选项
 *
 * 用途：定义会话初始化时可配置的行为。
 * 使用场景：MagiRoot 初始化 useMagi 时传入。
 */
export interface UseMagiOptions {
    /** 显式覆盖人格注入文本 */
    promptInjections?: MagiPromptSet;
}

/** 来源的可信度等级 */
export type SourceTrustBase = "low" | "medium" | "high";

/** 来源的风险等级 */
export type SourceRiskLevel = "low" | "medium" | "high";

/** 来源消息通道（白名单枚举，禁止任意字符串注入到策略层）。 */
export type SourceMessageChannel = "guardian" | "external-agent" | "system-cron" | "unknown";

/** 单次消息发送的来源上下文 */
export interface SourceSimulationContext {
    requestId: string;
    callerId: string;
    source: "guardian" | "external-agent" | "system-cron" | "unknown";
    trustBase: SourceTrustBase;
    riskLevel: SourceRiskLevel;
    profileId: string;
    profileLabel: string;
    sourceChannel?: SourceMessageChannel;
    sourcePanelId?: string;
    sourcePanelTitle?: string;
}

