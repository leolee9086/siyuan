import { AssistantResponseState, ToolCallExecutionCallback } from './session.types';
import { createTemporaryModule } from "../../util/code/scripts.executor";
import { SafeEventEmitter } from '../../util/events/eventEmitter';
import z from 'zod';

// 定义AI响应控制器的事件类型
const assistantResponseEventDefines = {
    // 响应内容变更事件
    contentChanged: {
        oldContent: z.string(),
        newContent: z.string(),
        timestamp: z.number()
    },
    // 流式传输状态变更事件
    streamingStateChanged: {
        isStreaming: z.boolean(),
        timestamp: z.number()
    },
    // 响应完成事件
    responseCompleted: {
        finalContent: z.string(),
        duration: z.number(),
        timestamp: z.number()
    },
    // 响应中止事件
    responseAborted: {
        content: z.string(),
        reason: z.string().optional(),
        timestamp: z.number()
    },
    // 暂停状态变更事件
    pauseStateChanged: {
        isPaused: z.boolean(),
        timestamp: z.number()
    },
    // 消息保存事件
    messageSaved: {
        message: z.object({
            role: z.literal('assistant'),
            content: z.string(),
            timestamp: z.number()
        }),
        totalMessages: z.number(),
        timestamp: z.number()
    },
    // 工具调用事件
    toolCallExecuted: {
        toolCode: z.string(),
        result: z.any(),
        isAsync: z.boolean(),
        timestamp: z.number()
    },
    // DOM内容变更事件
    domContentChanged: {
        oldContent: z.string(),
        newContent: z.string(),
        timestamp: z.number()
    }
} as const;

/**
 * AI响应控制器实现类
 * 负责管理AI响应状态和操作
 */
export class AssistantMessageController extends SafeEventEmitter<typeof assistantResponseEventDefines> {
    private state: AssistantResponseState;
    private waitToolCallCallback: ToolCallExecutionCallback = async () => { };
    private asyncToolCallCallback: ToolCallExecutionCallback = async () => { };
    private abortFunction: (() => void) | null = null;
    private startTime: number = 0;

    constructor(initialState?: Partial<AssistantResponseState>) {
        super(assistantResponseEventDefines);
        this.state = {
            responseContentStr: '',
            isStreaming: false,
            isDone: false,
            abortFunction: null,
            blockDOMContent: '',
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
        return { ...this.state };
    }

    // 更新响应内容
    updateResponseContent(content: string): void {
        const oldContent = this.state.responseContentStr;
        this.state.responseContentStr = content;

        // 触发内容变更事件
        this.emit('contentChanged', {
            oldContent,
            newContent: content,
            timestamp: Date.now()
        });
    }

    appendResponseContent(content: string): void {
        const oldContent = this.state.responseContentStr;
        this.state.responseContentStr += content;

        // 触发内容变更事件
        this.emit('contentChanged', {
            oldContent,
            newContent: this.state.responseContentStr,
            timestamp: Date.now()
        });
    }

    // 控制流式传输状态
    startStreaming(): void {
        this.state.isStreaming = true;
        this.state.isDone = false;
        this.startTime = Date.now();

        // 触发流式传输状态变更事件
        this.emit('streamingStateChanged', {
            isStreaming: true,
            timestamp: Date.now()
        });
    }

    stopStreaming(): void {
        this.state.isStreaming = false;

        // 触发流式传输状态变更事件
        this.emit('streamingStateChanged', {
            isStreaming: false,
            timestamp: Date.now()
        });
    }

    setDone(): void {
        const duration = this.startTime ? Date.now() - this.startTime : 0;

        this.state.isStreaming = false;
        this.state.isDone = true;

        // 触发流式传输状态变更事件
        this.emit('streamingStateChanged', {
            isStreaming: false,
            timestamp: Date.now()
        });

        // 触发响应完成事件
        this.emit('responseCompleted', {
            finalContent: this.state.responseContentStr,
            duration,
            timestamp: Date.now()
        });
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

        // 触发响应中止事件
        this.emit('responseAborted', {
            content: this.state.responseContentStr,
            reason: '用户中止',
            timestamp: Date.now()
        });
    }

    // 暂停/恢复控制
    pause(): void {
        if (this.state.isStreaming && !this.state.isPaused) {
            this.state.isPaused = true;
            this.saveCurrentMessage();
            if (this.abortFunction) {
                this.abortFunction();
            }

            // 触发暂停状态变更事件
            this.emit('pauseStateChanged', {
                isPaused: true,
                timestamp: Date.now()
            });
        }
    }

    resume(): void {
        if (this.state.isPaused) {
            this.state.isPaused = false;
            this.state.isStreaming = true;
            this.state.isDone = false;
            this.startTime = Date.now();

            // 触发暂停状态变更事件
            this.emit('pauseStateChanged', {
                isPaused: false,
                timestamp: Date.now()
            });

            // 触发流式传输状态变更事件
            this.emit('streamingStateChanged', {
                isStreaming: true,
                timestamp: Date.now()
            });
        }
    }

    // 消息历史管理
    saveCurrentMessage(): void {
        if (this.state.responseContentStr.trim()) {
            const message = {
                role: 'assistant' as const,
                content: this.state.responseContentStr,
                timestamp: Date.now()
            };

            this.state.savedMessages.push(message);

            // 触发消息保存事件
            this.emit('messageSaved', {
                message,
                totalMessages: this.state.savedMessages.length,
                timestamp: Date.now()
            });
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
        // 暂停当前的流式响应
        if (this.state.isStreaming && !this.state.isPaused) {
            this.pause();
        }

        try {
            // 执行工具调用
            const result = await createTemporaryModule(toolCode);
            console.log('工具调用执行结果:', result);

            // 触发工具调用事件
            this.emit('toolCallExecuted', {
                toolCode,
                result,
                isAsync: false,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('工具调用执行失败:', error);

            // 触发工具调用事件（失败情况）
            this.emit('toolCallExecuted', {
                toolCode,
                result: error,
                isAsync: false,
                timestamp: Date.now()
            });
        }
    }

    async executeAsyncToolCall(toolCode: string): Promise<void> {
        try {
            // 执行异步工具调用
            const result = await createTemporaryModule(toolCode);
            console.log('异步工具调用执行结果:', result);

            // 触发工具调用事件
            this.emit('toolCallExecuted', {
                toolCode,
                result,
                isAsync: true,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('异步工具调用执行失败:', error);

            // 触发工具调用事件（失败情况）
            this.emit('toolCallExecuted', {
                toolCode,
                result: error,
                isAsync: true,
                timestamp: Date.now()
            });
        }
    }

    // DOM内容处理
    updateBlockDOMContent(content: string): void {
        const oldContent = this.state.blockDOMContent;
        this.state.blockDOMContent = content;
        // 触发DOM内容变更事件
        this.emit('domContentChanged', {
            oldContent,
            newContent: content,
            timestamp: Date.now()
        });
    }

    getBlockDOMContent(): string {
        return this.state.blockDOMContent;
    }
}
