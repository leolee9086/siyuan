import * as dayjs from "dayjs";
import type { MessageHistory } from "../components/streamChat.types";
import { universalStreamRequest } from "../util/network/fetchStream";
import { StreamRequestConfig, OnMessageCallback } from "./requestController.types";
import { AIConfig } from "./types";

/**
 * AI请求控制器实现
 * 负责管理AI请求的生命周期，分离状态管理和请求逻辑
 * 只控制网络请求本身，不介入解析等逻辑
 */
export class AIRequestController {
    private abortController: AbortController | null = null;
    private isDestroyed = false;
    private currentRequestConfig: StreamRequestConfig | null = null;
    private currentRequestId: number = 0;

    constructor(
        private events: {
            onStart?: () => void;
            onMessage?: OnMessageCallback;
            onComplete?: () => void;
            onError?: (error: Error) => void;
            onAbort?: () => void;
            onPause?: () => void;
            onResume?: () => void;
        },
        private getAIConfig: () => AIConfig
    ) { }

    /**
     * 开始AI请求
     */
    async startRequest(messages: MessageHistory): Promise<void> {
        if (this.isDestroyed) {
            throw new Error("控制器已销毁，无法发起请求");
        }

        // 创建新的AbortController，确保每次请求都是全新的
        const newAbortController = new AbortController();

        // 取消之前的请求（使用旧的controller）
        if (this.abortController) {
            this.abortController.abort();
        }

        // 更新为新的controller
        this.abortController = newAbortController;

        // 增加请求ID，用于跟踪当前请求
        this.currentRequestId += 1;
        const currentRequestId = this.currentRequestId;

        try {
            // 触发开始事件
            this.events.onStart?.();

            // 准备请求参数
            const aiConfig = this.getAIConfig();
            this.currentRequestConfig = createStreamRequestConfig(messages, this.abortController.signal, aiConfig);

            // 创建流处理器
            const streamHandlers = createStreamHandlers(
                this.events,
                () => this.isDestroyed || currentRequestId !== this.currentRequestId
            );

            // 发起流式请求
            await universalStreamRequest(this.currentRequestConfig, streamHandlers);

        } catch (error) {
            if (error instanceof Error && error.name !== "AbortError") {
                this.events.onError?.(error);
            }
        }
    }

    /**
     * 取消当前请求
     */
    cancelRequest(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.events.onAbort?.();
        }
    }

    /**
     * 暂停当前请求
     */
    pauseRequest(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.events.onPause?.();
        }
    }

    /**
     * 恢复请求
     */
    async resumeRequest(): Promise<void> {
        this.events.onResume?.();
    }

    /**
     * 获取请求状态
     */
    getRequestState() {
        return {
            isStreaming: this.abortController !== null && !this.abortController.signal.aborted,
            isPaused: false, // 这个状态由外部管理
            isDone: false,  // 这个状态由外部管理
            hasError: false, // 这个状态由外部管理
            errorMessage: "" // 这个状态由外部管理
        };
    }

    /**
     * 销毁控制器，清理资源
     */
    destroy(): void {
        this.isDestroyed = true;
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.currentRequestConfig = null;
    }
}

/**
 * 创建流处理器
 * 
 * 作用：创建包含消息/完成/错误/中断回调的处理器对象
 * 意图：将事件回调封装成统一的处理器对象，以便传递给 universalStreamRequest
 * 调用时机：在 AIRequestController.startRequest 中调用
 * 
 * @param events - 事件回调配置
 * @param isRequestInvalid - 判断请求是否已失效的函数（用于防止过期响应被处理）
 * @returns 流处理器对象
 */
const createStreamHandlers = (
    events: {
        onMessage?: OnMessageCallback;
        onComplete?: () => void;
        onError?: (error: Error) => void;
        onAbort?: () => void;
    },
    isRequestInvalid: () => boolean
) => {
    return {
        /** @简洁函数 消息事件代理，检查请求有效性后转发给外部回调 */
        onMessage: (dataStr: string) => {
            if (isRequestInvalid()) {
                return;
            }
            events.onMessage?.(dataStr, () => {
                const responseContentRef = events.onMessage?.getResponseContentRef?.();
                return responseContentRef?.textContent || "";
            });
        },
        /** @简洁函数 完成事件代理，检查请求有效性后转发给外部回调 */
        onDone: () => {
            if (isRequestInvalid()) {
                return;
            }
            events.onComplete?.();
        },
        /** @简洁函数 错误事件代理，检查请求有效性后转发给外部回调 */
        onError: (error: Error) => {
            if (isRequestInvalid()) {
                return;
            }
            events.onError?.(error);
        },
        /** @简洁函数 中断事件代理，检查请求有效性后转发给外部回调 */
        onAbort: () => {
            if (isRequestInvalid()) {
                return;
            }
            events.onAbort?.();
        }
    };
};

/**
 * 准备请求配置
 * 
 * 作用：将消息历史和AI配置转换为流式请求配置对象
 * 意图：封装请求配置的构建逻辑，使请求控制器专注于请求管理
 * 调用时机：每次发起AI请求时由 AIRequestController.startRequest 调用
 * 
 * @param messages - 消息历史
 * @param signal - 请求中断信号
 * @param aiConfig - AI配置（已由 getAIConfigFromSiyuan 处理过的配置，超时时间已转换为毫秒）
 * @returns 流式请求配置对象
 */
const createStreamRequestConfig = (messages: MessageHistory, signal: AbortSignal, aiConfig: AIConfig): StreamRequestConfig => {
    // 验证配置存在
    if (!aiConfig) {
        throw new Error("未找到思源AI配置，请检查配置文件");
    }

    // 构建消息历史
    const requestMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content + `\n发送时间:${dayjs(msg.timestamp).toDate()}`
    }));

    // 构建请求体
    const requestBody = {
        model: aiConfig.apiModel,
        messages: requestMessages,
        temperature: aiConfig.apiTemperature,
        max_tokens: aiConfig.apiMaxTokens,
        stream: true
    };

    // 构建请求头
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": aiConfig.apiUserAgent,
    };
    headers["Authorization"] = `Bearer ${aiConfig.apiKey}`;


    // 如果有API版本，添加版本头
    if (aiConfig.apiVersion) {
        headers["API-Version"] = aiConfig.apiVersion;
    }

    return {
        url: `${aiConfig.apiBaseURL}/chat/completions`,
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        timeout: aiConfig.apiTimeout,
        signal
    };
};

