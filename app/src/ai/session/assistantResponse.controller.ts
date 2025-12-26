import { AssistantResponseState, ToolCallExecutionCallback } from "./session.types";
import { SafeEventEmitter } from "../../util/events/eventEmitter";
import { createAIRequestController, AIRequestController } from "../requestController.impl";
import { getAIConfigFromSiyuan } from "../utils.config";
import { handleOpenAILikeStreamResponse } from "../handleOpenAILikeStreamResponse";
import { assistantResponseEventDefines } from "./assistantResponse.events";
import { executeSyncToolCall, executeAsyncToolCallFn, ToolCallExecutorConfig } from "./toolCallExecutor";

/**
 * 代理任务控制器实现类
 * 负责管理**单个**任务状态和操作
 * 一个代理任务是一系列请求和响应的封装而不是一个简单的请求
 * 但是对外应该有一个跟普通api请求端口类似的响应方法fetchTask
 * 接受普通的AI聊天消息序列,返回一个响应式对象,是***增量的***消息序列
 */
export class AssistantMessageController extends SafeEventEmitter<typeof assistantResponseEventDefines> {
    private state: AssistantResponseState;
    private waitToolCallCallback: ToolCallExecutionCallback;
    private asyncToolCallCallback: ToolCallExecutionCallback;
    private abortFunction: (() => void) | null = null;
    private startTime: number = 0;
    private requestController: AIRequestController | null = null;
    private syncToolLimitNotified = { value: false };
    private asyncToolLimitNotified = { value: false };

    constructor(initialState?: Partial<AssistantResponseState>) {
        super(assistantResponseEventDefines);
        this.waitToolCallCallback = async () => { };
        this.asyncToolCallCallback = async () => { };
        this.state = {
            responseContentStr: "",
            isStreaming: false,
            isDone: false,
            abortFunction: null,
            blockDOMContent: "",
            onWaitToolCallDetected: async () => { },
            onAsyncToolCallDetected: async () => { },
            isPaused: false,
            savedMessages: [],
            asyncToolResults: [],
            messageControllers: [],
            errorCount: 0,
            syncToolCallCount: 0,
            asyncToolCallCount: 0,
            ...initialState
        };
        this.state.chatStateController = this;
    }

    // 获取状态
    getState(): AssistantResponseState {
        return this.state;
    }

    // 更新响应内容
    updateResponseContent(content: string): void {
        const oldContent = this.state.responseContentStr;
        this.state.responseContentStr = content;
        this.emit("contentChanged", { oldContent, newContent: content, timestamp: Date.now() });
    }

    appendResponseContent(content: string): void {
        const oldContent = this.state.responseContentStr;
        this.state.responseContentStr += content;
        this.emit("contentChanged", { oldContent, newContent: this.state.responseContentStr, timestamp: Date.now() });
    }

    // 控制流式传输状态
    startStreaming(): void {
        this.state.isStreaming = true;
        this.state.isDone = false;
        this.startTime = Date.now();
        this.emit("streamingStateChanged", { isStreaming: true, timestamp: Date.now() });
    }

    stopStreaming(): void {
        this.state.isStreaming = false;
        this.emit("streamingStateChanged", { isStreaming: false, timestamp: Date.now() });
    }

    setDone(): void {
        const duration = this.startTime ? Date.now() - this.startTime : 0;
        this.state.isStreaming = false;
        this.state.isDone = true;
        this.emit("streamingStateChanged", { isStreaming: false, timestamp: Date.now() });
        this.emit("responseCompleted", { finalContent: this.state.responseContentStr, duration, timestamp: Date.now() });
    }

    // 中止控制
    setAbortFunction(abortFn: (() => void) | null): void {
        this.abortFunction = abortFn;
    }

    abort(): void {
        if (this.abortFunction) {
            this.abortFunction();
        }
        this.stopStreaming();
        this.emit("responseAborted", { content: this.state.responseContentStr, reason: "用户中止", timestamp: Date.now() });
    }

    // 暂停/恢复控制
    pause(): void {
        if (this.state.isStreaming && !this.state.isPaused) {
            this.state.isPaused = true;
            this.saveCurrentMessage();
            this.abortFunction?.();
            this.emit("pauseStateChanged", { isPaused: true, timestamp: Date.now() });
        }
    }

    resume(): void {
        if (this.state.isPaused) {
            this.state.isPaused = false;
            this.state.isStreaming = true;
            this.state.isDone = false;
            this.startTime = Date.now();
            this.emit("pauseStateChanged", { isPaused: false, timestamp: Date.now() });
            this.emit("streamingStateChanged", { isStreaming: true, timestamp: Date.now() });
        }
    }

    /**
     * 自动恢复对话（在工具调用完成后调用）
     * 检查错误次数，如果不超过3次则自动恢复
     */
    async autoResumeIfNeeded(): Promise<void> {
        if (this.state.errorCount > 3) {
            console.log("错误次数过多，不自动恢复");
            return;
        }

        try {
            await this.resumeAIRequest();
        } catch (error) {
            console.error("自动恢复失败:", error);
        }
    }

    // 消息历史管理
    saveCurrentMessage(): void {
        if (this.state.responseContentStr.trim()) {
            const message = {
                role: "assistant" as const,
                content: this.state.responseContentStr,
                timestamp: Date.now()
            };
            this.state.savedMessages.push(message);
            this.emit("messageSaved", { message, totalMessages: this.state.savedMessages.length, timestamp: Date.now() });
        }
    }

    getSavedMessages() {
        return [...this.state.savedMessages];
    }

    // 工具调用处理
    setWaitToolCallCallback(callback: ToolCallExecutionCallback): void {
        this.waitToolCallCallback = callback;
    }

    setAsyncToolCallCallback(callback: ToolCallExecutionCallback): void {
        this.asyncToolCallCallback = callback;
    }

    async executeWaitToolCall(toolCode: string): Promise<void> {
        await executeSyncToolCall(toolCode, buildToolCallExecutorConfig(this), this.syncToolLimitNotified);
    }

    async executeAsyncToolCall(toolCode: string): Promise<void> {
        await executeAsyncToolCallFn(toolCode, buildToolCallExecutorConfig(this), this.asyncToolLimitNotified);
    }

    // DOM内容处理
    updateBlockDOMContent(content: string): void {
        const oldContent = this.state.blockDOMContent;
        this.state.blockDOMContent = content;
        this.emit("domContentChanged", { oldContent, newContent: content, timestamp: Date.now() });
    }

    getBlockDOMContent(): string {
        return this.state.blockDOMContent;
    }

    // 请求管理功能

    /** 发起AI请求 */
    async startAIRequest(messages: Array<{ role: "user" | "assistant"; content: string; timestamp: number }>): Promise<void> {
        if (!this.requestController) {
            this.requestController = initializeRequestController(this, this.requestController);
        }
        if (this.requestController) {
            this.setAbortFunction(() => this.requestController?.cancelRequest());
            await this.requestController.startRequest(messages);
        }
    }

    /** 取消当前请求 */
    cancelAIRequest(): void {
        if (this.requestController) {
            this.requestController.cancelRequest();
        }
    }

    /** 暂停当前请求 */
    pauseAIRequest(): void {
        if (this.requestController) {
            this.requestController.pauseRequest();
        }
    }

    /** 恢复当前请求 */
    async resumeAIRequest(): Promise<void> {
        if (this.requestController) {
            await this.requestController.resumeRequest();
        }
    }

    /** 获取请求状态 */
    getRequestState(): {
        isStreaming: boolean;
        isPaused: boolean;
        isDone: boolean;
        hasError: boolean;
        errorMessage: string;
    } {
        if (!this.requestController) {
            return { isStreaming: false, isPaused: false, isDone: false, hasError: false, errorMessage: "" };
        }
        const controllerState = this.requestController.getRequestState();
        return {
            isStreaming: controllerState.isStreaming,
            isPaused: this.state.isPaused,
            isDone: this.state.isDone,
            hasError: this.state.errorCount > 0,
            errorMessage: this.state.errorCount > 0 ? "请求过程中发生错误" : ""
        };
    }

    /** 销毁请求控制器 */
    destroyRequestController(): void {
        if (this.requestController) {
            this.requestController.destroy();
            this.requestController = null;
        }
    }

    /** 重置请求状态 */
    resetRequestState(): void {
        this.destroyRequestController();
        this.state.errorCount = 0;
        this.state.syncToolCallCount = 0;
        this.state.asyncToolCallCount = 0;
        this.state.asyncToolResults = [];
    }
}

/**
 * 辅助函数：构建工具调用执行器配置
 */
function buildToolCallExecutorConfig(controller: AssistantMessageController): ToolCallExecutorConfig {
    return {
        getState: () => controller.getState(),
        emitToolCallEvent: (toolCode, result, isAsync) => {
            controller.emit("toolCallExecuted", { toolCode, result, isAsync, timestamp: Date.now() });
        },
        startAIRequest: (messages) => controller.startAIRequest(messages),
        pause: () => controller.pause(),
        autoResumeIfNeeded: () => controller.autoResumeIfNeeded()
    };
}

/**
 * 辅助函数：初始化请求控制器
 */
function initializeRequestController(
    controller: AssistantMessageController,
    currentRequestController: AIRequestController | null
): AIRequestController {
    if (currentRequestController) {
        currentRequestController.destroy();
    }

    return createAIRequestController(
        {
            onStart: () => controller.startStreaming(),
            onMessage: (dataStr: string) => {
                const result = handleOpenAILikeStreamResponse(dataStr);
                const state = controller.getState();
                if (result.error) {
                    controller.emit("responseAborted", {
                        content: state.responseContentStr,
                        reason: result.error.message || String(result.error),
                        timestamp: Date.now()
                    });
                    return;
                }
                if (result.content) {
                    controller.appendResponseContent(result.content);
                }
                if (result.isFinished) {
                    controller.setDone();
                }
            },
            onComplete: () => controller.setDone(),
            onError: (error: Error) => {
                controller.emit("responseAborted", {
                    content: controller.getState().responseContentStr,
                    reason: error.message,
                    timestamp: Date.now()
                });
            },
            onAbort: () => {
                controller.stopStreaming();
                controller.emit("responseAborted", {
                    content: controller.getState().responseContentStr,
                    reason: "请求被中止",
                    timestamp: Date.now()
                });
            },
            onPause: () => controller.pause(),
            onResume: () => controller.resume()
        },
        getAIConfigFromSiyuan
    );
}
