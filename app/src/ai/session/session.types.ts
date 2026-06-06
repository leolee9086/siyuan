/** 用途：TemporaryModule 模块执行结果类型。使用范围：异步工具调用结果堆栈类型标注。解耦评估：类型导入，不涉及运行时耦合。 */
import type { TemporaryModule } from "../../util/lib/code/scripts.types";

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


