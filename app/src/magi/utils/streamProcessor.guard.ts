/**
 * 流式消息处理类型守卫
 *
 * 为 streamProcessor.ts 提供SSE chunk JSON解析的类型安全验证。
 */

// [TASK] T2.2 迁移composables和工具函数 - streamProcessor.guard

/** SSE chunk中的delta内容结构 */
interface ChunkDelta {
    content?: string;
}

/** SSE chunk中的choice结构 */
interface ChunkChoice {
    delta: ChunkDelta;
    index: number;
    finish_reason: string | null;
}

/** SSE chunk的OpenAI兼容JSON结构 */
interface ChunkPayload {
    choices: ChunkChoice[];
}

/** 验证parsed JSON是否为有效的SSE chunk payload */
export const isChunkPayload = (value: unknown): value is ChunkPayload => {
    if (value === null || typeof value !== "object") {
        return false;
    }
    if (!("choices" in value)) {
        return false;
    }
    const obj = value as Record<string, unknown>;
    return Array.isArray(obj.choices);
};

/**
 * 从已验证的chunk payload中提取delta.content文本
 *
 * @returns 提取到的内容文本，无内容时返回空字符串
 */
export const extractDeltaContent = (payload: ChunkPayload): string => {
    const firstChoice: ChunkChoice | undefined = payload.choices[0];
    if (!firstChoice?.delta) {
        return "";
    }
    return typeof firstChoice.delta.content === "string"
        ? firstChoice.delta.content
        : "";
};
