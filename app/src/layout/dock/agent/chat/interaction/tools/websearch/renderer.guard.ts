/** 用途：验证原生 Agent 搜索结果载荷。使用范围：工具结果与会话历史。解耦评估：守卫隔离不可信 JSON，渲染器不使用断言。 */
import type {AgentWebSearchResponse} from "./types";

/** 验证搜索引用映射的键和值，供不可信工具结果解析时调用。 */
const isWebLinkMap = (value: unknown): value is Record<string, string> =>
    !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.entries(value).every(([key, target]) => /^ref:web-[0-9a-f]+$/.test(key) && typeof target === "string");

/** Reject malformed tool payloads before the renderer reads optional search fields. */
export const isAgentWebSearchResponse = (value: unknown): value is AgentWebSearchResponse => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    if (record.results !== undefined && !Array.isArray(record.results)) {
        return false;
    }
    return record.linkMap === undefined || isWebLinkMap(record.linkMap);
};
