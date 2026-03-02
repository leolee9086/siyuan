import type { 二元决策 } from "./realVote.types";

/**
 * 判断未知值是否为普通对象记录
 *
 * 作用：为后续 Reflect 读取提供类型收窄。
 * 意图：避免在业务文件使用 `as` 断言。
 * 调用时机：解析模型响应 JSON 时调用。
 */
export function 是记录(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object";
}

/**
 * 判断未知值是否为合法二元决策
 *
 * 作用：校验模型输出中的 decision 字段。
 * 意图：确保最终只接受 “批准/否决” 两个值。
 * 调用时机：解析 JSON 与文本回退时调用。
 */
export function 是二元决策(value: unknown): value is 二元决策 {
    return value === "批准" || value === "否决";
}
