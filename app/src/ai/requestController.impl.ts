import dayjs = require("dayjs");
import type { MessageHistory } from "../components/streamChat.types";
import { universalStreamRequest } from "../util/fetchStream";

/**
 * 流式请求配置接口
 */
interface StreamRequestConfig {
    url: string;
    method: "GET" | "POST" | "PUT" | "DELETE";
    headers: Record<string, string>;
    body: string;
    timeout: number;
    signal: AbortSignal;
}

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
            onMessage?: (content: string, getCurrentContent?: () => string) => void;
            onComplete?: () => void;
            onError?: (error: Error) => void;
            onAbort?: () => void;
            onPause?: () => void;
            onResume?: () => void;
        },
        private getAIConfig: () => any
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
            this.currentRequestConfig = this.prepareRequestConfig(messages, this.abortController.signal);

            // 创建流处理器 - 只传递原始数据给外部处理
            const streamHandlers = {
                onMessage: (dataStr: string) => {
                    // 确保只处理当前请求的事件，一旦停止就不会响应之前请求的事件
                    if (this.isDestroyed || currentRequestId !== this.currentRequestId) return;
                    // 直接传递原始数据，并提供获取当前内容的方法
                    this.events.onMessage?.(dataStr, () => {
                        // 通过UI函数获取当前内容，避免控制器持有状态
                        const responseContentRef = this.events.onMessage &&
                            (this.events.onMessage as any).getResponseContentRef?.();
                        return responseContentRef?.textContent || "";
                    });
                },
                onDone: () => {
                    // 确保只处理当前请求的事件
                    if (this.isDestroyed || currentRequestId !== this.currentRequestId) return;
                    this.events.onComplete?.();
                },
                onError: (error: Error) => {
                    // 确保只处理当前请求的事件
                    if (this.isDestroyed || currentRequestId !== this.currentRequestId) return;
                    this.events.onError?.(error);
                },
                onAbort: () => {
                    // 确保只处理当前请求的事件
                    if (this.isDestroyed || currentRequestId !== this.currentRequestId) return;
                    this.events.onAbort?.();
                }
            };

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

    /**
     * 准备请求配置
     */
    private prepareRequestConfig(messages: MessageHistory, signal: AbortSignal): StreamRequestConfig {
        // 从全局配置获取AI配置
        const siyuanConfig = window.siyuan?.config?.ai?.openAI;
        if (!siyuanConfig) {
            throw new Error("未找到思源AI配置，请检查配置文件");
        }

        // 思源配置中的超时时间是秒，需要转换为毫秒
        const aiConfig = {
            ...siyuanConfig,
            apiTimeout: siyuanConfig.apiTimeout * 1000
        };

        // 构建消息历史
        const requestMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content+`\n发送时间:${dayjs(msg.timestamp).toDate()}`
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
    }
}

/**
 * 创建AI请求控制器工厂函数
 */
export const createAIRequestController = (
    events: {
        onStart?: () => void;
        onMessage?: (content: string, getCurrentContent?: () => string) => void;
        onComplete?: () => void;
        onError?: (error: Error) => void;
        onAbort?: () => void;
        onPause?: () => void;
        onResume?: () => void;
    },
    getAIConfig: () => any
) => {
    return new AIRequestController(events, getAIConfig);
};