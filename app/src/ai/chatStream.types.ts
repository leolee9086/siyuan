
// 工具调用执行回调函数类型
export type ToolCallExecutionCallback = (toolCode: string) => Promise<void>;

// AI响应状态接口
export interface AssistantResponseState {
    responseContentStr: string;
    isStreaming: boolean;
    isDone: boolean;
    abortFunction: (() => void) | null;
    // 新增：渲染后的blockDOM内容
    blockDOMContent: string;
    // 新增：工具调用执行回调
    onWaitToolCallDetected: ToolCallExecutionCallback;
    onAsyncToolCallDetected: ToolCallExecutionCallback;

    // 新增：暂停状态
    isPaused: boolean;
    // 新增：保存的消息内容
    savedMessages: Array<{
        role: 'assistant';
        content: string;
        timestamp: number;
    }>;
}

// 完整的对话会话状态
export interface ChatSessionState extends Omit<AssistantResponseState, 'savedMessages'> {
    savedMessages: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: number;
    }>;
    // 新增：异步工具调用结果堆栈
    asyncToolResults: Array<any>;
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
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
    protyle?: IProtyle; // 新增：protyle实例，用于blockDOM渲染
    targetBlockElements?: Element[]; // 新增：选中的块元素数组
}

// 流式响应处理配置接口
export interface StreamResponseConfig {
    dataStr: string;
    state: AssistantResponseState;
    responseContent: HTMLElement;
}

// 请求完成处理配置接口
export interface RequestCompleteConfig {
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

// 请求错误处理配置接口
export interface RequestErrorConfig {
    error: Error;
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

// 请求终止处理配置接口
export interface RequestAbortConfig {
    state: AssistantResponseState;
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