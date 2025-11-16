
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
    messageControllers?: Array<any>;
    chatStateController?: IChatStateController;
    errorCount:number
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