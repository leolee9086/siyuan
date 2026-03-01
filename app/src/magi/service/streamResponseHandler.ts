import { parseAndValidateStreamData } from "./sseParser";
import type { StreamResponseResult } from "./service.types";

/**
 * 处理OpenAI兼容格式的流式响应
 *
 * 作用：将单条SSE数据解析为内容增量或结束标记
 * 意图：纯函数，不直接修改状态，仅返回解析结果供调用方决策
 * 调用时机：每收到一条SSE消息时由 handleStreamMessage 调用
 *
 * @param dataStr - SSE data字段的原始JSON字符串
 * @returns 解析结果，包含内容增量、是否结束、可能的错误
 * @同步豁免: 性能考虑 - SSE流式回调的同步处理器，异步化会导致消息处理顺序不确定
 */
export const handleOpenAILikeStreamResponse = (
    dataStr: string,
): StreamResponseResult => {
    const data = parseAndValidateStreamData(dataStr);
    if (!data) {
        return {
            content: null,
            isFinished: false,
            error: new Error("接到了空的data,检查响应结构")
        };
    }
    if (!data.choices || data.choices.length === 0) {
        return {
            content: null,
            isFinished: false,
            error: new Error("响应结构不正确,检查响应结构")
        };
    }
    const choice = data.choices[0];
    if (!choice) {
        return {
            content: null,
            isFinished: false
        };
    }

    // 检查是否是结束标记
    if (choice.finish_reason === "stop") {
        return {
            content: null,
            isFinished: true
        };
    }

    // 优先处理 content 字段，如果没有则处理 reasoning_content 字段
    const content = choice.delta?.content || choice.message?.content;
    const reasoningContent = choice.delta?.reasoning_content || choice.message?.reasoning_content;

    // 处理普通内容
    if (typeof content === "string" && content.length > 0) {
        return { content, isFinished: false };
    }

    // 处理推理内容
    if (typeof reasoningContent === "string" && reasoningContent.length > 0) {
        return { content: reasoningContent, isFinished: false };
    }

    // 处理非字符串内容的情况
    if (content !== undefined && content !== null && content !== "") {
        console.warn("接收到非字符串内容:", content);
        return { content: String(content), isFinished: false };
    }

    // 处理非字符串推理内容的情况
    if (reasoningContent !== undefined && reasoningContent !== null && reasoningContent !== "") {
        console.warn("接收到非字符串推理内容:", reasoningContent);
        return { content: String(reasoningContent), isFinished: false };
    }

    // 空内容且不是结束标记，可能是流式数据的中间状态
    return { content: null, isFinished: false };
};
