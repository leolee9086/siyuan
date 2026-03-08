import { createPendingSuggestion } from "../persona-seed-convergence";
import { isQuestionnaireToDescriptionLLMResponse } from "./persona-seed-convergence-q2d-llm.guard";
import type { QuestionnaireToDescriptionSuggestionInput } from "./persona-seed-convergence-q2d-llm.types";
import type { PersonaConvergenceSuggestion } from "../persona-seed-convergence.types";

/**
 * 作用：剥离模型输出中的 markdown fence 包裹。
 * 意图：兼容模型偶发返回 ```json ... ``` 的响应形式。
 * 调用时机：JSON.parse 前调用。
 * 问题/改进：当前只处理首尾 fence，后续可增强异常嵌套容错。
 */
function stripMarkdownFence(content: string): string {
    const trimmed = content.trim();
    // 非 fence 包裹时直接返回原文本。
    if (!trimmed.startsWith("```")) {
        return trimmed;
    }
    const firstBreakIndex = trimmed.indexOf("\n");
    // 只有起始 fence 无正文时，直接移除 fence 字符。
    if (firstBreakIndex < 0) {
        return trimmed.replace(/```/g, "").trim();
    }
    const body = trimmed.slice(firstBreakIndex + 1);
    const lastFenceIndex = body.lastIndexOf("```");
    // 无结束 fence 时按全文正文兜底。
    if (lastFenceIndex < 0) {
        return body.trim();
    }
    return body.slice(0, lastFenceIndex).trim();
}

/**
 * 作用：安全执行 JSON 解析。
 * 意图：避免模型输出非法 JSON 时抛错中断流程。
 * 调用时机：strip 后内容解析时调用。
 * 问题/改进：当前仅返回 null，后续可补充错误类型上报。
 */
function parseJSONSafely(content: string): unknown {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * 作用：标准化建议理由文本。
 * 意图：保证 UI 展示 reason 字段始终有值。
 * 调用时机：转换模型输出为 convergence 建议时调用。
 * 问题/改进：后续可增加模板化理由结构。
 */
function normalizeReason(reason: string, fieldLabel: string): string {
    const trimmed = reason.trim();
    if (trimmed) {
        return trimmed;
    }
    return `基于问卷作答补充${fieldLabel}`;
}

/**
 * 作用：将字段 key 映射为提示文案。
 * 意图：用于 reason 兜底文本，提升可读性。
 * 调用时机：建议转换时调用。
 * 问题/改进：可复用 PersonaSeedPanel.utils 标签映射以减少重复。
 */
function toFieldLabel(field: string): string {
    if (field === "professionalDescription") {
        return "职业描述";
    }
    if (field === "lifeDescription") {
        return "生活描述";
    }
    if (field === "instinctNeedsDescription") {
        return "本能需求描述";
    }
    return "综合描述";
}

/**
 * 作用：把模型响应转换为单条 pending 建议列表。
 * 意图：硬性约束“一次只更新一个侧面描述”。
 * 调用时机：JSON 校验通过后调用。
 * 问题/改进：后续若支持批量可新增数组版本解析器。
 */
function convertSuggestion(
    parsed: unknown,
    input: QuestionnaireToDescriptionSuggestionInput,
): readonly PersonaConvergenceSuggestion[] {
    if (!isQuestionnaireToDescriptionLLMResponse(parsed)) {
        return [];
    }
    const field = parsed.suggestion.field;
    // 综合描述仅在允许条件达成时可进入建议流。
    if (field === "integratedDescription" && !input.allowIntegratedSuggestion) {
        return [];
    }
    // 指定维度生成时，拒绝任何非目标维度输出。
    if (input.preferredField && field !== input.preferredField) {
        return [];
    }
    const text = parsed.suggestion.text.trim();
    // 空建议文本不进入确认流，避免污染手写描述。
    if (!text) {
        return [];
    }
    const suggestion = createPendingSuggestion({
        id: `q2d_${field}_1`,
        source: "questionnaire_to_description",
        target: field,
        confidence: parsed.suggestion.confidence,
        reason: normalizeReason(parsed.suggestion.reason, toFieldLabel(field)),
        payload: {
            kind: "description_append",
            field,
            text,
            separator: "\n\n",
        },
    });
    return [suggestion];
}

/**
 * 作用：将问卷->描述模型输出 content 解析为 convergence 建议。
 * 意图：提供可测试的纯转换入口，隔离网络与 UI。
 * 调用时机：LLM completion 返回后调用。
 * 问题/改进：当前 input 仅用于未来扩展，后续可利用答案上下文做二次规则过滤。
 */
export async function parseQuestionnaireToDescriptionSuggestionContent(
    content: string,
    input: QuestionnaireToDescriptionSuggestionInput,
): Promise<readonly PersonaConvergenceSuggestion[]> {
    const normalized = stripMarkdownFence(content);
    const parsed = parseJSONSafely(normalized);
    return convertSuggestion(parsed, input);
}
