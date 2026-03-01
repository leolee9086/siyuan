/**
 * MAGI 会话相关统一类型定义
 *
 * 合并来源：
 * - streamChat.types.ts 的 StreamHandlers
 * - session/session.types.ts 的 StreamResponseHandlers
 * - streamChat.types.ts 的 MessageHistory
 */

/**
 * 流式响应处理器接口
 *
 * 用途：定义流式AI响应生命周期中各阶段的回调处理函数
 * 使用场景：在流式聊天会话中处理消息接收、完成、错误和中止事件
 */
export interface StreamResponseHandlers {
    onMessage: (dataStr: string) => void;
    onDone: () => void;
    onError: (error: Error) => void;
    onAbort: () => void;
}

/**
 * 消息历史记录类型
 *
 * 用途：表示聊天会话中的消息序列
 */
export type MessageHistory = Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: number;
}>;
