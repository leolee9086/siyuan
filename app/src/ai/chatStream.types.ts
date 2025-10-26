
// 聊天状态接口
export interface ChatState {
    responseContentStr: string;
    isStreaming: boolean;
    isDone: boolean;
    abortFunction: (() => void) | null;
    // 新增：渲染后的blockDOM内容
    blockDOMContent: string;
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
    state: ChatState;
    elements: DialogElements;
    animationManager: AnimationManager;
    protyle?: IProtyle; // 新增：protyle实例，用于blockDOM渲染
    element?: Element; // 新增：块元素，用于获取块内容
}

// 流式响应处理配置接口
export interface StreamResponseConfig {
    dataStr: string;
    state: ChatState;
    responseContent: HTMLElement;
}

// 请求完成处理配置接口
export interface RequestCompleteConfig {
    state: ChatState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

// 请求错误处理配置接口
export interface RequestErrorConfig {
    error: Error;
    state: ChatState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

// 请求终止处理配置接口
export interface RequestAbortConfig {
    state: ChatState;
    elements: DialogElements;
    animationManager: AnimationManager;
}