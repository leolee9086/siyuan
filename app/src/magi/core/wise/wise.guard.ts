/**
 * @fileoverview WISE 模块类型守卫
 * @description 提供 AI 返回 JSON 的类型验证函数，替代 `as` 断言。
 * 守卫函数通过结构检查而非完全验证，以降低运行开销。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/wise.guard

import type { WISEApiResponse } from "./wise.types";
import type { VoteScore } from "../core.types";

// ────────────────────────────────────────────────────────────────────────────
// JSON 解析辅助
// ────────────────────────────────────────────────────────────────────────────

/**
 * 将 AI 返回的可能带有 ```json 代码块包裹的字符串解析为 unknown
 *
 * 作用：统一处理 AI 格式不一致的情况（有时带 markdown 代码块，有时不带）
 * 意图：集中管理 JSON 解析逻辑，避免各调用点重复实现
 * 调用时机：在所有解析 AI 返回 JSON 的守卫函数内部调用
 */
const 解析AI返回JSON = (content: string): unknown => {
    const 净化内容 = content.startsWith("```json")
        ? content.replace(/```json/g, "").replace(/```/g, "")
        : content;
    return JSON.parse(净化内容);
};

// ────────────────────────────────────────────────────────────────────────────
// 类型守卫函数
// ────────────────────────────────────────────────────────────────────────────

/**
 * 守卫：判断 unknown 是否为 VoteScore 数组
 *
 * 作用：结构检查 AI 返回的投票分数 JSON 数组
 * 意图：替代 `JSON.parse(...) as VoteScore[]`，提供运行时类型安全
 * 调用时机：在 baseWise.ts 的执行投票请求函数中调用
 */
const 是VoteScore数组 = (value: unknown): value is VoteScore[] =>
    Array.isArray(value)
    && (value.length === 0
        || (typeof value[0] === "object"
            && value[0] !== null
            && "score" in value[0]));

// ────────────────────────────────────────────────────────────────────────────
// 解析并守卫的组合函数（供 wise 子模块调用）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 解析 AI 返回 JSON 并验证为 VoteScore 数组
 *
 * 作用：将解析和类型验证合二为一，在验证失败时返回 null
 * 意图：避免调用方同时处理解析和验证两个步骤
 * 调用时机：在 baseWise.ts 的执行投票请求中调用
 */
export const 解析投票结果 = (content: string): VoteScore[] | null => {
    const parsed = 解析AI返回JSON(content);
    return 是VoteScore数组(parsed) ? parsed : null;
};

/**
 * 判断 WISEApi 返回值是否为 WISEApiResponse
 *
 * 作用：安全地检查 api.post() 的返回值是否具有 choices 字段
 * 意图：替代所有 `response as WISEApiResponse` 断言。
 *   注意：此守卫只做结构存在性检查（choices 数组），不验证每个 choice 的完整字段。
 *   由于 AI 响应在运行时通常会包含完整字段，此处适度放宽以避免过度严格的检查。
 * 调用时机：在 baseWise.ts 等处理 API 响应并取 choices[0] 前调用
 */
export const 是WISEApiResponse = (value: unknown): value is WISEApiResponse =>
    typeof value === "object"
    && value !== null
    && "choices" in value
    && Array.isArray((value as { choices: unknown }).choices);


/**
 * 通用非空守卫（供 .filter() 中使用，以避免 filter 回调里使用 is 关键字触发 lint）
 *
 * 作用：类型安全地过滤掉数组中的 null/undefined 元素
 * 意图：让 filter(是非空) 代替 filter((r): r is T => r !== null)，
 *   确保 is 关键字的 type predicate 只在 guard 文件中出现
 * 调用时机：在 mockWise.ops.ts 的并发评估结果过滤中使用
 */
export const 是非空 = <T>(value: T | null | undefined): value is T =>
    value !== null && value !== undefined;

/**
 * 守卫：判断单个 choices 项是否满足 AI响应Chunk 最小结构
 *
 * 作用：校验每个 choice 是否包含 delta/index，并约束 content 为 string 或 undefined。
 * 意图：将每项校验逻辑从 是AI响应Chunk 中拆出，避免内联回调过长并提升可读性。
 * 调用时机：仅在 是AI响应Chunk 校验 choices 数组时通过 every 调用。
 * 问题/改进：当前仅覆盖最小必要字段，若后续需要更严格校验可补充 finish_reason 等字段。
 */
const 是合法ChunkChoice = (项: unknown): boolean => {
    if (typeof 项 !== "object" || 项 === null || !("delta" in 项) || !("index" in 项)) {
        return false;
    }
    const delta = (项 as { delta: unknown }).delta;
    const index = (项 as { index: unknown }).index;
    if (typeof delta !== "object" || delta === null || typeof index !== "number") {
        return false;
    }
    if (!("content" in delta)) {
        return true;
    }
    const content = (delta as { content: unknown }).content;
    return content === undefined || typeof content === "string";
};

/**
 * 守卫：判断 unknown 是否为 AI响应Chunk 结构（具有 choices 数组）
 *
 * 作用：替代 mockWise.ts 创建SSE桥接回调中 `JSON.parse(...) as AI响应Chunk`
 * 意图：提供运行时检查，避免 as 断言在非 guard 文件出现
 * 调用时机：在 创建SSE桥接回调 的 onMessage 回调中解析 SSE chunk 时调用
 * @AIDONE 已补全结构校验：要求对象，且 error/choices 若存在需满足最小字段约束
 */
export const 是AI响应Chunk = (value: unknown): value is {
    id?: string;
    created?: number;
    model?: string;
    error?: { code: string; message: string };
    choices?: Array<{ delta: { content?: string }; index: number }>;
} => {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const 候选 = value as {
        error?: unknown;
        choices?: unknown;
    };

    const error合法 = 候选.error === undefined
        || (typeof 候选.error === "object"
            && 候选.error !== null
            && "code" in 候选.error
            && "message" in 候选.error
            && typeof (候选.error as { code: unknown }).code === "string"
            && typeof (候选.error as { message: unknown }).message === "string");

    const choices合法 = 候选.choices === undefined
        || (Array.isArray(候选.choices) && 候选.choices.every(是合法ChunkChoice));

    return error合法 && choices合法;
};

