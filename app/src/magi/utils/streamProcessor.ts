/**
 * 流式消息处理器
 *
 * 从 toread/MAGI/utils/messageUtils.js 中的 处理流式消息 迁移。
 * 消费 MockWISE 的 AsyncGenerator 响应，通过回调驱动UI更新。
 */

// [TASK] T2.2 迁移composables和工具函数 - streamProcessor

import type { MagiMessage, StreamCallbacks, StreamResult } from "./messageFactory.types";
import type {
    ParsedChunkData,
    StreamProcessOptions,
    StreamToolCallDelta,
    ToolCallState,
} from "../types/streamProcessor.types";
import { createMessage, createStreamMessage } from "./messageFactory";
import { isChunkPayload, extractDeltaContent } from "./streamProcessor.guard";
import {
    TRINITY_SPEAK_TOOL_NAME,
    extractSpeakContentFromArguments,
} from "../core/wise/trinity.toolset";

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
    options: StreamProcessOptions = {},
): Promise<StreamResult> {
    // 普通字符串响应直接走非流式路径
    if (typeof response === "string") {
        return handleStringResponse(response, callbacks, options);
    }

    return handleAsyncGeneratorResponse(response, callbacks, options);
}

/** 处理普通字符串响应 */
async function handleStringResponse(
    content: string,
    callbacks: StreamCallbacks,
    options: StreamProcessOptions,
): Promise<StreamResult> {
    // Trinity 工具模式下禁止直接文本输出，必须走 speak tool。
    if (options.mode === "trinity-speak-tool") {
        callbacks.onError?.(new Error("Trinity 输出必须通过 speak 工具调用产生，检测到直接文本输出。"));
        return { content: "", success: false, hasToolCalls: false, toolCallNames: [] };
    }
    const message = await createMessage("ai", content);
    message.status = "success";

    callbacks.onStart?.(message);
    callbacks.onChunk?.(message);
    callbacks.onComplete?.(message);

    return { content, success: true, hasToolCalls: false, toolCallNames: [] };
}

/** 处理 AsyncGenerator 流式响应 */
async function handleAsyncGeneratorResponse(
    generator: AsyncGenerator<string>,
    callbacks: StreamCallbacks,
    options: StreamProcessOptions,
): Promise<StreamResult> {
    const message = await createStreamMessage();
    const toolState = createToolCallState();
    const shouldUseSpeakToolMode = options.mode === "trinity-speak-tool";
    const shouldCaptureToolCalls = options.captureToolCalls === true || shouldUseSpeakToolMode;
    const observedToolCallNames = new Set<string>();
    let hasAnyToolCall = false;
    let accumulated = "";

    callbacks.onStart?.(message);

    try {
        const consumed = await consumeStream(
            generator,
            message,
            callbacks,
            shouldUseSpeakToolMode,
            toolState,
            shouldCaptureToolCalls,
            observedToolCallNames,
        );
        accumulated = consumed.accumulated;
        hasAnyToolCall = consumed.hasAnyToolCall;
        // speak-tool 模式下必须检测到 speak 调用且解析出最终正文。
        if (shouldUseSpeakToolMode && (!toolState.hasSpeakToolCall || !toolState.spokenContent.trim())) {
            throw new Error("Trinity 未调用 speak 工具或 speak.content 为空。");
        }
        // 工具模式最终输出取 speak.content，而不是 assistant 直接文本。
        if (shouldUseSpeakToolMode) {
            accumulated = toolState.spokenContent;
        }
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks.onError?.(err);
        return buildToolAwareResult(accumulated, false, hasAnyToolCall, observedToolCallNames);
    }

    finalizeStreamMessage(message, accumulated, callbacks);
    return buildToolAwareResult(accumulated, true, hasAnyToolCall, observedToolCallNames);
}

/** 构建包含工具调用观测信息的统一返回结构 */
function buildToolAwareResult(
    content: string,
    success: boolean,
    hasToolCalls: boolean,
    toolCallNames: Set<string>,
): StreamResult {
    return {
        content,
        success,
        hasToolCalls,
        toolCallNames: Array.from(toolCallNames),
    };
}

/** 收尾流式消息状态并触发完成回调 */
function finalizeStreamMessage(
    message: MagiMessage,
    content: string,
    callbacks: StreamCallbacks,
): void {
    message.content = content;
    message.status = "success";
    message.type = "ai";
    callbacks.onComplete?.(message);
}

/** 逐块消费 AsyncGenerator 并更新消息 */
async function consumeStream(
    generator: AsyncGenerator<string>,
    message: MagiMessage,
    callbacks: StreamCallbacks,
    shouldUseSpeakToolMode: boolean,
    toolState: ToolCallState,
    shouldCaptureToolCalls: boolean,
    observedToolCallNames: Set<string>,
): Promise<{ accumulated: string; hasAnyToolCall: boolean }> {
    let accumulated = "";
    let lastSpoken = "";
    let hasAnyToolCall = false;

    for await (const chunk of generator) {
        const parsedChunk = await extractChunkDataFromChunk(chunk);
        const toolCallNames = collectToolCallNames(parsedChunk.toolCalls);
        const hasToolCalls = parsedChunk.toolCalls.length > 0 || toolCallNames.length > 0;
        // 默认模式下也可按需捕获工具调用，用于上层做精确分支判断。
        if (shouldCaptureToolCalls && hasToolCalls) {
            hasAnyToolCall = true;
            for (const name of toolCallNames) {
                observedToolCallNames.add(name);
            }
        }
        const shouldEmitPlainText = !shouldUseSpeakToolMode && Boolean(parsedChunk.content);
        // 默认模式下，只在存在文本增量时刷新流式内容。
        if (shouldEmitPlainText) {
            accumulated += parsedChunk.content;
            message.content = accumulated;
            callbacks.onChunk?.(message);
        }
        // 默认模式仅处理普通文本增量，不处理工具调用增量。
        if (!shouldUseSpeakToolMode) {
            continue;
        }
        // speak-tool 模式优先消费 tool_calls，并忽略直接文本内容。
        mergeToolCalls(toolState, parsedChunk.toolCalls);
        const spoken = resolveSpeakContent(toolState);
        const shouldEmitSpoken = Boolean(spoken && spoken !== lastSpoken);
        // 仅当解析出的可见文本发生变化时刷新流式显示。
        if (shouldEmitSpoken) {
            lastSpoken = spoken;
            message.content = spoken;
            callbacks.onChunk?.(message);
        }
    }

    return { accumulated, hasAnyToolCall };
}

/** 从SSE chunk中提取文本/工具调用增量 */
async function extractChunkDataFromChunk(chunk: string): Promise<{
    content: string;
    toolCalls: StreamToolCallDelta[];
}> {
    // [DONE] 标记表示流结束，无需提取内容
    if (chunk.includes("[DONE]")) {
        return { content: "", toolCalls: [] };
    }

    const dataPrefix = "data: ";
    const dataStart = chunk.indexOf(dataPrefix);
    // 包含 "data: " 前缀的chunk为SSE格式，需要解析JSON提取delta
    if (dataStart >= 0) {
        const jsonStr = chunk.slice(dataStart + dataPrefix.length).trim();
        return parseChunkJson(jsonStr);
    }

    // 不含SSE前缀的chunk视为纯文本直接返回
    return { content: chunk, toolCalls: [] };
}

/** 解析chunk中的JSON，通过类型守卫安全提取delta */
async function parseChunkJson(jsonStr: string): Promise<ParsedChunkData> {
    try {
        const parsed: unknown = JSON.parse(jsonStr);
        // 通过类型守卫验证是否为OpenAI兼容的chunk结构
        if (isChunkPayload(parsed)) {
            return {
                content: extractDeltaContent(parsed),
                toolCalls: extractToolCallsFromParsedChunk(parsed),
            };
        }
    } catch {
        // JSON解析失败，将原始字符串作为内容返回
        return { content: jsonStr, toolCalls: [] };
    }
    return { content: "", toolCalls: [] };
}

/** 从已解析 chunk 中提取 delta.tool_calls（仅取首个 choice） */
function extractToolCallsFromParsedChunk(parsed: unknown): StreamToolCallDelta[] {
    const choices = readObjectArrayField(parsed, "choices");
    // 非标准 chunk（缺失 choices）不产生工具调用增量。
    if (choices.length === 0) {
        return [];
    }
    const firstChoice = choices[0];
    const delta = readObjectField(firstChoice, "delta");
    const rawToolCalls = readObjectArrayField(delta, "tool_calls");
    const parsedCalls: StreamToolCallDelta[] = [];
    for (const item of rawToolCalls) {
        const next = toToolCallDelta(item);
        if (next) {
            parsedCalls.push(next);
        }
    }
    return parsedCalls;
}

/** 将未知 tool_call 增量归一化为本地结构 */
function toToolCallDelta(value: unknown): StreamToolCallDelta | null {
    const node = readObjectField(value, "__self__");
    const functionNode = readObjectField(node, "function");
    const name = readStringField(functionNode, "name");
    const argumentsChunk = readStringField(functionNode, "arguments");
    const rawIndex = Reflect.get(node, "index");
    const index = typeof rawIndex === "number" ? rawIndex : 0;
    const hasAnyPayload = Boolean(name || argumentsChunk);
    // 不含 name/arguments 的片段不参与聚合，避免污染状态。
    if (!hasAnyPayload) {
        return null;
    }
    return { index, name, argumentsChunk };
}

/** 读取对象字段；value 不是对象时返回空对象 */
function readObjectField(value: unknown, key: string): object {
    // 特殊键 "__self__" 表示直接把 value 当对象读取。
    if (key === "__self__" && value !== null && typeof value === "object") {
        return value;
    }
    if (value === null || typeof value !== "object") {
        return {};
    }
    const field = Reflect.get(value, key);
    return field !== null && typeof field === "object" ? field : {};
}

/** 读取对象数组字段；非法值返回空数组 */
function readObjectArrayField(value: unknown, key: string): unknown[] {
    if (value === null || typeof value !== "object") {
        return [];
    }
    const field = Reflect.get(value, key);
    return Array.isArray(field) ? field : [];
}

/** 读取字符串字段；非法值返回空字符串 */
function readStringField(value: unknown, key: string): string {
    if (value === null || typeof value !== "object") {
        return "";
    }
    const field = Reflect.get(value, key);
    return typeof field === "string" ? field : "";
}

/** 初始化工具调用聚合状态 */
function createToolCallState(): ToolCallState {
    return {
        namesByIndex: {},
        argsByIndex: {},
        hasSpeakToolCall: false,
        spokenContent: "",
    };
}

/** 合并一批 tool_call 增量到状态中 */
function mergeToolCalls(state: ToolCallState, toolCalls: StreamToolCallDelta[]): void {
    for (const toolCall of toolCalls) {
        const index = toolCall.index;
        const hasName = Boolean(toolCall.name && toolCall.name.trim());
        // name 增量用于确定当前 index 对应的工具名称。
        if (hasName) {
            state.namesByIndex[index] = toolCall.name;
        }
        const isSpeakName = hasName && toolCall.name === TRINITY_SPEAK_TOOL_NAME;
        // 一旦出现 speak 名称，即标记已发生 speak 工具调用。
        if (isSpeakName) {
            state.hasSpeakToolCall = true;
        }
        const hasArguments = Boolean(toolCall.argumentsChunk);
        // arguments 是增量分片，必须按 index 进行拼接。
        if (hasArguments) {
            const previous = state.argsByIndex[index] ?? "";
            state.argsByIndex[index] = `${previous}${toolCall.argumentsChunk}`;
        }
    }
}

/** 从聚合后的工具调用状态中解析 speak.content */
function resolveSpeakContent(state: ToolCallState): string {
    const indexes = Object.keys(state.namesByIndex)
        .map((key) => Number(key))
        .filter((key) => Number.isInteger(key))
        .sort((a, b) => a - b);
    for (const index of indexes) {
        if (state.namesByIndex[index] !== TRINITY_SPEAK_TOOL_NAME) {
            continue;
        }
        const rawArgs = state.argsByIndex[index] ?? "";
        const parsed = extractSpeakContentFromArguments(rawArgs);
        if (parsed) {
            state.spokenContent = parsed;
            return parsed;
        }
    }
    return "";
}

/** 提取当前 chunk 中出现的工具名称（去空值，不去重） */
function collectToolCallNames(toolCalls: StreamToolCallDelta[]): string[] {
    const names: string[] = [];
    for (const toolCall of toolCalls) {
        const name = toolCall.name.trim();
        if (name) {
            names.push(name);
        }
    }
    return names;
}
