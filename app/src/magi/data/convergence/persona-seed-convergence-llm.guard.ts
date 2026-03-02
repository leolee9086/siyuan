import type { DescriptionToQuestionnaireLLMItem, DescriptionToQuestionnaireLLMResponse } from "./persona-seed-convergence-llm.types";

/**
 * 作用：判断未知值是否是对象记录。
 * 意图：在解析模型响应时避免直接解构 unknown 导致运行时异常。
 * 调用时机：各级守卫函数最前置判断。
 * 问题/改进：目前只做浅层对象校验，深层字段交由下游守卫完成。
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

/**
 * 作用：判断未知值是否是合法 Likert 5 级分值。
 * 意图：确保模型建议分值始终在问卷允许范围内。
 * 调用时机：校验 LLM 建议项 score 字段时调用。
 * 问题/改进：若未来改为 7 级量表需同步调整。
 */
function isLikertScore(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
    return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * 作用：校验 LLM 返回的单条建议项结构。
 * 意图：过滤不完整或字段类型错误的模型输出。
 * 调用时机：校验 suggestions 数组项时调用。
 * 问题/改进：当前未限制 reason 长度，可在后续增加阈值控制。
 */
export function isDescriptionToQuestionnaireLLMItem(value: unknown): value is DescriptionToQuestionnaireLLMItem {
    if (!isRecord(value)) {
        return false;
    }
    const q = Reflect.get(value, "q");
    const score = Reflect.get(value, "score");
    const confidence = Reflect.get(value, "confidence");
    const reason = Reflect.get(value, "reason");
    return (
        typeof q === "number"
        && Number.isInteger(q)
        && isLikertScore(score)
        && typeof confidence === "number"
        && Number.isFinite(confidence)
        && typeof reason === "string"
    );
}

/**
 * 作用：校验 LLM 响应是否符合目标结构。
 * 意图：统一校验入口，保证上游业务只处理合法数据。
 * 调用时机：解析 JSON 后进入建议转换前调用。
 * 问题/改进：后续可扩展 response schema 版本字段。
 */
export function isDescriptionToQuestionnaireLLMResponse(value: unknown): value is DescriptionToQuestionnaireLLMResponse {
    if (!isRecord(value)) {
        return false;
    }
    const suggestions = Reflect.get(value, "suggestions");
    if (!Array.isArray(suggestions)) {
        return false;
    }
    for (const item of suggestions) {
        // 任一建议项不合法即判定整体无效，避免部分脏数据污染。
        if (!isDescriptionToQuestionnaireLLMItem(item)) {
            return false;
        }
    }
    return true;
}
