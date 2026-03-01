/**
 * 消息格式验证与样式工具
 *
 * 从 toread/MAGI/utils/messageFormatUtils.js 迁移，提供消息类型/状态/对齐验证
 * 以及消息样式类和状态图标的获取。
 */

// [TASK] T2.2 迁移composables和工具函数 - messageFormat

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
    "pending",
    "warning",
]);

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
    message: { type?: string; status?: string },
): Promise<boolean> {
    return message?.type === "sse_stream" && message?.status === "loading";
}

/** 检查消息状态是否从loading转换为完成 */
export async function isStatusTransition(
    newStatus: string,
    oldStatus: string,
    content: string,
): Promise<boolean> {
    return newStatus !== "loading" && oldStatus === "loading" && !!content;
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
