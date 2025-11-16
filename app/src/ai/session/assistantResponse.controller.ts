import { AssistantResponseState, ToolCallExecutionCallback } from './session.types';
import { createTemporaryModule } from "../../util/code/scripts.executor";
import { SafeEventEmitter } from '../../util/events/eventEmitter';
import { createAIRequestController, AIRequestController } from '../requestController.impl';
import { getAIConfigFromSiyuan } from '../utils.config';
import { handleOpenAILikeStreamResponse } from '../handleOpenAILikeStreamResponse';
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
 * 代理任务控制器实现类
 * 负责管理**单个**任务状态和操作
 * 一个代理任务是一系列请求和响应的封装而不是一个简单的请求
 * 但是对外应该有一个跟普通api请求端口类似的响应方法fetchTask
 * 接受普通的AI聊天消息序列,返回一个响应式对象,是***增量的***消息序列
 * 
 */
export class AssistantMessageController extends SafeEventEmitter<typeof assistantResponseEventDefines> {
    private state: AssistantResponseState;
    private waitToolCallCallback: ToolCallExecutionCallback = async () => { };
    private asyncToolCallCallback: ToolCallExecutionCallback = async () => { };
    private abortFunction: (() => void) | null = null;
    private startTime: number = 0;
    private requestController: AIRequestController | null = null;
    private syncToolLimitNotified: boolean = false;
    private asyncToolLimitNotified: boolean = false;

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
        return this.state ;
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

    /**
     * 自动恢复对话（在工具调用完成后调用）
     * 检查错误次数，如果不超过3次则自动恢复
     */
    async autoResumeIfNeeded(): Promise<void> {
        if (this.state.errorCount <= 3) {
            try {
                await this.resumeAIRequest();
            } catch (error) {
                console.error('自动恢复失败:', error);
            }
        } else {
            console.log('错误次数过多，不自动恢复');
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
        // 检查同步工具调用次数限制
        if (this.state.syncToolCallCount >= 10) {
            console.error('同步工具调用次数已达上限(10次)');
            this.state.savedMessages.push({
                role: 'user',
                content: 'system:同步工具调用次数已达上限(10次)，无法继续执行工具调用',
                timestamp: Date.now()
            });
            
            // 触发工具调用事件（限制情况）
            this.emit('toolCallExecuted', {
                toolCode,
                result: new Error('同步工具调用次数已达上限(10次)，无法继续执行工具调用'),
                isAsync: false,
                timestamp: Date.now()
            });
            
            // 工具调用到达上限后，仅仅发起一次请求，告知AI它的工具调用次数已经达到上限
            if (!this.syncToolLimitNotified) {
                this.syncToolLimitNotified = true;
                try {
                    await this.startAIRequest([
                        ...this.state.savedMessages,
                        {
                            role: 'user',
                            content: 'system:同步工具调用次数已达上限(10次)，无法继续执行工具调用',
                            timestamp: Date.now()
                        }
                    ]);
                } catch (error) {
                    console.error('发送工具调用上限通知失败:', error);
                }
            }
            return;
        }

        // 立刻中止当前响应
        if (this.state.isStreaming && !this.state.isPaused) {
            this.pause();
        }

        // 确保状态已正确设置
        this.state.isStreaming = false;

        try {
            // 增加同步工具调用计数
            this.state.syncToolCallCount += 1;
            console.log(`同步工具调用次数: ${this.state.syncToolCallCount}/10`);

            // 执行工具调用
            const result = await createTemporaryModule(toolCode);
            console.log('工具调用执行结果:', result);
            
            // 检查是否有default导出
            if (!result.moduleExport.default) {
                throw new Error('必须使用default导出你需要查看的结果');
            }

            // 将工具执行结果添加到消息历史中
            this.state.savedMessages.push({
                role: 'user',
                content: `Tool execution result: ${JSON.stringify(await result.moduleExport.default)}`,
                timestamp: Date.now()
            });

            // 触发工具调用事件
            this.emit('toolCallExecuted', {
                toolCode,
                result,
                isAsync: false,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('工具调用执行失败:', error);
            
            // 增加错误计数
            this.state.errorCount += 1;
            
            // 将错误信息添加到消息历史中
            if (error instanceof Error) {
                this.state.savedMessages.push({
                    role: 'user',
                    content: `system:工具调用执行失败: ${error.message},\n你必须使用标准esm语法并且以default导出你需要的结果`,
                    timestamp: Date.now()
                });
            }

            // 触发工具调用事件（失败情况）
            this.emit('toolCallExecuted', {
                toolCode,
                result: error,
                isAsync: false,
                timestamp: Date.now()
            });
        } finally {
            // 在工具调用完成后自动恢复对话
            await this.autoResumeIfNeeded();
        }
    }

    async executeAsyncToolCall(toolCode: string): Promise<void> {
        // 检查异步工具调用次数限制
        if (this.state.asyncToolCallCount >= 10) {
            console.error('异步工具调用次数已达上限(10次)');
            // 不执行工具调用，直接返回错误结果
            this.state.asyncToolResults.push({ error: '异步工具调用次数已达上限(10次)，无法继续执行工具调用' });
            
            // 触发工具调用事件（限制情况）
            this.emit('toolCallExecuted', {
                toolCode,
                result: new Error('异步工具调用次数已达上限(10次)，无法继续执行工具调用'),
                isAsync: true,
                timestamp: Date.now()
            });
            
            // 工具调用到达上限后，仅仅发起一次请求，告知AI它的工具调用次数已经达到上限
            if (!this.asyncToolLimitNotified) {
                this.asyncToolLimitNotified = true;
                try {
                    await this.startAIRequest([
                        ...this.state.savedMessages,
                        {
                            role: 'user',
                            content: 'system:异步工具调用次数已达上限(10次)，无法继续执行工具调用',
                            timestamp: Date.now()
                        }
                    ]);
                } catch (error) {
                    console.error('发送工具调用上限通知失败:', error);
                }
            }
            return;
        }

        let toolPromise: Promise<any> | null = null;
        try {
            // 增加异步工具调用计数
            this.state.asyncToolCallCount += 1;
            console.log(`异步工具调用次数: ${this.state.asyncToolCallCount}/10`);

            // 创建异步工具调用Promise并添加到结果堆栈
            toolPromise = createTemporaryModule(toolCode);
            this.state.asyncToolResults.push(toolPromise);

            // 等待工具调用完成
            const result = await toolPromise;
            console.log('异步工具调用执行结果:', result);

            // 将结果替换到asyncToolResults中，而不是添加到消息历史
            const index = this.state.asyncToolResults.indexOf(toolPromise);
            if (index !== -1) {
                this.state.asyncToolResults[index] = result;
            }

            // 触发工具调用事件
            this.emit('toolCallExecuted', {
                toolCode,
                result,
                isAsync: true,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('异步工具调用执行失败:', error);

            // 将错误信息替换到asyncToolResults中
            if (toolPromise) {
                const index = this.state.asyncToolResults.indexOf(toolPromise);
                if (index !== -1) {
                    if (error instanceof Error) {
                        this.state.asyncToolResults[index] = { error: error.message };
                    } else {
                        this.state.asyncToolResults[index] = { error: String(error) };
                    }
                }
            }

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

    // 请求管理功能

    /**
     * 初始化请求控制器
     */
    private initializeRequestController(): void {
        if (this.requestController) {
            this.requestController.destroy();
        }

        this.requestController = createAIRequestController(
            {
                onStart: () => {
                    this.startStreaming();
                },
                onMessage: (dataStr: string) => {
                    // 处理流式响应数据
                    const result = handleOpenAILikeStreamResponse(dataStr, this.state.responseContentStr);
                    
                    if (result.error) {
                        this.emit('responseAborted', {
                            content: this.state.responseContentStr,
                            reason: result.error.message || String(result.error),
                            timestamp: Date.now()
                        });
                        return;
                    }

                    if (result.content) {
                        this.appendResponseContent(result.content);
                    }

                    if (result.isFinished) {
                        this.setDone();
                    }
                },
                onComplete: () => {
                    this.setDone();
                },
                onError: (error: Error) => {
                    this.emit('responseAborted', {
                        content: this.state.responseContentStr,
                        reason: error.message,
                        timestamp: Date.now()
                    });
                },
                onAbort: () => {
                    this.stopStreaming();
                    this.emit('responseAborted', {
                        content: this.state.responseContentStr,
                        reason: '请求被中止',
                        timestamp: Date.now()
                    });
                },
                onPause: () => {
                    this.pause();
                },
                onResume: () => {
                    this.resume();
                }
            },
            getAIConfigFromSiyuan
        );
    }

    /**
     * 发起AI请求
     */
    async startAIRequest(messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>): Promise<void> {
        if (!this.requestController) {
            this.initializeRequestController();
        }

        if (this.requestController) {
            // 设置中止函数
            this.setAbortFunction(() => this.requestController?.cancelRequest());
            
            // 发起请求
            await this.requestController.startRequest(messages);
        }
    }

    /**
     * 取消当前请求
     */
    cancelAIRequest(): void {
        if (this.requestController) {
            this.requestController.cancelRequest();
        }
    }

    /**
     * 暂停当前请求
     */
    pauseAIRequest(): void {
        if (this.requestController) {
            this.requestController.pauseRequest();
        }
    }

    /**
     * 恢复当前请求
     */
    async resumeAIRequest(): Promise<void> {
        if (this.requestController) {
            await this.requestController.resumeRequest();
        }
    }

    /**
     * 获取请求状态
     */
    getRequestState(): {
        isStreaming: boolean;
        isPaused: boolean;
        isDone: boolean;
        hasError: boolean;
        errorMessage: string;
    } {
        if (!this.requestController) {
            return {
                isStreaming: false,
                isPaused: false,
                isDone: false,
                hasError: false,
                errorMessage: ''
            };
        }

        const controllerState = this.requestController.getRequestState();
        return {
            isStreaming: controllerState.isStreaming,
            isPaused: this.state.isPaused,
            isDone: this.state.isDone,
            hasError: this.state.errorCount > 0,
            errorMessage: this.state.errorCount > 0 ? '请求过程中发生错误' : ''
        };
    }

    /**
     * 销毁请求控制器
     */
    destroyRequestController(): void {
        if (this.requestController) {
            this.requestController.destroy();
            this.requestController = null;
        }
    }

    /**
     * 重置请求状态
     */
    resetRequestState(): void {
        this.destroyRequestController();
        this.state.errorCount = 0;
        this.state.syncToolCallCount = 0;
        this.state.asyncToolCallCount = 0;
        this.state.asyncToolResults = [];
    }
}
