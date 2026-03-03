/**
 * @fileoverview MockWISE SSE 桥接辅助函数
 * @description 负责从 OpenAI chunk 中提取可桥接字段，并构造统一的 SSE 行。
 */

import type { ContextMessage } from "../core.types";
import type { MockWISE内部状态 } from "./wise.types";

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

/** @同步豁免: 性能考虑 - 仅内存数组追加，无异步依赖。 */
export const 执行追加上下文消息 = (
    内部状态: MockWISE内部状态,
    messages: ContextMessage[],
): void => {
    if (!Array.isArray(messages) || messages.length === 0) {
        return;
    }
    内部状态.contextMessages.push(...messages);
};

/** @同步豁免: 性能考虑 - 仅内存数组尾向扫描与单点替换，无异步依赖。 */
export const 执行替换最近Assistant上下文消息 = (
    内部状态: MockWISE内部状态,
    content: string,
): void => {
    const normalized = typeof content === "string" ? content.trim() : "";
    if (!normalized) {
        return;
    }
    for (let index = 内部状态.contextMessages.length - 1; index >= 0; index -= 1) {
        const message = 内部状态.contextMessages[index];
        if (message.role !== "assistant") {
            continue;
        }
        内部状态.contextMessages[index] = {
            ...message,
            content: normalized,
            timestamp: Date.now(),
        };
        return;
    }
    内部状态.contextMessages.push({
        role: "assistant",
        content: normalized,
        timestamp: Date.now(),
    });
};
