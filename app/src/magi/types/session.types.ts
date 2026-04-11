/**
 * MAGI 会话相关统一类型定义
 *
 * 合并来源：
 * - streamChat.types.ts 的 StreamHandlers
 * - session/session.types.ts 的 StreamResponseHandlers
 * - streamChat.types.ts 的 MessageHistory
 */

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
