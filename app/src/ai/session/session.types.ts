import { TemporaryModule } from "../../util/lib/code/scripts.types";

/**
 * 工具调用执行回调函数类型
 *
 * 用途：定义工具调用检测后的异步执行回调签名
 * 使用场景：在 {@link AssistantResponseState} 中作为 onWaitToolCallDetected / onAsyncToolCallDetected 的类型；
 *   在 {@link AssistantMessageController} 中注册和触发工具调用回调
 * 关联类型：{@link AssistantResponseState}、{@link AssistantMessageController}
 */
export type ToolCallExecutionCallback = (toolCode: string) => Promise<void>;

/**
 * 聊天会话状态快照
 *
 * 用途：描述一次聊天会话的运行时状态
 * 使用场景：由 {@link IChatStateController} 管理和查询
 * 关联类型：{@link IChatStateController}
 */
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

/**
 * 聊天状态控制器接口
 *
 * 用途：定义聊天会话生命周期的控制方法和状态查询能力
 * 使用场景：管理聊天会话的启动、结束、错误处理和状态重置
 * 关联类型：{@link ChatState}
 */
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

/**
 * AI助手响应的完整运行时状态
 *
 * 用途：跟踪一次AI助手响应过程中的所有状态，包括流式内容、工具调用、暂停/恢复等
 * 使用场景：在 chatStream.state.ts 中通过 reactive() 创建；
 *   在 assistantResponse.streaming.ts / requestInit.ts 中作为纯函数的操作目标
 * 关联类型：{@link ToolCallExecutionCallback}、{@link TemporaryModule}
 */
export interface AssistantResponseState {
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
        role: "user" | "assistant";
        content: string;
        timestamp: number;
    }>;
    // 异步工具调用结果堆栈
    asyncToolResults: Array<Promise<Partial<TemporaryModule>> | Partial<TemporaryModule> | { error: string }>;
    errorCount: number;
    // 同步工具调用计数器
    syncToolCallCount: number;
    // 异步工具调用计数器
    asyncToolCallCount: number;
}

/**
 * AI 请求上下文：闭包状态的显式传递载体
 *
 * 用途：将 createState 中的闭包变量打包为可传递的对象，供模块级函数访问
 * 使用场景：chatStream.state.ts 中 doStartAIRequest 等模块级函数需要访问 createState 内部状态时使用
 * 关联类型：{@link AssistantResponseState}
 */
export interface RequestContext {
    state: AssistantResponseState;
    startTimeRef: { value: number };
    controllerRef: { value: import("../../magi/service/requestController").AIRequestController | null };
    protyle: IProtyle;
}

/**
 * AI对话框DOM元素引用集合
 *
 * 用途：持有对话框中各关键DOM元素的引用，供状态更新时直接操作
 * 使用场景：在 {@link AIRequestConfig}、{@link RequestCompleteConfig}、{@link RequestErrorConfig}、{@link RequestAbortConfig} 中传递
 * 关联类型：{@link AIRequestConfig}
 */
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

/**
 * 状态指示动画的启停控制器
 *
 * 用途：控制对话框中"正在思考..."等加载动画的启动和停止
 * 使用场景：在 {@link AIRequestConfig} 及请求生命周期配置中管理动画状态
 * 关联类型：{@link AIRequestConfig}
 */
export interface AnimationManager {
    startAnimation: () => void;
    stopAnimation: () => void;
}

/**
 * 发起AI请求所需的完整上下文配置
 *
 * 用途：将用户输入、会话状态、UI元素和动画管理器打包为一个配置对象
 * 使用场景：在 chatStream.state.ts 中构建请求上下文时使用
 * 关联类型：{@link AssistantResponseState}、{@link DialogElements}、{@link AnimationManager}
 */
export interface AIRequestConfig {
    inputValue: string;
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
    protyle?: IProtyle; // 新增：protyle实例，用于blockDOM渲染
    targetBlockElements?: Element[]; // 新增：选中的块元素数组
}

/**
 * 流式响应数据处理配置
 *
 * 用途：封装单条SSE消息的处理所需上下文（原始数据、会话状态、渲染容器）
 * 使用场景：在流式响应的 onMessage 回调中构造并传递给响应处理函数
 * 关联类型：{@link AssistantResponseState}
 */
export interface StreamResponseConfig {
    dataStr: string;
    state: AssistantResponseState;
    responseContent: HTMLElement;
}

/**
 * 请求正常完成时的处理配置
 *
 * 用途：封装请求完成后需要更新的状态、UI元素和动画管理器
 * 使用场景：在流式请求的 onDone 回调中构造并传递给完成处理函数
 * 关联类型：{@link AssistantResponseState}、{@link DialogElements}、{@link AnimationManager}
 */
export interface RequestCompleteConfig {
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

/**
 * 请求发生错误时的处理配置
 *
 * 用途：封装错误对象及需要更新的状态、UI元素和动画管理器
 * 使用场景：在流式请求的 onError 回调中构造并传递给错误处理函数
 * 关联类型：{@link AssistantResponseState}、{@link DialogElements}、{@link AnimationManager}
 */
export interface RequestErrorConfig {
    error: Error;
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
}

/**
 * 请求被用户主动中止时的处理配置
 *
 * 用途：封装中止后需要更新的状态、UI元素和动画管理器
 * 使用场景：在流式请求的 onAbort 回调中构造并传递给中止处理函数
 * 关联类型：{@link AssistantResponseState}、{@link DialogElements}、{@link AnimationManager}
 */
export interface RequestAbortConfig {
    state: AssistantResponseState;
    elements: DialogElements;
    animationManager: AnimationManager;
}
