/**
 * @fileoverview WISE处理器公共类型定义
 * @description wise目录内所有接口集中于此，供 baseWise/seelWise/mockWise 引用
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/wise.types

import type {
    WISEApi,
    WISEPersona,
    MardukValidatedConfig,
    VoteScore,
    MockWISEConfig,
    MockMessage,
    ContextMessage,
    ReplyOptions,
    VoteForResult,
    OpenAICompatConfig,
    SSEConfig,
} from "../core.types";

// @AIDONE 已删除从 core.types 的非法转发导出，消费者应直接从 core.types 导入所需类型

// ────────────────────────────────────────────────────────────────────────────
// WISE基础类型
// ────────────────────────────────────────────────────────────────────────────

/** WISE事件回调集合 */
export interface WISE事件回调 {
    /** 回复完成后触发 */
    onResponse?: (response: unknown) => void;
    /** JSON解析失败时触发 */
    onParseError?: (error: Error) => void;
    /** 通用错误时触发 */
    onError?: (error: Error) => void;
}

/** WISE基础实例公共方法+可写提示词 */
export interface WISE基础实例 {
    /** 对给定函数列表进行投票评分 */
    voteFor: (
        functions: Array<{ name: string; action: { toString: () => string } }>,
        descriptions: string[],
        inputs: unknown[],
        goal: string
    ) => Promise<VoteScore[]>;
    /** 对用户输入给出回复 */
    reply: (userInput: string) => Promise<unknown>;
    /** 对一段对话进行总结 */
    summarize: (conversation: Array<{ role: string; content: string }>) => Promise<unknown>;
    /** 检查当前同步率是否达标 */
    checkSync: (getSEELConfig: (name: string) => { baseWeight: number }) => {
        status: "synced" | "desynced";
        ratio: number;
        threshold: number;
    };
    /** AI服务接口（供子工厂函数访问） */
    readonly api: WISEApi;
    /** 经Marduk验证的配置（供子工厂函数访问） */
    readonly config: MardukValidatedConfig;
    /** 人格配置（供子工厂函数访问） */
    readonly persona: WISEPersona;
    /** 投票专用提示词（可写，由子工厂函数赋值） */
    votePrompt: string;
    /** 回复专用提示词（可写，由子工厂函数赋值） */
    replyPrompt: string;
    /** 总结专用提示词（可写，由子工厂函数赋值） */
    summarizePrompt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// MockWISE类型
// ────────────────────────────────────────────────────────────────────────────

/** 规范化后的MockWISE完整配置（所有字段必填） */
export interface MockWISE完整配置 {
    magiInstanceName: string;
    name: string;
    displayName: string;
    color: string;
    icon: string;
    responseType: string;
    persona: string;
    sseConfig: SSEConfig;
    openAIConfig: OpenAICompatConfig;
    systemPromptForChat: string;
    memorySize: number;
}

/** SSE chunk 数据格式（OpenAI流式响应） */
export interface AI响应Chunk {
    id?: string;
    object?: string;
    created?: number;
    model?: string;
    error?: { code: string; message: string };
    choices?: Array<{
        delta: { content?: string };
        index: number;
        finish_reason: string | null;
    }>;
}

/** SSE桥接状态（用于 AsyncGenerator 桥接模式） */
export interface SSE桥接状态 {
    /** 待消费的SSE格式字符串队列 */
    缓冲队列: string[];
    /** 流是否已正常完成（收到 [DONE]） */
    流已完成: boolean;
    /** 流错误（若有） */
    流错误: Error | null;
    /** 流结束后累积的完整响应内容 */
    累积响应内容: string;
    /** 数据到达时用于通知 generator 的 resolve 函数 */
    通知resolve: (() => void) | null;
}

/** MockWISE实例完整接口 */
export interface MockWISE实例 {
    /** 当前是否正在加载 */
    readonly loading: boolean;
    /** 当前是否已连接 */
    readonly connected: boolean;
    /** 消息列表 */
    readonly messages: MockMessage[];
    /** 当前配置 */
    readonly config: MockWISE完整配置;
    /** 响应延迟（毫秒） */
    responseDelay: number;
    /** 模拟连接初始化 */
    connect: () => Promise<{ status: string; message: string }>;
    /** 获取用于API调用的上下文消息（受memorySize限制） */
    getContextMessages: () => ContextMessage[];
    /** 流式响应生成器 */
    streamResponse: (
        prompt: string,
        systemPromptForChat: string | null,
        context?: ContextMessage[]
    ) => AsyncGenerator<string>;
    /** 回复用户输入（支持SSE和普通模式） */
    reply: (userInput: string, options?: ReplyOptions) => Promise<string | AsyncGenerator<string>>;
    /** 对拟议行动进行二元表决 */
    voteFor: (proposedAction: string) => Promise<VoteForResult>;
    /** 更新配置 */
    updateConfig: (newConfig: Partial<MockWISEConfig>) => void;
}

// ────────────────────────────────────────────────────────────────────────────
// seelWise 业务数据类型（AI返回的JSON结果类型）
// ────────────────────────────────────────────────────────────────────────────

/** AI 返回的技术可行性评估结果（Melchior专用） */
export interface TechnicalAssessment {
    /** 实现难度（1-5级） */
    difficulty: number;
    /** 所需技术依赖列表 */
    dependencies: string[];
    /** 资源消耗指数（1-10） */
    resourceCost: number;
}

/** AI 模块的标准响应格式（OpenAI-compatible） */
export interface WISEApiResponse {
    choices: Array<{
        message: {
            role: string;
            content: string;
        };
        finish_reason: string | null;
        index: number;
    }>;
    id?: string;
    model?: string;
    created?: number;
}

/** AI 返回的情感分析结果（Balthazar专用） */
export interface EmotionProfile {
    /** 主要情绪类别（愤怒/快乐/悲伤/惊讶等） */
    emotion: string;
    /** 情绪强度（0-10） */
    intensity: number;
    /** 潜在心理需求列表 */
    needs: string[];
}

/** AI 返回的内容合规性检查结果（Casper专用） */
export interface ComplianceResult {
    /** 是否符合法律法规 */
    legal: boolean;
    /** 是否符合社会道德 */
    ethical: boolean;
    /** 识别出的风险列表 */
    risks: string[];
}

/** 风险矩阵单条（Casper专用） */
export interface RiskMatrixItem {
    /** 发生概率（1-5） */
    probability: number;
    /** 影响程度（1-5） */
    impact: number;
}

// ────────────────────────────────────────────────────────────────────────────
// seelWise 扩展类型（从 seelWise.ts 移入，满足「type 必须在 .types.ts」规则）
// ────────────────────────────────────────────────────────────────────────────

/** Melchior实例扩展类型（在基础WISE能力上增加逻辑分析专项方法） */
export type Melchior实例类型 = WISE基础实例 & {
    voteFor: (
        functions: Array<{ name: string; action: { toString: () => string } }>,
        descriptions: string[],
        inputs: unknown[],
        goal: string
    ) => Promise<VoteScore[]>;
    技术可行性评估: (func: unknown) => Promise<TechnicalAssessment>;
    多方案对比: (solutions: unknown[]) => Promise<TechnicalAssessment[]>;
};

/** Balthazar实例扩展类型（在基础WISE能力上增加情感分析专项方法） */
export type Balthazar实例类型 = WISE基础实例 & {
    reply: (userInput: string) => Promise<unknown>;
    情感分析: (response: WISEApiResponse) => Promise<EmotionProfile>;
    生成共情回应: (情感轮廓: EmotionProfile) => Promise<WISEApiResponse>;
};

/** Casper实例扩展类型（在基础WISE能力上增加合规检查专项方法） */
export type Casper实例类型 = WISE基础实例 & {
    summarize: (conversation: Array<{ role: string; content: string }>) => Promise<unknown>;
    合规性检查: (input: unknown) => Promise<ComplianceResult>;
    风险矩阵评估: (risks: Array<{ name: string }>) => Promise<RiskMatrixItem[]>;
};

// ────────────────────────────────────────────────────────────────────────────
// MockWISE 内部状态类型（供 mockWise.ts 拆分的外部命名函数使用）
// ────────────────────────────────────────────────────────────────────────────

/** MockWISE实例的内部可变状态（通过闭包持有，传给外部函数以减少工厂函数体积） */
export interface MockWISE内部状态 {
    /** 当前完整配置（可通过 updateConfig 更新） */
    config: MockWISE完整配置;
    /** 当前是否正在加载 */
    loading: boolean;
    /** 当前是否已连接 */
    connected: boolean;
    /** 对话消息（仅当次会话可见的UI消息） */
    messages: MockMessage[];
    /** API上下文消息（含历史，受 memorySize 限制） */
    contextMessages: ContextMessage[];
}

/** initMagi 初始化配置 */
export interface InitMagiOptions {
    /** 自定义系统提示词（各贤人） */
    prompts?: {
        melchior?: string;
        balthazar?: string;
        casper?: string;
        trinity?: string;
    };
    /** 响应延迟（毫秒） */
    delay?: number;
    /** 记忆长度 */
    memorySize?: number;
    /** 覆盖OpenAI配置 */
    openAIConfig?: Partial<OpenAICompatConfig>;
    /** 是否在创建后自动连接 */
    autoConnect?: boolean;
}
