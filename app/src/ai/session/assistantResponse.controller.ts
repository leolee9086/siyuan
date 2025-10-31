import { AssistantResponseState,  ToolCallExecutionCallback } from './session.types';
import { createTemporaryModule } from '../parser/toolCallDetector';

/**
 * AI响应控制器实现类
 * 负责管理AI响应状态和操作
 */
export class AssistantResponseController  {
    private state: AssistantResponseState;
    private waitToolCallCallback: ToolCallExecutionCallback = async () => {};
    private asyncToolCallCallback: ToolCallExecutionCallback = async () => {};
    private abortFunction: (() => void) | null = null;

    constructor(initialState?: Partial<AssistantResponseState>) {
        this.state = {
            responseContentStr: '',
            isStreaming: false,
            isDone: false,
            blockDOMContent: '',
            isPaused: false,
            savedMessageChunks: [],
            ...initialState
        };
    }

    // 获取状态
    getState(): AssistantResponseState {
        return { ...this.state };
    }

    // 更新响应内容
    updateResponseContent(content: string): void {
        this.state.responseContentStr = content;
    }

    appendResponseContent(content: string): void {
        this.state.responseContentStr += content;
    }

    // 控制流式传输状态
    startStreaming(): void {
        this.state.isStreaming = true;
        this.state.isDone = false;
    }

    stopStreaming(): void {
        this.state.isStreaming = false;
    }

    setDone(): void {
        this.state.isStreaming = false;
        this.state.isDone = true;
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
    }

    // 暂停/恢复控制
    pause(): void {
        if (this.state.isStreaming && !this.state.isPaused) {
            this.state.isPaused = true;
            this.saveCurrentMessage();
            if (this.abortFunction) {
                this.abortFunction();
            }
        }
    }

    resume(): void {
        if (this.state.isPaused) {
            this.state.isPaused = false;
            this.state.isStreaming = true;
            this.state.isDone = false;
        }
    }

    // 消息历史管理
    saveCurrentMessage(): void {
        if (this.state.responseContentStr.trim()) {
            this.state.savedMessageChunks.push({
                role: 'assistant',
                content: this.state.responseContentStr,
                timestamp: Date.now()
            });
        }
    }

    getSavedMessages(): Array<{
        role: 'assistant';
        content: string;
        timestamp: number;
    }> {
        return [...this.state.savedMessageChunks];
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
        } catch (error) {
            console.error('工具调用执行失败:', error);
        }
    }

    async executeAsyncToolCall(toolCode: string): Promise<void> {
        try {
            // 执行异步工具调用
            const result = await createTemporaryModule(toolCode);
            console.log('异步工具调用执行结果:', result);
        } catch (error) {
            console.error('异步工具调用执行失败:', error);
        }
    }

    // DOM内容处理
    updateBlockDOMContent(content: string): void {
        this.state.blockDOMContent = content;
    }

    getBlockDOMContent(): string {
        return this.state.blockDOMContent;
    }
}


