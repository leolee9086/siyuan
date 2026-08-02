/**
 * 消息格式验证与样式工具
 *
 * 从 toread/MAGI/utils/messageFormatUtils.js 迁移，提供消息类型/状态/对齐验证
 * 以及消息样式类和状态图标的获取。
 */

// [TASK] T2.2 迁移composables和工具函数 - messageFormat

/**
 * 用途：引入样式参数类型定义，确保 getMessageStyleClasses 的输入结构在编译期被严格校验。
 * 使用范围：仅在当前 messageFormat 工具模块内部用于函数签名约束，不参与运行时逻辑，不对外产生额外副作用。
 * 解耦评估：该依赖为 TypeScript 类型依赖（type-only import），运行时会被擦除；若改为依赖注入/参数传递/事件发射，
 * 仍需在调用边界保留同等类型契约，无法降低实际耦合，反而会增加调用复杂度与维护成本。因此保持同目录类型模块的静态类型引用是当前最优解耦形态。
 */
import type { MessageStyleParams } from "./messageFormat.types";

/** 合法消息类型集合（消费者直接调用 .has(type) 进行验证） */
export const validMessageTypes: ReadonlySet<string> = new Set([
    "ai",
    "user",
    "system",
    "vote",
    "error",
    "consensus",
    "sse_stream",
    "default",
    "warning",
    "info",
]);

/** 合法状态类型集合（消费者直接调用 .has(status) 进行验证） */
export const validStatusTypes: ReadonlySet<string> = new Set([
    "default",
    "success",
    "error",
    "loading",
    "streaming",
    "pending",
    "warning",
]);

const STREAM_REPLY_TYPES: ReadonlySet<string> = new Set([
    "ai",
    "sse_stream",
    "melchior",
    "balthasar",
    "balthazar",
    "casper",
]);

/** 判断回复是否应使用聊天式流内容渲染，包括完成后仍需折叠的思考内容。 */
export function isStreamingReplyActivity(
    message: { type?: string; status?: string; content?: string } | undefined,
): boolean {
    if (!message) {
        return false;
    }
    if (message.content?.includes("<think>")) {
        return true;
    }
    if (message.type === "sse_stream") {
        return true;
    }
    return STREAM_REPLY_TYPES.has(message.type ?? "") &&
        (message.status === "loading" || message.status === "streaming");
}

/** 合法对齐方式集合（消费者直接调用 .has(alignment) 进行验证） */
export const validAlignments: ReadonlySet<string> = new Set([
    "left",
    "right",
    "center",
]);

/** 状态图标映射（消费者直接通过 statusIconMap[status] 获取图标） */
export const statusIconMap: Readonly<Record<string, string>> = {
    loading: "⌛",
    success: "✓",
    error: "✕",
    default: "",
    pending: "⋯",
    warning: "⚠",
};

/** 判断消息是否为流式消息（正在加载中的SSE流） */
export async function isStreamingMessage(
    message: { type?: string; status?: string; content?: string },
): Promise<boolean> {
    return isStreamingReplyActivity(message) &&
        (message.status === "loading" || message.status === "streaming");
}

/** 检查消息状态是否从loading转换为完成 */
export async function isStatusTransition(
    newStatus: string,
    oldStatus: string,
    content: string,
): Promise<boolean> {
    const wasStreaming = oldStatus === "loading" || oldStatus === "streaming";
    return newStatus !== "loading" && newStatus !== "streaming" && wasStreaming && !!content;
}

/** 根据消息属性生成CSS类名映射 */
export async function getMessageStyleClasses(
    params: MessageStyleParams,
): Promise<Record<string, boolean>> {
    return {
        [`type-${params.类型}`]: true,
        "has-actions": params.有操作插槽,
        "interactive": params.可交互,
        [`align-${params.对齐方式}`]: true,
    };
}
