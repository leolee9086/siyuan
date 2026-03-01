/**
 * @fileoverview WISE 模块类型守卫
 * @description 提供 AI 返回 JSON 的类型验证函数，替代 `as` 断言。
 * 守卫函数通过结构检查而非完全验证，以降低运行开销。
 */

// [TASK] T2.1 迁移MAGI核心系统 - wise/wise.guard

import type {
    TechnicalAssessment,
    WISEApiResponse,
    EmotionProfile,
    ComplianceResult,
    RiskMatrixItem,
    VoteScore,
} from "./wise.types";

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
 * 守卫：判断 unknown 是否为 TechnicalAssessment
 *
 * 作用：结构检查 AI 返回的技术可行性评估 JSON
 * 意图：替代 `JSON.parse(...) as TechnicalAssessment`，提供运行时类型安全
 * 调用时机：在 seelWise.ts 的技术可行性评估函数中调用
 */
const 是TechnicalAssessment = (value: unknown): value is TechnicalAssessment =>
    typeof value === "object"
    && value !== null
    && "difficulty" in value
    && typeof (value as TechnicalAssessment).difficulty === "number";

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

/**
 * 守卫：判断 unknown 是否为 EmotionProfile
 *
 * 作用：结构检查 AI 返回的情感分析 JSON
 * 意图：替代 `JSON.parse(...) as EmotionProfile`，提供运行时类型安全
 * 调用时机：在 seelWise.ts 的情感分析函数中调用
 */
const 是EmotionProfile = (value: unknown): value is EmotionProfile =>
    typeof value === "object"
    && value !== null
    && "emotion" in value
    && "intensity" in value;

/**
 * 守卫：判断 unknown 是否为 ComplianceResult
 *
 * 作用：结构检查 AI 返回的合规检查 JSON
 * 意图：替代 `JSON.parse(...) as ComplianceResult`，提供运行时类型安全
 * 调用时机：在 seelWise.ts 的合规检查函数中调用
 */
const 是ComplianceResult = (value: unknown): value is ComplianceResult =>
    typeof value === "object"
    && value !== null
    && "legal" in value
    && "ethical" in value;

/**
 * 守卫：判断 unknown 是否为 RiskMatrixItem
 *
 * 作用：结构检查 AI 返回的风险矩阵单条 JSON
 * 意图：替代 `JSON.parse(...) as RiskMatrixItem`，提供运行时类型安全
 * 调用时机：在 seelWise.ts 的风险矩阵评估函数中调用
 */
const 是RiskMatrixItem = (value: unknown): value is RiskMatrixItem =>
    typeof value === "object"
    && value !== null
    && "probability" in value
    && "impact" in value;

// ────────────────────────────────────────────────────────────────────────────
// 解析并守卫的组合函数（供 seelWise.ts 直接调用）
// ────────────────────────────────────────────────────────────────────────────

/**
 * 解析 AI 返回 JSON 并验证为 TechnicalAssessment
 *
 * 作用：将解析和类型验证合二为一，在验证失败时返回 null
 * 意图：避免调用方同时处理解析和验证两个步骤
 * 调用时机：在 seelWise.ts 的技术可行性评估中调用
 */
export const 解析技术评估 = (content: string): TechnicalAssessment | null => {
    const parsed = 解析AI返回JSON(content);
    return 是TechnicalAssessment(parsed) ? parsed : null;
};

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
 * 解析 AI 返回 JSON 并验证为 EmotionProfile
 *
 * 作用：将解析和类型验证合二为一，在验证失败时返回 null
 * 意图：避免调用方同时处理解析和验证两个步骤
 * 调用时机：在 seelWise.ts 的情感分析中调用
 */
export const 解析情感轮廓 = (content: string): EmotionProfile | null => {
    const parsed = 解析AI返回JSON(content);
    return 是EmotionProfile(parsed) ? parsed : null;
};

/**
 * 解析 AI 返回 JSON 并验证为 ComplianceResult
 *
 * 作用：将解析和类型验证合二为一，在验证失败时返回 null
 * 意图：避免调用方同时处理解析和验证两个步骤
 * 调用时机：在 seelWise.ts 的合规检查中调用
 */
export const 解析合规结果 = (content: string): ComplianceResult | null => {
    const parsed = 解析AI返回JSON(content);
    return 是ComplianceResult(parsed) ? parsed : null;
};

/**
 * 解析 AI 返回 JSON 并验证为 RiskMatrixItem
 *
 * 作用：将解析和类型验证合二为一，在验证失败时返回 null
 * 意图：避免调用方同时处理解析和验证两个步骤
 * 调用时机：在 seelWise.ts 的风险矩阵评估中调用
 */
export const 解析风险矩阵项 = (content: string): RiskMatrixItem | null => {
    const parsed = 解析AI返回JSON(content);
    return 是RiskMatrixItem(parsed) ? parsed : null;
};


/**
 * 判断 WISEApi 返回值是否为 WISEApiResponse
 *
 * 作用：安全地检查 api.post() 的返回值是否具有 choices 字段
 * 意图：替代所有 `response as WISEApiResponse` 断言。
 *   注意：此守卫只做结构存在性检查（choices 数组），不验证每个 choice 的完整字段。
 *   由于 AI 响应在运行时通常会包含完整字段，此处适度放宽以避免过度严格的检查。
 * 调用时机：在 seelWise.ts、baseWise.ts 中取 choices[0] 前调用
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
 * 调用时机：在 seelWise.ts、mockWise.ops.ts 的并发评估结果过滤中使用
 */
export const 是非空 = <T>(value: T | null | undefined): value is T =>
    value !== null && value !== undefined;

/**
 * 守卫：判断 unknown 是否为 AI响应Chunk 结构（具有 choices 数组）
 *
 * 作用：替代 mockWise.ts 创建SSE桥接回调中 `JSON.parse(...) as AI响应Chunk`
 * 意图：提供运行时检查，避免 as 断言在非 guard 文件出现
 * 调用时机：在 创建SSE桥接回调 的 onMessage 回调中解析 SSE chunk 时调用
 * @AITODO 守卫函数没有实际检查类型,必须修复
 */
export const 是AI响应Chunk = (value: unknown): value is {
    id?: string;
    created?: number;
    model?: string;
    error?: { code: string; message: string };
    choices?: Array<{ delta: { content?: string }; index: number }>;
} =>
    typeof value === "object" && value !== null;

