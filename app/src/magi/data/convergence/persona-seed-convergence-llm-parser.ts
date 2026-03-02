import type { IpipNeo120Item } from "../ipip-neo-120.types";
import { createPendingSuggestion } from "./persona-seed-convergence";
import { isDescriptionToQuestionnaireLLMResponse } from "./persona-seed-convergence-llm.guard";
import type { DescriptionToQuestionnaireSuggestionInput } from "./persona-seed-convergence-llm.types";
import type { PersonaConvergenceSuggestion } from "./persona-seed-convergence.types";

const MAX_SUGGESTIONS = 16;

/**
 * 作用：剥离模型输出中的 markdown 代码块包裹。
 * 意图：兼容模型偶发输出 ```json ... ``` 的情况。
 * 调用时机：JSON.parse 前调用。
 * 问题/改进：当前只处理首尾 fence，后续可增强容错。
 */
function stripMarkdownFence(content: string): string {
    const trimmed = content.trim();
    if (!trimmed.startsWith("```")) {
        return trimmed;
    }
    const firstBreakIndex = trimmed.indexOf("\n");
    if (firstBreakIndex < 0) {
        return trimmed.replace(/```/g, "").trim();
    }
    const body = trimmed.slice(firstBreakIndex + 1);
    const lastFenceIndex = body.lastIndexOf("```");
    if (lastFenceIndex < 0) {
        return body.trim();
    }
    return body.slice(0, lastFenceIndex).trim();
}

/**
 * 作用：安全执行 JSON 解析。
 * 意图：避免模型输出非法 JSON 时抛错中断主流程。
 * 调用时机：提取 LLM suggestions 前调用。
 * 问题/改进：当前仅返回 null，后续可加入错误分类。
 */
function parseJSONSafely(content: string): unknown {
    try {
        return JSON.parse(content);
    } catch {
        return null;
    }
}

/**
 * 作用：构建题号索引映射。
 * 意图：快速校验模型建议题号是否存在于当前题库。
 * 调用时机：建议转换前调用。
 * 问题/改进：后续可缓存索引减少重复构建。
 */
function createQuestionIndex(questionBank: readonly IpipNeo120Item[]): Readonly<Record<number, IpipNeo120Item>> {
    const index: Record<number, IpipNeo120Item> = {};
    for (const item of questionBank) {
        index[item.q] = item;
    }
    return index;
}

/**
 * 作用：标准化建议理由文本。
 * 意图：保证 reason 字段始终可展示，避免空字符串影响 UI。
 * 调用时机：转换模型建议为 convergence 建议时调用。
 * 问题/改进：当前为兜底文案，后续可引入模板化解释。
 */
function normalizeReason(reason: string, q: number): string {
    const trimmed = reason.trim();
    if (trimmed) {
        return trimmed;
    }
    return `由描述推断题 ${q} 建议分值`;
}

/**
 * 作用：将模型建议项转换为 convergence 建议对象。
 * 意图：复用现有 pending 建议结构与确认写回机制。
 * 调用时机：解析并校验 LLM JSON 后调用。
 * 问题/改进：目前按题号去重保留首条，后续可引入冲突提示。
 */
function convertSuggestions(
    parsed: unknown,
    questionIndex: Readonly<Record<number, IpipNeo120Item>>,
    answeredSet: ReadonlySet<number>,
): readonly PersonaConvergenceSuggestion[] {
    if (!isDescriptionToQuestionnaireLLMResponse(parsed)) {
        return [];
    }
    const usedQuestions = new Set<number>();
    const suggestions: PersonaConvergenceSuggestion[] = [];
    for (const item of parsed.suggestions) {
        // 题号不存在时直接丢弃，避免越界写回。
        if (!questionIndex[item.q]) {
            continue;
        }
        // 已建议过同题时跳过后续重复项。
        if (usedQuestions.has(item.q)) {
            continue;
        }
        // 已作答题默认不生成自动覆盖建议。
        if (answeredSet.has(item.q)) {
            continue;
        }
        usedQuestions.add(item.q);
        suggestions.push(
            createPendingSuggestion({
                id: `d2q_${item.q}_${suggestions.length + 1}`,
                source: "description_to_questionnaire",
                target: "questionnaire_answer",
                confidence: item.confidence,
                reason: normalizeReason(item.reason, item.q),
                payload: {
                    kind: "questionnaire_answer",
                    q: item.q,
                    score: item.score,
                    onlyWhenUnanswered: true,
                },
            }),
        );
        // 达到上限后停止，控制 UI 负载。
        if (suggestions.length >= MAX_SUGGESTIONS) {
            break;
        }
    }
    return suggestions;
}

/**
 * 作用：把模型 content 解析为 convergence 建议列表。
 * 意图：提供可测试的纯转换入口，降低网络依赖。
 * 调用时机：网络请求返回后调用，也用于单测验证解析行为。
 * 问题/改进：当前仅支持 JSON 对象格式，后续可兼容 JSON 数组根节点。
 */
export async function parseDescriptionToQuestionnaireSuggestionContent(
    content: string,
    input: DescriptionToQuestionnaireSuggestionInput,
): Promise<readonly PersonaConvergenceSuggestion[]> {
    const normalized = stripMarkdownFence(content);
    const parsed = parseJSONSafely(normalized);
    const questionIndex = createQuestionIndex(input.questionBank);
    const answeredSet = new Set(input.answers.map((answer) => answer.q));
    return convertSuggestions(parsed, questionIndex, answeredSet);
}
