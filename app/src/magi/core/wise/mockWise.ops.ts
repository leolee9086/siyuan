/**
 * @fileoverview MockWISE 外部操作函数（与核心工厂函数解耦）
 * @description 将 创建MockWISE实例 内部的大型操作函数提取到此文件，
 * 以满足单个函数不超过50实际代码行的 lint 限制。
 * 这些函数接收 MockWISE内部状态 对象作为参数，通过引用修改状态。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/mockWise.ops

import { universalStreamRequest } from "../../../util/network/fetchStream";
import { 构建SSE请求配置, 创建SSE桥接回调 } from "./mockWise";
import type {
    MockWISE内部状态,
    MockWISE完整配置,
    SSE桥接状态,
} from "./wise.types";
import type {
    MockMessage,
    ContextMessage,
    ReplyOptions,
    VoteForResult,
} from "../core.types";

const PLACEHOLDER_ENDPOINT = "api.your-ai-service.com";

/**
 * 提取连接失败响应中的详细错误文本
 *
 * 作用：优先读取 JSON 错误对象，其次回退到文本响应。
 * 意图：把后端返回的真实错误透传到 UI，避免只看到泛化失败文案。
 * 调用时机：执行连接操作遇到 `response.ok === false` 时调用。
 */
const 提取错误响应文本 = async (response: Response): Promise<string> => {
    try {
        const data: unknown = await response.json();
        // 仅在 JSON 解析结果是对象时，才允许按字段读取错误信息，避免对 null/原始值做属性访问。
        if (!data || typeof data !== "object") {
            return `HTTP ${response.status}`;
        }

        const errorObj = Reflect.get(data, "error");
        // 后端常将错误包装为 { error: { message } }，这里先读取嵌套 message 以保留最精确报错。
        const nestedMessage =
            errorObj && typeof errorObj === "object"
                ? Reflect.get(errorObj, "message")
                : null;
        if (typeof nestedMessage === "string") {
            return nestedMessage;
        }

        const message = Reflect.get(data, "message");
        if (typeof message === "string") {
            return message;
        }
    } catch {
        // 非 JSON 响应时继续尝试读取 text
    }

    try {
        const text = await response.text();
        return text.trim() || `HTTP ${response.status}`;
    } catch {
        return `HTTP ${response.status}`;
    }
};

// ────────────────────────────────────────────────────────────────────────────
// SSE 桥接状态操作辅助（顶层函数，避免在 generator 内定义命名函数）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 创建SSE桥接通知函数
 *
 * 作用：创建一个通知函数，调用时如果有等待的 resolve 则立即解除阻塞
 * 意图：将 generator 内的通知逻辑提取到顶层，避免在 generator 内定义命名函数
 * 调用时机：仅在 创建流式响应Generator 内调用一次，创建后通过闭包持有桥接状态
 */
const 创建通知函数 = (桥接状态: SSE桥接状态): () => void =>
    () => {
        // 若有 generator 等待新数据的 Promise，立即 resolve 唤醒
        if (桥接状态.通知resolve) {
            桥接状态.通知resolve();
            桥接状态.通知resolve = null;
        }
    };


// ────────────────────────────────────────────────────────────────────────────
// SSE 流式响应（需要外部化以减少工厂函数体积）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 消费SSE桥接缓冲直到流结束
 *
 * 作用：从桥接状态的缓冲队列中取出数据 yield 给调用方
 * 意图：将桥接状态的读取逻辑从 StreamResponse generator 主循环中提取，减少函数复杂度
 * 调用时机：在 创建流式响应Generator 的 while 循环内每次迭代调用
 */
export async function* 消费SSE桥接缓冲(
    状态: SSE桥接状态,
    等待数据: () => Promise<void>,
    abortController: AbortController
): AsyncGenerator<string> {
    while (!状态.流已完成 || 状态.缓冲队列.length > 0) {
        // 缓冲为空且流未完成时挂起，等待新数据事件唤醒
        if (状态.缓冲队列.length === 0 && !状态.流已完成 && !状态.流错误) {
            await 等待数据();
        }
        // 如果流发生错误，终止 generator 并向上层抛出
        if (状态.流错误) {
            abortController.abort();
            const 当前错误 = 状态.流错误;
            const 错误行 = `data: ${JSON.stringify({
                error: { code: "STREAM_ERROR", message: 当前错误.message },
            })}\n\n`;
            yield 错误行;
            throw 当前错误;
        }
        while (状态.缓冲队列.length > 0) {
            const 首条 = 状态.缓冲队列.shift();
            // shift() 在数组非空时必然有値，但 TypeScript 推断为 T|undefined，正式判断后再 yield
            if (首条 !== undefined) {
                yield 首条;
            }
        }
    }
}

/**
 * 创建流式响应 AsyncGenerator
 *
 * 作用：调用 universalStreamRequest 发起OpenAI SSE请求，将回调事件桥接为AsyncGenerator
 * 意图：让调用方可以 for await...of 消费SSE流，与普通 async generator 保持一致的使用方式
 * 调用时机：在 reply（SSE模式）或外部直接调用 streamResponse 时触发
 */
export async function* 创建流式响应Generator(
    _prompt: string,
    systemPromptForChat: string | null,
    context: ContextMessage[],
    config: MockWISE完整配置,
    contextMessages: ContextMessage[],
    toolOptions?: Pick<ReplyOptions, "tools" | "toolChoice">,
): AsyncGenerator<string> {
    const abortController = new AbortController();
    const 桥接状态: SSE桥接状态 = {
        缓冲队列: [],
        流已完成: false,
        流错误: null,
        累积响应内容: "",
        通知resolve: null,
    };

    const 通知有新数据 = 创建通知函数(桥接状态);
    const 请求配置 = await 构建SSE请求配置(
        config.openAIConfig,
        context,
        systemPromptForChat ?? config.systemPromptForChat,
        abortController.signal,
        toolOptions,
    );

    const 回调 = await 创建SSE桥接回调(桥接状态, 通知有新数据);

    universalStreamRequest(请求配置, 回调).catch((err: Error) => {
        桥接状态.流错误 = err;
        通知有新数据();
    });

    yield* 消费SSE桥接缓冲(桥接状态, () => new Promise<void>((resolve) => {
        桥接状态.通知resolve = resolve;
    }), abortController);

    contextMessages.push({
        role: "assistant",
        content: 桥接状态.累积响应内容,
        timestamp: Date.now(),
    });
}

// ────────────────────────────────────────────────────────────────────────────
// 投票操作（外部化）
// ────────────────────────────────────────────────────────────────────────────

/** 随机生成二元投票结果 */
const 生成二元表决 = (): "批准" | "否决" =>
    (Math.random() > 0.5 ? "批准" : "否决");

/** 计算是否通过（>= 2/3 批准） */
const 计算通过状态 = (votes: Array<"批准" | "否决">): boolean =>
    votes.filter((vote) => vote === "批准").length >= 2;

/**
 * 执行投票操作
 *
 * 作用：对给定的响应字符串列表进行模拟评分，模拟贤人审议过程
 * 意图：为MAGI共识机制提供投票数据，支持多方案比较
 * 调用时机：由 MagiSystem 在多贤人并行响应后调用
 *
 * @param 内部状态 - 实例内部可变状态（messages 会被更新）
 * @param configName - 实例名称（用于提取贤人名）
 * @param responses - 待评估的响应字符串数组
 */
export const 执行投票操作 = async (
    内部状态: MockWISE内部状态,
    _configName: string,
    proposedAction: string
): Promise<VoteForResult> => {
    if (typeof proposedAction !== "string") {
        throw new Error("无效的投票输入");
    }
    if (!proposedAction.trim()) {
        return {
            error: true,
            message: "无可评估行动",
            melchior: "否决",
            balthazar: "否决",
            casper: "否决",
            passed: false,
            round: 1,
        };
    }
    const 投票消息: MockMessage = {
        type: "vote",
        status: "loading",
        timestamp: Date.now(),
        meta: {
            type: "binary-vote",
            action: proposedAction,
        },
    };
    内部状态.messages.push(投票消息);
    // 模拟贤人审议延迟（用户感知延迟，模拟真实审议体验）：无法用确定性信号替代
    await new Promise<void>((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 500)
    );
    投票消息.status = "success";
    const melchior = 生成二元表决();
    const balthazar = 生成二元表决();
    const casper = 生成二元表决();
    const passed = 计算通过状态([melchior, balthazar, casper]);
    return {
        melchior,
        balthazar,
        casper,
        passed,
        round: 1,
    };
};

/**
 * 执行回复操作
 *
 * 作用：接受用户输入，管理上下文，根据 responseType 选择 SSE 或普通模式回复
 * 意图：统一 SSE 和非 SSE 两种响应模式的入口，管理对话记忆
 * 调用时机：由 UI 层（Vue composable 或直接测试）发起对话时调用
 *
 * @param 内部状态 - 实例内部可变状态（loading/messages/contextMessages 会被更新）
 * @param userInput - 用户输入内容
 */
export const 执行回复操作 = async (
    内部状态: MockWISE内部状态,
    userInput: string,
    options?: ReplyOptions,
): Promise<string | AsyncGenerator<string>> => {
    内部状态.loading = true;
    try {
        内部状态.contextMessages.push({
            role: "user",
            content: userInput,
            timestamp: Date.now(),
        });
        内部状态.messages = [{ type: "user", content: userInput, timestamp: Date.now() }];
        const overrideMessages = options?.context?.overrideMessages;
        const hasOverrideMessages = Array.isArray(overrideMessages) && overrideMessages.length > 0;
        // 当调用方显式提供角色编排后的消息序列时（如 Trinity 角色 hack），优先使用覆盖上下文。
        const context = hasOverrideMessages ? overrideMessages : 内部状态.contextMessages.slice(-内部状态.config.memorySize);
        // SSE 模式返回 AsyncGenerator，调用方通过 for await 消费
        if (内部状态.config.responseType === "sse") {
            return 创建流式响应Generator(userInput, null, context, 内部状态.config, 内部状态.contextMessages, {
                ...(Array.isArray(options?.tools) ? { tools: options?.tools } : {}),
                ...(options?.toolChoice ? { toolChoice: options.toolChoice } : {}),
            });
        }
        const 响应内容 = "[非SSE模式响应]";
        内部状态.contextMessages.push({
            role: "assistant",
            content: 响应内容,
            timestamp: Date.now(),
        });
        内部状态.messages.push({
            type: "ai",
            content: 响应内容,
            status: "success",
            timestamp: Date.now(),
        });
        return 响应内容;
    } finally {
        内部状态.loading = false;
    }
};

/**
 * 执行连接操作（前端实现版）
 *
 * 作用：初始化 WISE 前端连接状态
 * 意图：向已配置的大模型服务端发送一个极简的探测请求验证连通性
 * 调用时机：由 initMagi 的 autoConnect 选项或 UI 层手动触发
 * @AIDONE 执行连接已改为真实的后端探路请求
 */
export const 执行连接操作 = async (
    内部状态: MockWISE内部状态,
    name: string
): Promise<{ status: string; message: string }> => {
    内部状态.loading = true;
    try {
        const { openAIConfig } = 内部状态.config;
        const normalizedBaseURL = String(openAIConfig.base_url ?? "").trim();
        const normalizedApiKey = String(openAIConfig.apiKey ?? "").trim();

        if (!normalizedBaseURL) {
            throw new Error("AI 接口地址为空，请先在 AI 设置中 Provider 的 Base URL");
        }
        if (normalizedBaseURL.includes(PLACEHOLDER_ENDPOINT)) {
            throw new Error(`检测到占位符接口地址: ${normalizedBaseURL}，请改为后端真实配置`);
        }
        if (!normalizedApiKey) {
            throw new Error("AI API Key 为空，请先在 AI 设置中配置 Provider 的 API Key");
        }

        const testUrl = `${normalizedBaseURL.replace(/\/$/, "")}/chat/completions`;

        // 探测请求：max_tokens 设为极小值以快速响应
        const response = await fetch(testUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${normalizedApiKey}`,
            },
            body: JSON.stringify({
                model: openAIConfig.model,
                messages: [{ role: "user", content: "ping" }],
                max_tokens: 1,
            }),
        });

        if (!response.ok) {
            const detail = await 提取错误响应文本(response);
            throw new Error(`HTTP ${response.status} (${testUrl}) | ${detail}`);
        }

        内部状态.connected = true;
        return { status: "ok", message: `${name} 神经连接已建立` };
    } catch (e) {
        内部状态.connected = false;
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`${name} 连接失败: ${msg}`);
    } finally {
        内部状态.loading = false;
    }
};
