/**
 * 用途：导入标准 LLM 流式 chunk 契约，用于把未知 JSON 值收窄为业务类型。
 * 使用范围：仅用于 MAGI 后端 SSE 边界校验。
 * 解耦评估：这是编译期契约依赖，参数注入不会减少运行时耦合。
 */
import type { StandardLLMStreamChunk } from "./imports";

/**
 * 作用：验证未知值是否符合 Agent Panel 消费所需的最小 OpenAI chunk 结构。
 * 意图：阻止畸形或非对象 SSE JSON 通过类型断言进入消息链路。
 * 调用时机：MAGI backend adapter 解析每个 SSE data 事件后调用。
 */
export function isStandardLLMStreamChunk(value: unknown): value is StandardLLMStreamChunk {
    if (!value || typeof value !== "object") {
        return false;
    }
    const error = Reflect.get(value, "error");
    if (error && typeof error === "object" && typeof Reflect.get(error, "message") === "string") {
        return true;
    }
    const choices = Reflect.get(value, "choices");
    if (!Array.isArray(choices) || choices.length === 0) {
        return false;
    }
    const choice = choices[0];
    if (!choice || typeof choice !== "object") {
        return false;
    }
    const delta = Reflect.get(choice, "delta");
    const finishReason = Reflect.get(choice, "finish_reason");
    return Boolean(delta && typeof delta === "object") &&
        (finishReason === undefined || finishReason === null || typeof finishReason === "string");
}
