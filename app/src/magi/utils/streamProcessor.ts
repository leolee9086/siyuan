/**
 * 流式消息处理器
 *
 * 从 toread/MAGI/utils/messageUtils.js 中的 处理流式消息 迁移。
 * 消费 MockWISE 的 AsyncGenerator 响应，通过回调驱动UI更新。
 */

// [TASK] T2.2 迁移composables和工具函数 - streamProcessor

import type { MagiMessage, StreamCallbacks, StreamResult } from "./messageFactory.types";
import { createMessage, createStreamMessage } from "./messageFactory";
import { isChunkPayload, extractDeltaContent } from "./streamProcessor.guard";

/**
 * 处理流式消息响应
 *
 * 消费 MockWISE.reply() 返回的 AsyncGenerator<string> 或普通 string，
 * 在流的不同阶段调用对应回调以驱动UI更新。
 *
 * @param response - MockWISE.reply() 的返回值（AsyncGenerator 或 string）
 * @param callbacks - 各阶段回调
 * @returns 最终内容和成功状态
 */
export async function processStreamResponse(
    response: string | AsyncGenerator<string>,
    callbacks: StreamCallbacks,
): Promise<StreamResult> {
    // 普通字符串响应直接走非流式路径
    if (typeof response === "string") {
        return handleStringResponse(response, callbacks);
    }

    return handleAsyncGeneratorResponse(response, callbacks);
}

/** 处理普通字符串响应 */
async function handleStringResponse(
    content: string,
    callbacks: StreamCallbacks,
): Promise<StreamResult> {
    const message = await createMessage("ai", content);
    message.status = "success";

    callbacks.onStart?.(message);
    callbacks.onChunk?.(message);
    callbacks.onComplete?.(message);

    return { content, success: true };
}

/** 处理 AsyncGenerator 流式响应 */
async function handleAsyncGeneratorResponse(
    generator: AsyncGenerator<string>,
    callbacks: StreamCallbacks,
): Promise<StreamResult> {
    const message = await createStreamMessage();
    let accumulated = "";

    callbacks.onStart?.(message);

    try {
        accumulated = await consumeStream(generator, message, callbacks);
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(err);
        return { content: accumulated, success: false };
    }

    message.content = accumulated;
    message.status = "success";
    message.type = "ai";
    callbacks.onComplete?.(message);

    return { content: accumulated, success: true };
}

/** 逐块消费 AsyncGenerator 并更新消息 */
async function consumeStream(
    generator: AsyncGenerator<string>,
    message: MagiMessage,
    callbacks: StreamCallbacks,
): Promise<string> {
    let accumulated = "";

    for await (const chunk of generator) {
        const content = await extractContentFromChunk(chunk);
        // 仅当提取到有效内容时才更新消息和触发回调
        if (content) {
            accumulated += content;
            message.content = accumulated;
            callbacks.onChunk?.(message);
        }
    }

    return accumulated;
}

/** 从SSE chunk中提取实际内容文本 */
async function extractContentFromChunk(chunk: string): Promise<string> {
    // [DONE] 标记表示流结束，无需提取内容
    if (chunk.includes("[DONE]")) {
        return "";
    }

    const dataPrefix = "data: ";
    const dataStart = chunk.indexOf(dataPrefix);
    // 包含 "data: " 前缀的chunk为SSE格式，需要解析JSON提取delta.content
    if (dataStart >= 0) {
        const jsonStr = chunk.slice(dataStart + dataPrefix.length).trim();
        return parseChunkJson(jsonStr);
    }

    // 不含SSE前缀的chunk视为纯文本直接返回
    return chunk;
}

/** 解析chunk中的JSON，通过类型守卫安全提取delta.content */
async function parseChunkJson(jsonStr: string): Promise<string> {
    try {
        const parsed: unknown = JSON.parse(jsonStr);
        // 通过类型守卫验证是否为OpenAI兼容的chunk结构
        if (isChunkPayload(parsed)) {
            return extractDeltaContent(parsed);
        }
    } catch {
        // JSON解析失败，将原始字符串作为内容返回
        return jsonStr;
    }
    return "";
}
