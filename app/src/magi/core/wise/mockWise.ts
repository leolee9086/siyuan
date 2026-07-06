/**
 * @fileoverview MockWISE 核心工厂函数及SSE工具函数
 * @description 基于SSE流式通信的WISE模拟实现核心层。
 * 从 toread/MAGI/core/mockMagi.js 迁移，SSE通信使用已有的 universalStreamRequest。
 * 子类（Melchior/Balthazar/Casper/Trinity）见 mockWise.subclass.ts。
 * 大型操作函数（流式响应/投票/回复/连接）见 mockWise.ops.ts。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/mockWise
import { getSafeSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { StreamCallbacks, StreamRequestConfig } from "../../../util/network/types";
import { 是AI响应Chunk } from "./wise.guard";
import { 提取桥接Chunk数据, 构建桥接SSE行, 执行追加上下文消息, 执行替换最近Assistant上下文消息 } from "./mockWise.streamBridge";
import type { MockWISEConfig, ContextMessage, OpenAICompatConfig, ReplyOptions } from "../core.types";
import type { MockWISE完整配置, MockWISE实例, SSE桥接状态, MockWISE内部状态 } from "./wise.types";
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
): Promise<MockWISE完整配置> => {
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
// SSE 桥接工具函数（供 mockWise.ops.ts 和子类使用）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 构建OpenAI格式的SSE流式请求配置
 *
 * 作用：将 MockWISE 配置和上下文转换为 universalStreamRequest 可接受的配置对象
 * 意图：集中管理 OpenAI SSE 请求的构建逻辑，与请求发送解耦
 * 调用时机：在 mockWise.ops.ts 的 创建流式响应Generator 中调用
 */
export const 构建SSE请求配置 = async (
    openAIConfig: OpenAICompatConfig,
    messages: ContextMessage[],
    systemPrompt: string,
    abortSignal: AbortSignal,
    toolOptions?: {
        tools?: ReplyOptions["tools"];
        toolChoice?: ReplyOptions["toolChoice"];
    },
): Promise<StreamRequestConfig> => ({
    url: `${openAIConfig.base_url.replace(/\/$/, "")}/chat/completions`,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openAIConfig.apiKey}`,
    },
    body: JSON.stringify({
        model: openAIConfig.model,
        temperature: openAIConfig.temperature,
        max_tokens: openAIConfig.max_tokens,
        stream: true,
        messages: [
            { role: "system", content: systemPrompt },
            ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        ...(Array.isArray(toolOptions?.tools) && toolOptions.tools.length > 0
            ? { tools: toolOptions.tools }
            : {}),
        ...(toolOptions?.toolChoice ? { tool_choice: toolOptions.toolChoice } : {}),
    }),
    signal: abortSignal,
    timeout: 30000,
});

/**
 * 处理SSE消息数据并写入桥接状态
 *
 * 作用：解析 onMessage 收到的 dataStr，提取内容片段写入缓冲队列
 * 意图：提取 onMessage 逻辑以减少内联回调体积，同时替代 as 断言
 * 调用时机：仅在 创建SSE桥接回调 的 onMessage 中调用
 */
const 处理SSE消息数据 = (
    dataStr: string,
    状态: SSE桥接状态,
    通知有新数据: () => void
): void => {
    // 解析 dataStr 并做结构检查，安全提取内容片段
    const parsed: unknown = JSON.parse(dataStr);
    if (!是AI响应Chunk(parsed)) {
        return;
    }
    if (parsed.error) {
        状态.流错误 = new Error(parsed.error.message);
        通知有新数据();
        return;
    }
    const 首个选择 = parsed.choices?.[0];
    // choices 为空时说明当前 chunk 不含有效增量，直接跳过。
    if (!首个选择) {
        return;
    }
    const bridgedChoice = 提取桥接Chunk数据(首个选择);
    // 无内容、无工具调用且无显式 finish_reason 时视为心跳包，不写入缓冲。
    if (!bridgedChoice.hasPayload) {
        return;
    }
    // 仅把可见文本片段累积到上下文记忆，工具参数解析由上层流处理器完成。
    if (bridgedChoice.content) {
        状态.累积响应内容 += bridgedChoice.content;
    }
    const SSE行 = 构建桥接SSE行(
        { id: parsed.id, created: parsed.created, model: parsed.model },
        bridgedChoice,
    );
    状态.缓冲队列.push(SSE行);
    通知有新数据();
};

/**
 * 创建SSE桥接回调（将 universalStreamRequest 的回调桥接到 AsyncGenerator 状态）
 *
 * 作用：将 universalStreamRequest 的事件回调与 AsyncGenerator 的内部状态关联
 * 意图：实现"回调模式→AsyncGenerator"的桥接，让调用方可以 for await 消费SSE流
 * 调用时机：在 mockWise.ops.ts 的 创建流式响应Generator 中调用
 *
 * @param 状态 - 桥接状态对象（由 generator 闭包持有）
 * @param 通知有新数据 - 每次状态变更后调用，唤醒等待中的 generator
 */
export const 创建SSE桥接回调 = async (
    状态: SSE桥接状态,
    通知有新数据: () => void
): Promise<StreamCallbacks> => ({
    /**
     * onMessage——接收单条SSE数据并写入桥接缓冲队列
     * 调用时机：由 universalStreamRequest 每收到一个完整SSE数据行时触发
     */
    onMessage(dataStr: string) {
        try {
            处理SSE消息数据(dataStr, 状态, 通知有新数据);
        } catch {
            // 忽略无法解析的chunk（如心跳包或非JSON行）
        }
    },
    /**
     * onDone——SSE流正常结束信号
     * 调用时机：收到 [DONE] 事件或连接正常关闭时由 universalStreamRequest 触发
     */
    onDone() {
        状态.流已完成 = true;
        通知有新数据();
    },
    /**
     * onError——SSE流异常信号
     * 调用时机：网络错误或服务端主动断连时由 universalStreamRequest 触发
     */
    onError(error: Error) {
        状态.流错误 = error;
        通知有新数据();
    },
});

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
): Promise<MockWISE实例> => {
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

// @AIDONE 已删除非法的值转发导出（universalStreamRequest）
// 类型已在 wise.types.ts 中定义，无需在此重复导出
