/**
 * @fileoverview MockWISE 核心工厂函数及SSE工具函数
 * @description 基于SSE流式通信的WISE模拟实现核心层。
 * 从 toread/MAGI/core/mockMagi.js 迁移，SSE通信使用已有的 universalStreamRequest。
 * 子类（Melchior/Balthazar/Casper/Trinity）见 mockWise.subclass.ts。
 * 大型操作函数（流式响应/投票/回复/连接）见 mockWise.ops.ts。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/mockWise
import { getSafeSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { 执行追加上下文消息, 执行替换最近Assistant上下文消息 } from "./mockWise.streamBridge";
import type { MockWISEConfig, OpenAICompatConfig } from "../core.types";
import type { MockWISE完整配置, MockWISE实例, MockWISE内部状态 } from "./wise.types";
import {
    执行投票操作,
    执行回复操作,
    执行连接操作,
    创建流式响应Generator,
} from "./mockWise.ops";

// ────────────────────────────────────────────────────────────────────────────
// 配置工具函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 合并MockWISE配置（深层合并 sseConfig/openAIConfig）
 *
 * 作用：将子类预设配置和用户覆盖配置合并为完整配置
 * 意图：保证所有配置字段有默认值，避免运行时 undefined
 * 调用时机：在 创建MockWISE实例 内最先调用
 */
export const 合并MockWISE配置 = async (
    基础默认: MockWISEConfig,
    用户输入: MockWISEConfig
) => {
    // 从 ai.providers 读取 Agent 所用模型的提供商配置
    const aiConf = getSafeSiyuanConfig()?.ai;
    const agentModelId = aiConf?.agent?.modelId;
    const agentProvider = aiConf?.providers?.find((p) => p.models?.some((m) => m.id === agentModelId));
    const agentModel = agentProvider?.models?.find((m) => m.id === agentModelId);
    const globalAI = agentProvider && agentModel ? {
        apiKey: agentProvider.apiKey,
        apiModel: agentModel.name,
        apiBaseURL: agentProvider.baseURL,
        apiTemperature: aiConf?.agent?.temperature ?? 0.7,
        apiMaxTokens: aiConf?.agent?.maxCompletionTokens ?? 500,
    } : undefined;

    // 基础默认和用户输入合并出的初始配置
    const userOpenAI = {
        ...(基础默认.openAIConfig ?? {}),
        ...(用户输入.openAIConfig ?? {}),
    };

    // 完整的 openAIConfig 对象（按优先级：用户输入 > 预设 > 全局配置 > 硬编码后备）
    const finalOpenAIConfig: OpenAICompatConfig = {
        apiKey: userOpenAI.apiKey ?? globalAI?.apiKey ?? "",
        model: userOpenAI.model ?? globalAI?.apiModel ?? "gpt-4",
        base_url: userOpenAI.base_url ?? globalAI?.apiBaseURL ?? "",
        temperature: userOpenAI.temperature ?? globalAI?.apiTemperature ?? 0.7,
        max_tokens: userOpenAI.max_tokens ?? globalAI?.apiMaxTokens ?? 500,
    };

    const merged: MockWISE完整配置 = {
        magiInstanceName: "zhi",
        name: "",
        displayName: "",
        color: "",
        icon: "",
        responseType: "mock",
        persona: "UNKNOWN",
        systemPromptForChat: "你是一个AI助手",
        memorySize: 7,
        ...基础默认,
        ...用户输入,
        sseConfig: {
            eventTypes: ["init", "chunk", "complete"],
            chunkInterval: 300,
            ...(基础默认.sseConfig ?? {}),
            ...(用户输入.sseConfig ?? {}),
        },
        openAIConfig: finalOpenAIConfig,
    };
    merged.sseConfig.chunkInterval = Math.max(50, merged.sseConfig.chunkInterval ?? 300);
    return merged;
};

// ────────────────────────────────────────────────────────────────────────────
// MockWISE 实例公共方法构建函数（外部化，减少工厂函数实际代码行）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构建MockWISE实例公共方法对象
 *
 * 作用：将 创建MockWISE实例 中所有实例方法的定义提取到此函数
 * 意图：将工厂函数分拆，使 创建MockWISE实例 的实际代码行不超过50行
 * 调用时机：仅在 创建MockWISE实例 内部调用，传入内部状态对象
 */
const 构建实例方法 = (内部状态: MockWISE内部状态): Omit<MockWISE实例, "loading" | "connected" | "messages" | "config" | "responseDelay"> => ({
    /**
     * connect——初始化前端连接状态
     * 作用：向目标服务端发送短连接验证，成功则连接状态置为 true
     * 调用时机：由 initMagi 的 autoConnect 选项或 UI 层手动触发
     * //@AIDONE 已通过真实接口探测修复无意义延迟模拟
     */
    async connect() {
        return 执行连接操作(内部状态, 内部状态.config.name);
    },

    /**
     * getContextMessages——获取受 memorySize 限制的上下文消息列表
     * 作用：返回最近 memorySize 条消息，供API调用使用
     * 调用时机：由 streamResponse/reply 或外部调用方在请求前调用
     */
    getContextMessages() {
        return 内部状态.contextMessages.slice(-内部状态.config.memorySize);
    },

    /**
     * streamResponse——创建流式响应AsyncGenerator
     * 作用：发起OpenAI SSE请求，将响应以 AsyncGenerator 形式暴露给调用方
     * 调用时机：由 reply（SSE模式）或外部直接调用时触发
     */
    streamResponse(prompt, systemPromptForChat, context = []) {
        return 创建流式响应Generator(
            prompt, systemPromptForChat, context, 内部状态.config, 内部状态.contextMessages
        );
    },

    /**
     * reply——统一回复入口（SSE模式返回AsyncGenerator，否则返回字符串）
     * 作用：管理对话上下文，根据 responseType 选择流式或普通回复模式
     * 调用时机：由 UI 层（Vue composable 或直接测试）发起对话时调用
     */
    async reply(userInput: string, options) {
        return 执行回复操作(内部状态, userInput, options);
    },

    /**
     * voteFor——对拟议行动执行模拟二元表决
     * 作用：模拟贤人审议过程，为 MAGI 共识机制提供批准/否决结果
     * 调用时机：由共识流程在 Critical Decision 模式下调用
     */
    async voteFor(proposedAction: string) {
        return 执行投票操作(内部状态, 内部状态.config.name, proposedAction);
    },

    /**
     * updateConfig——同步更新实例配置
     * 作用：深层合并新配置到内部状态，保证嵌套字段（sseConfig/openAIConfig）不被整体覆盖
     * @同步豁免: 性能考虑 - 配置更新必须同步以保证后续操作立即生效
     */
    updateConfig(newConfig) {
        内部状态.config = {
            ...内部状态.config,
            ...newConfig,
            sseConfig: {
                ...内部状态.config.sseConfig,
                ...(newConfig.sseConfig ?? {}),
            },
            openAIConfig: {
                ...内部状态.config.openAIConfig,
                ...(newConfig.openAIConfig ?? {}),
            },
        };
    },
    /** @同步豁免: 性能考虑 - 仅内存数组追加，无异步依赖。 */
    appendContextMessages(messages) {
        执行追加上下文消息(内部状态, messages);
    },
    /** @同步豁免: 性能考虑 - 仅内存数组尾向扫描与单点替换，无异步依赖。 */
    replaceLatestAssistantContextMessage(content) {
        执行替换最近Assistant上下文消息(内部状态, content);
    },
});

// ────────────────────────────────────────────────────────────────────────────
// MockWISE 核心工厂函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建MockWISE实例
 *
 * 作用：实现基于SSE的MAGI贤人模拟通信核心，支持流式响应/投票/记忆管理
 * 意图：作为四个贤人子类（Melchior/Balthazar/Casper/Trinity）的公共基础层。
 *   通过工厂函数+闭包替代 class MockWISE（lint禁止继承）。
 *   所有大型操作委托给 mockWise.ops.ts 中的外部函数
 * 调用时机：由 mockWise.subclass.ts 中的各子类工厂函数调用
 *
 * @param 预设配置 - 子类预设的固定配置（名称/颜色/openAIConfig等）
 * @param 用户配置 - 用户传入的运行时覆盖配置
 */
export const 创建MockWISE实例 = async (
    预设配置: MockWISEConfig,
    用户配置: MockWISEConfig = {}
)=> {
    const _config: MockWISE完整配置 = await 合并MockWISE配置(预设配置, 用户配置);

    const 内部状态: MockWISE内部状态 = {
        config: _config,
        loading: false,
        connected: false,
        messages: [],
        contextMessages: [],
    };

    return {
        /** @同步豁免: 性能考虑 - getter必须同步以供UI即时读取 */
        get loading() {
            return 内部状态.loading;
        },
        /** @同步豁免: 性能考虑 - getter必须同步以供UI即时读取 */
        get connected() {
            return 内部状态.connected;
        },
        /** @同步豁免: 性能考虑 - getter必须同步以供UI即时读取 */
        get messages() {
            return 内部状态.messages;
        },
        /** @同步豁免: 性能考虑 - getter必须同步以供UI即时读取 */
        get config() {
            return 内部状态.config;
        },
        responseDelay: 500,
        ...构建实例方法(内部状态),
    };
};
