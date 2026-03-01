import type { Ref } from "vue";

/**
 * UI状态上下文接口
 * 定义了流式聊天UI相关的状态管理
 */
export interface StreamChatUIContext {
    showResponseContainer: Ref<boolean>;
    statusText: Ref<string>;
    statusColor: Ref<string>;
    dots: Ref<string>;
    dotsInterval: Ref<ReturnType<typeof setInterval> | null>;
}

/**
 * UI状态管理返回类型
 */
export interface StreamChatUIReturn {
    showResponseContainer: Ref<boolean>;
    statusText: Ref<string>;
    statusColor: Ref<string>;
    dots: Ref<string>;
    showResponse: () => void;
    setCompleteStatus: () => void;
    setErrorStatus: (error: Error) => void;
    setAbortStatus: () => void;
    stopAnimation: () => void;
}
