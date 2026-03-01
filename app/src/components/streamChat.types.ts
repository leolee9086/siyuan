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