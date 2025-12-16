import z from "zod";

/**
 * AI响应控制器的事件类型定义
 */
export const assistantResponseEventDefines = {
    // 响应内容变更事件
    contentChanged: {
        oldContent: z.string(),
        newContent: z.string(),
        timestamp: z.number()
    },
    // 流式传输状态变更事件
    streamingStateChanged: {
        isStreaming: z.boolean(),
        timestamp: z.number()
    },
    // 响应完成事件
    responseCompleted: {
        finalContent: z.string(),
        duration: z.number(),
        timestamp: z.number()
    },
    // 响应中止事件
    responseAborted: {
        content: z.string(),
        reason: z.string().optional(),
        timestamp: z.number()
    },
    // 暂停状态变更事件
    pauseStateChanged: {
        isPaused: z.boolean(),
        timestamp: z.number()
    },
    // 消息保存事件
    messageSaved: {
        message: z.object({
            role: z.literal("assistant"),
            content: z.string(),
            timestamp: z.number()
        }),
        totalMessages: z.number(),
        timestamp: z.number()
    },
    // 工具调用事件
    toolCallExecuted: {
        toolCode: z.string(),
        result: z.any(),
        isAsync: z.boolean(),
        timestamp: z.number()
    },
    // DOM内容变更事件
    domContentChanged: {
        oldContent: z.string(),
        newContent: z.string(),
        timestamp: z.number()
    }
} as const;
