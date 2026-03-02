/**
 * @fileoverview MockWISE SSE 桥接辅助函数
 * @description 负责从 OpenAI chunk 中提取可桥接字段，并构造统一的 SSE 行。
 */

/** @同步豁免: 性能考虑 - SSE chunk 桥接仅做同步内存解析，无I/O。 */
export const 提取桥接Chunk数据 = (
    choice: unknown,
): {
    index: number;
    content: string;
    toolCalls: unknown[];
    finishReason: string | null;
    hasPayload: boolean;
} => {
    const choiceObj = choice !== null && typeof choice === "object"
        ? choice
        : {};
    const rawDelta = Reflect.get(choiceObj, "delta");
    const deltaObj = rawDelta !== null && typeof rawDelta === "object"
        ? rawDelta
        : {};
    const rawIndex = Reflect.get(choiceObj, "index");
    const rawContent = Reflect.get(deltaObj, "content");
    const rawToolCalls = Reflect.get(deltaObj, "tool_calls");
    const rawFinishReason = Reflect.get(choiceObj, "finish_reason");
    const content = typeof rawContent === "string" ? rawContent : "";
    const toolCalls = Array.isArray(rawToolCalls) ? rawToolCalls : [];
    const finishReason = typeof rawFinishReason === "string" ? rawFinishReason : null;
    const hasExplicitFinishReason = rawFinishReason === null || typeof rawFinishReason === "string";
    return {
        index: typeof rawIndex === "number" ? rawIndex : 0,
        content,
        toolCalls,
        finishReason,
        hasPayload: Boolean(content || toolCalls.length > 0 || hasExplicitFinishReason),
    };
};

/** @同步豁免: 性能考虑 - 仅字符串序列化，不涉及异步状态。 */
export const 构建桥接SSE行 = (
    parsedChunk: { id?: string; created?: number; model?: string },
    bridgedChoice: {
        index: number;
        content: string;
        toolCalls: unknown[];
        finishReason: string | null;
    },
): string => {
    const delta: Record<string, unknown> = {};
    // 仅在存在可见文本增量时写入 content 字段。
    if (bridgedChoice.content) {
        delta.content = bridgedChoice.content;
    }
    // 仅在本 chunk 包含工具调用增量时写入 tool_calls 字段。
    if (bridgedChoice.toolCalls.length > 0) {
        delta.tool_calls = bridgedChoice.toolCalls;
    }
    return `data: ${JSON.stringify({
        id: parsedChunk.id,
        object: "chat.completion.chunk",
        created: parsedChunk.created,
        model: parsedChunk.model,
        choices: [{
            delta,
            index: bridgedChoice.index,
            finish_reason: bridgedChoice.finishReason,
        }],
    })}\n\n`;
};
