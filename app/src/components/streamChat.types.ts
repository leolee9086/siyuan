/** 用途：Vue 响应式引用类型。使用范围：流式聊天 UI 状态定义。解耦评估：类型导入，不涉及运行时耦合。 */
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
