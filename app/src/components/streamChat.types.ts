import type { AssistantResponseState } from "../ai/session/session.types";
import type { StreamResponseResult } from "../ai/handleOpenAILikeStreamResponse";

/**
 * 业务逻辑依赖接口
 * 定义了流式聊天所需的所有业务操作
 */
export interface StreamChatBusinessLogic {
    buildRequestHeaders: () => Record<string, string>;
    handleOpenAILikeStreamResponse: (dataStr: string, currentContent: string) => StreamResponseResult;
    updateChatState: (state: AssistantResponseState, updates: Partial<AssistantResponseState>) => void;
    processBlockDOMContent: (state: AssistantResponseState, protyle: IProtyle) => string;
    universalStreamRequest: (request: any, callbacks: any) => Promise<(() => void) | null>;
    getAIConfigFromSiyuan: () => any;
}

/**
 * UI状态上下文接口
 * 定义了流式聊天UI相关的状态管理
 */
export interface StreamChatUIContext {
    showResponseContainer: { value: boolean };
    statusText: { value: string };
    statusColor: { value: string };
    dots: { value: string };
    dotsInterval: { value: NodeJS.Timeout | null };
}

/**
 * 流式响应处理器接口
 * 定义了处理流式响应的各种回调函数
 */
export interface StreamHandlers {
    onMessage: (dataStr: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onAbort: () => void;
}

/**
 * 消息历史记录类型
 */
export type MessageHistory = Array<{ 
    role: "user" | "assistant"|"system"; 
    content: string; 
    timestamp: number 
}>;

/**
 * AI请求参数类型
 */
export interface AIRequestParams {
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    timeout: number;
    signal: AbortSignal;
}

/**
 * UI状态管理返回类型
 */
export interface StreamChatUIReturn {
    showResponseContainer: { value: boolean };
    statusText: { value: string };
    statusColor: { value: string };
    dots: { value: string };
    showResponse: () => void;
    setCompleteStatus: () => void;
    setErrorStatus: (error: Error) => void;
    setAbortStatus: () => void;
    stopAnimation: () => void;
}