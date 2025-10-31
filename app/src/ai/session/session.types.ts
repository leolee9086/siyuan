import { AssistantResponseController } from "./assistantResponse.controller";
import { UserRequestController } from "./userRequest.controller";

// 工具调用执行回调函数类型
export type ToolCallExecutionCallback = (toolCode: string) => Promise<void>;

// AI响应状态接口 - 只包含状态数据
export type AssistantResponseState= {
    responseContentStr: string;
    isStreaming: boolean;
    isDone: boolean;
    // 渲染后的blockDOM内容
    blockDOMContent: string;
    // 暂停状态
    isPaused: boolean;
    // 保存的消息内容
    savedMessageChunks: Array<{
        role: 'assistant';
        content: string;
        timestamp: number;
    }>;
}

// 用户请求事件类型枚举
export enum UserRequestEventType {
    // 请求内容变更
    CONTENT_CHANGED = 'user-request:content-changed',
    // 请求开始处理
    PROCESSING_STARTED = 'user-request:processing-started',
    // 请求处理完成
    PROCESSING_COMPLETED = 'user-request:processing-completed',
    // 请求被取消
    PROCESSING_CANCELLED = 'user-request:processing-cancelled',
    // 请求暂停
    PROCESSING_PAUSED = 'user-request:processing-paused',
    // 请求恢复
    PROCESSING_RESUMED = 'user-request:processing-resumed',
    // 请求参数变更
    PARAMS_CHANGED = 'user-request:params-changed',
    // 目标块变更
    TARGET_BLOCK_CHANGED = 'user-request:target-block-changed',
    // 请求类型变更
    TYPE_CHANGED = 'user-request:type-changed',
    // 请求历史添加
    HISTORY_ADDED = 'user-request:history-added',
    // 请求历史清空
    HISTORY_CLEARED = 'user-request:history-cleared',
    // 请求重置
    REQUEST_RESET = 'user-request:reset'
}

// 事件数据接口
export interface UserRequestEventData {
    [UserRequestEventType.CONTENT_CHANGED]: {
        oldContent: string;
        newContent: string;
        timestamp: number;
    };
    [UserRequestEventType.PROCESSING_STARTED]: {
        content: string;
        type: string;
        params: Record<string, any>;
        timestamp: number;
    };
    [UserRequestEventType.PROCESSING_COMPLETED]: {
        content: string;
        result?: any;
        duration: number;
        timestamp: number;
    };
    [UserRequestEventType.PROCESSING_CANCELLED]: {
        content: string;
        reason?: string;
        timestamp: number;
    };
    [UserRequestEventType.PROCESSING_PAUSED]: {
        content: string;
        timestamp: number;
    };
    [UserRequestEventType.PROCESSING_RESUMED]: {
        content: string;
        timestamp: number;
    };
    [UserRequestEventType.PARAMS_CHANGED]: {
        oldParams: Record<string, any>;
        newParams: Record<string, any>;
        timestamp: number;
    };
    [UserRequestEventType.TARGET_BLOCK_CHANGED]: {
        oldBlockId: string | null;
        newBlockId: string | null;
        timestamp: number;
    };
    [UserRequestEventType.TYPE_CHANGED]: {
        oldType: string;
        newType: string;
        timestamp: number;
    };
    [UserRequestEventType.HISTORY_ADDED]: {
        request: {
            content: string;
            timestamp: number;
            type: string;
            params: Record<string, any>;
        };
        totalHistoryCount: number;
    };
    [UserRequestEventType.HISTORY_CLEARED]: {
        timestamp: number;
    };
    [UserRequestEventType.REQUEST_RESET]: {
        timestamp: number;
    };
}

// 用户请求状态接口 - 只包含状态数据
export type UserRequestState = {
    // 请求输入内容
    requestContentStr: string;
    // 请求是否正在处理中
    isProcessing: boolean;
    // 请求是否已完成
    isCompleted: boolean;
    // 请求是否已取消
    isCancelled: boolean;
    // 请求是否暂停
    isPaused: boolean;
    // 请求创建时间
    requestTimestamp: number;
    // 请求完成时间
    completionTimestamp: number | null;
    // 关联的块元素ID（如果有）
    targetBlockId: string | null;
    // 请求类型（如：文本生成、内容填充等）
    requestType: 'text-generation' | 'content-fill' | 'block-edit' | 'custom';
    // 请求参数
    requestParams: Record<string, any>;
    // 保存的请求历史
    savedRequests: Array<{
        content: string;
        timestamp: number;
        type: string;
        params: Record<string, any>;
    }>;
}



// 聊天状态接口
export type ChatState = {
    // 聊天是否活跃
    isActive: boolean;
    // 聊天是否出错
    hasError: boolean;
    // 错误信息
    errorMessage: string | null;
    // 聊天开始时间
    sessionStartTime: number;
    // 聊天结束时间
    sessionEndTime: number | null;
    // 聊天会话ID
    sessionId: string;
}

// 聊天状态控制器接口
export interface IChatStateController {
    // 状态查询方法
    getState(): ChatState;
    isActive(): boolean;
    hasError(): boolean;
    getErrorMessage(): string | null;
    getSessionId(): string;
    
    // 聊天控制方法
    startSession(): void;
    endSession(): void;
    setError(error: string): void;
    clearError(): void;
    
    // 重置状态
    reset(): void;
}

// 完整的对话会话状态
export interface ChatSessionState {
    responseContentStr: string;
    isStreaming: boolean;
    isDone: boolean;
    abortFunction: (() => void) | null;
    // 渲染后的blockDOM内容
    blockDOMContent: string;
    // 工具调用执行回调
    onWaitToolCallDetected: ToolCallExecutionCallback;
    onAsyncToolCallDetected: ToolCallExecutionCallback;
    // 暂停状态
    isPaused: boolean;
    // 保存的消息内容
    savedMessages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: number;
    }>;
    // 异步工具调用结果堆栈
    asyncToolResults: Array<any>;
    messageControllers?: Array<AssistantResponseController | UserRequestController>;
    chatStateController?: IChatStateController;
}

// UI元素接口
export interface DialogElements {
    inputElement: HTMLTextAreaElement;
    responseContainer: HTMLElement;
    responseContent: HTMLElement;
    responseStatus: HTMLElement;
    statusText: HTMLElement;
    statusDots: HTMLElement;
    textButtonElement: HTMLButtonElement;
    cancelButtonElement: HTMLButtonElement;
}

// 动画管理器接口
export interface AnimationManager {
    startAnimation: () => void;
    stopAnimation: () => void;
}

// 流式响应处理器接口
export interface StreamResponseHandlers {
    onMessage: (dataStr: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onAbort: () => void;
}

// AI请求配置接口
export interface AIRequestConfig {
    inputValue: string;
    state: ChatSessionState;
    elements: DialogElements;
    animationManager: AnimationManager;
    protyle?: IProtyle; // 新增：protyle实例，用于blockDOM渲染
    targetBlockElements?: Element[]; // 新增：选中的块元素数组
}

// 流式响应处理配置接口
export interface StreamResponseConfig {
    dataStr: string;
    state: ChatSessionState;
    responseContent: HTMLElement;
}

// 请求完成处理配置接口
export interface RequestCompleteConfig {
    state: ChatSessionState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

// 请求错误处理配置接口
export interface RequestErrorConfig {
    error: Error;
    state: ChatSessionState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

// 请求终止处理配置接口
export interface RequestAbortConfig {
    state: ChatSessionState;
    elements: DialogElements;
    animationManager: AnimationManager;
}
// UI函数接口
export interface UIFunctions {
    showResponse: () => void;
    setCompleteStatus: () => void;
    setErrorStatus: (error: Error) => void;
    setAbortStatus: () => void;
    getResponseContentRef: () => HTMLElement | null;
}