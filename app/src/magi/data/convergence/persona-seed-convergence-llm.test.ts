import { describe, expect, it } from "vitest";
import { parseDescriptionToQuestionnaireSuggestionContent } from "./persona-seed-convergence-llm-parser";
import type { DescriptionToQuestionnaireSuggestionInput } from "./persona-seed-convergence-llm.types";

const INPUT_TEMPLATE: DescriptionToQuestionnaireSuggestionInput = {
    subjectId: "zhi",
    subjectName: "ZHI",
    descriptions: {
        professionalDescription: "我倾向于做结构化计划。",
        lifeDescription: "我在关系中重视稳定。",
        instinctNeedsDescription: "我需要明确边界。",
        integratedDescription: "我希望长期保持自律与成长。",
    },
    answers: [{ q: 2, score: 4 }],
    questionBank: [
        { q: 1, text: "杞人忧天", domain: "N", facet: 1, keyed: "plus" },
        { q: 2, text: "平易近人", domain: "E", facet: 1, keyed: "plus" },
        { q: 3, text: "天马行空", domain: "O", facet: 1, keyed: "plus" },
    ],
};

/**
 * 作用：验证解析函数会过滤已作答、越界和重复建议。
 * 意图：保证进入确认层的建议都是可写回且去重后的结果。
 * 调用时机：描述->问卷建议解析回归测试。
 * 问题/改进：后续可补充上限裁剪测试。
 */
async function shouldFilterInvalidOrDuplicatedSuggestions(): Promise<void> {
    const suggestionItems: Array<{ q: number; score: 1 | 2 | 3 | 4 | 5; confidence: number; reason: string }> = [];
    suggestionItems.push({ q: 1, score: 5, confidence: 0.83, reason: "职业描述呈现高执行偏好" });
    suggestionItems.push({ q: 2, score: 3, confidence: 0.72, reason: "已作答题，不应进入建议" });
    suggestionItems.push({ q: 999, score: 4, confidence: 0.66, reason: "越界题号" });
    suggestionItems.push({ q: 1, score: 4, confidence: 0.4, reason: "重复题号" });
    const content = JSON.stringify({ suggestions: suggestionItems });
    const suggestions = await parseDescriptionToQuestionnaireSuggestionContent(content, INPUT_TEMPLATE);
    const firstSuggestion = suggestions[0];
    expect(suggestions).toHaveLength(1);
    expect(firstSuggestion?.payload.kind).toBe("questionnaire_answer");
    expect(firstSuggestion?.payload.q).toBe(1);
    expect(firstSuggestion?.payload.score).toBe(5);
}

/**
 * 作用：验证解析函数兼容 markdown fenced JSON。
 * 意图：防止模型返回 ```json 包裹时解析失败。
 * 调用时机：描述->问卷建议解析回归测试。
 * 问题/改进：后续可补充异常 fence 的容错场景。
 */
async function shouldParseFencedJSONContent(): Promise<void> {
    const content = [
        "```json",
        "{\"suggestions\":[{\"q\":3,\"score\":2,\"confidence\":0.51,\"reason\":\"生活描述更偏保守\"}]}",
        "```",
    ].join("\n");
    const suggestions = await parseDescriptionToQuestionnaireSuggestionContent(content, INPUT_TEMPLATE);
    const firstSuggestion = suggestions[0];
    expect(suggestions).toHaveLength(1);
    expect(firstSuggestion?.payload.kind).toBe("questionnaire_answer");
    expect(firstSuggestion?.payload.q).toBe(3);
    expect(firstSuggestion?.status).toBe("pending");
}

/**
 * 作用：注册描述->问卷建议解析测试集。
 * 意图：保证 LLM 输出到建议结构的转换行为稳定。
 * 调用时机：vitest 加载该测试文件时执行。
 * 问题/改进：后续接入问卷->描述后可扩展双向解析 suite。
 */
function runDescriptionToQuestionnaireLLMSuite(): void {
    it("应过滤无效/重复/已作答题建议", shouldFilterInvalidOrDuplicatedSuggestions);
    it("应解析 markdown fenced JSON", shouldParseFencedJSONContent);
}

describe("persona-seed-convergence-llm", runDescriptionToQuestionnaireLLMSuite);
