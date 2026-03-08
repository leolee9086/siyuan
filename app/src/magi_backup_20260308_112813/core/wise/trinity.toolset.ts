/**
 * @fileoverview Trinity 专属工具集
 * @description 负责定义 Trinity 的 speak 工具，并提供工具调用参数解析能力。
 */

import type {
    ReplyOptions,
} from "../core.types";

export const TRINITY_SPEAK_TOOL_NAME = "speak";
export type TrinitySpeakChannel = "public" | "internal";

export interface TrinitySpeakPayload {
    content: string;
    channel: TrinitySpeakChannel;
}

/**
 * Trinity 工具调用约束提示词
 *
 * 作用：强制 Trinity 通过 speak 工具输出最终对外内容，禁止直接文本作答。
 * 调用时机：Trinity 角色拼接 system 提示词中注入。
 */
export const TRINITY_SPEAK_TOOL_PROMPT = `你必须通过工具函数 speak 输出最终回答，禁止直接输出最终正文。
调用规则：
1. 对外给用户的正文，必须通过 speak 输出，且 channel="public"。
2. 允许使用 speak 的 channel="internal" 发送内部报告，此类内容不会对外暴露。
3. speak 参数必须是 JSON，且包含 content 字段（string）。
4. channel 可选，缺省按 channel="public" 处理。
5. think_about 是遇到输入时用于思考的内部工具消息，消息格式为 <think_about>{"input":"..."}</think_about>。
6. <think_result>...</think_result> 是 think_about 的内部结果，不是最终对外回复。
7. 除工具调用外，不要输出任何面向用户的正文。`;

const TRINITY_SPEAK_TOOL_SCHEMA: Record<string, unknown> = {
    type: "function",
    function: {
        name: TRINITY_SPEAK_TOOL_NAME,
        description: "向外部用户输出 Trinity 的最终回答正文。",
        parameters: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "最终可见回答正文。",
                },
                channel: {
                    type: "string",
                    enum: ["public", "internal"],
                    description: "消息通道。public 对外可见，internal 仅内部可见。",
                },
            },
            required: ["content"],
            additionalProperties: false,
        },
    },
};

const TRINITY_SPEAK_TOOL_CHOICE: Record<string, unknown> = {
    type: "function",
    function: { name: TRINITY_SPEAK_TOOL_NAME },
};

const SPEAK_CONTENT_KEYS = ["content", "text", "message", "speech"];
const SPEAK_CHANNEL_KEYS = ["channel", "scope", "target"];

function normalizeSpeakChannel(rawChannel: unknown): TrinitySpeakChannel {
    return rawChannel === "internal" ? "internal" : "public";
}

/** 构建 Trinity reply 的工具配置（固定为 speak 工具强制调用） */
/** @同步豁免: 性能考虑 - 纯对象构建，无异步依赖。 */
export function buildTrinityToolReplyOptions(options: ReplyOptions = {}): ReplyOptions {
    return {
        ...options,
        tools: [TRINITY_SPEAK_TOOL_SCHEMA],
        toolChoice: TRINITY_SPEAK_TOOL_CHOICE,
    };
}

/**
 * 从 speak 工具 arguments JSON 中提取最终文本
 *
 * 兼容字段优先级：content -> text -> message -> speech
 */
/** @同步豁免: 性能考虑 - 仅本地 JSON 解析，无异步依赖。 */
export function extractSpeakContentFromArguments(rawArguments: string): string | null {
    const payload = extractSpeakPayloadFromArguments(rawArguments);
    return payload?.content ?? null;
}

/** @同步豁免: 性能考虑 - 仅本地 JSON 解析，无异步依赖。 */
export function extractSpeakPayloadFromArguments(rawArguments: string): TrinitySpeakPayload | null {
    const trimmed = rawArguments.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }
        let content: string | null = null;
        for (const key of SPEAK_CONTENT_KEYS) {
            const value = Reflect.get(parsed, key);
            if (typeof value === "string" && value.trim()) {
                content = value.trim();
                break;
            }
        }
        if (!content) {
            return null;
        }
        let channel: TrinitySpeakChannel = "public";
        for (const key of SPEAK_CHANNEL_KEYS) {
            const value = Reflect.get(parsed, key);
            if (typeof value === "string") {
                channel = normalizeSpeakChannel(value.trim());
                break;
            }
        }
        return { content, channel };
    } catch {
        return null;
    }
}
