import { describe, expect, it } from "vitest";
import { parseQuestionnaireToDescriptionSuggestionContent } from "./persona-seed-convergence-q2d-llm-parser";
import { resolveShortestSideDescriptionField } from "./persona-seed-convergence-q2d-llm";
import type { QuestionnaireToDescriptionSuggestionInput } from "./persona-seed-convergence-q2d-llm.types";

const INPUT_TEMPLATE: QuestionnaireToDescriptionSuggestionInput = {
    subject: {
        id: "zhi",
        name: "ZHI",
        type: "ai_agent",
        organization: "NERV",
        role: "system architect",
        careerGoal: "构建稳定的人机协作系统",
    },
    sideDescriptions: {
        professionalDescription: "擅长结构化拆解与方案推进。",
        lifeDescription: "重视长期稳定与可信关系。",
        instinctNeedsDescription: "需要清晰边界和可预期反馈。",
    },
    answers: [{ q: 2, score: 4 }],
    questionBank: [
        { q: 1, text: "杞人忧天", domain: "N", facet: 1, keyed: "plus" },
        { q: 2, text: "平易近人", domain: "E", facet: 1, keyed: "plus" },
        { q: 3, text: "天马行空", domain: "O", facet: 1, keyed: "plus" },
    ],
};

/**
 * 作用：验证解析函数能把合法 JSON suggestion 转为一条 pending 描述建议。
 * 意图：保障“问卷->描述”路径能稳定进入统一确认流。
 * 调用时机：q2d 解析回归测试。
 * 问题/改进：后续可补充 confidence 裁剪边界测试。
 */
async function shouldParseSingleQuestionnaireToDescriptionSuggestion(): Promise<void> {
    const content = JSON.stringify({
        suggestion: {
            field: "professionalDescription",
            text: "在简历中可补充：你擅长把复杂任务拆解为可执行里程碑并持续跟踪闭环。",
            confidence: 0.82,
            reason: "问卷呈现较强执行与计划倾向",
        },
    });
    const suggestions = await parseQuestionnaireToDescriptionSuggestionContent(content, INPUT_TEMPLATE);
    const firstSuggestion = suggestions[0];
    expect(suggestions).toHaveLength(1);
    expect(firstSuggestion?.source).toBe("questionnaire_to_description");
    expect(firstSuggestion?.payload.kind).toBe("description_append");
    expect(firstSuggestion?.payload.field).toBe("professionalDescription");
    expect(firstSuggestion?.status).toBe("pending");
}

/**
 * 作用：验证解析函数兼容 markdown fenced JSON。
 * 意图：防止模型输出 ```json 包裹时解析失败。
 * 调用时机：q2d 解析回归测试。
 * 问题/改进：后续可补充异常 fence 容错场景。
 */
async function shouldParseFencedJSONSuggestion(): Promise<void> {
    const content = [
        "```json",
        "{\"suggestion\":{\"field\":\"lifeDescription\",\"text\":\"可在生活维度补充你如何在协作中维持稳定关系与反馈节奏。\",\"confidence\":0.64,\"reason\":\"问卷指向关系稳定偏好\"}}",
        "```",
    ].join("\n");
    const suggestions = await parseQuestionnaireToDescriptionSuggestionContent(content, INPUT_TEMPLATE);
    const firstSuggestion = suggestions[0];
    expect(suggestions).toHaveLength(1);
    expect(firstSuggestion?.payload.kind).toBe("description_append");
    expect(firstSuggestion?.payload.field).toBe("lifeDescription");
}

/**
 * 作用：验证解析函数会拒绝三侧之外的非法字段。
 * 意图：强制“一次只更新一个侧面描述”的字段边界。
 * 调用时机：q2d 解析回归测试。
 * 问题/改进：后续可补充更多非法字段组合测试。
 */
async function shouldRejectInvalidFieldSuggestion(): Promise<void> {
    const content = JSON.stringify({
        suggestion: {
            field: "integratedDescription",
            text: "不应通过解析",
            confidence: 0.9,
            reason: "非法字段",
        },
    });
    const suggestions = await parseQuestionnaireToDescriptionSuggestionContent(content, INPUT_TEMPLATE);
    expect(suggestions).toHaveLength(0);
}

/**
 * 作用：验证解析函数会过滤空白描述文本建议。
 * 意图：避免把空内容写入描述字段污染用户文本。
 * 调用时机：q2d 解析回归测试。
 * 问题/改进：后续可增加最小有效长度约束。
 */
async function shouldRejectBlankTextSuggestion(): Promise<void> {
    const content = JSON.stringify({
        suggestion: {
            field: "instinctNeedsDescription",
            text: "   ",
            confidence: 0.7,
            reason: "空文本",
        },
    });
    const suggestions = await parseQuestionnaireToDescriptionSuggestionContent(content, INPUT_TEMPLATE);
    expect(suggestions).toHaveLength(0);
}

/**
 * 作用：验证优先字段选择会命中当前最短描述侧面。
 * 意图：确保问卷->描述建议遵循“优先补最短板”策略。
 * 调用时机：q2d 优先策略回归测试。
 * 问题/改进：后续可增加多语言文本长度场景。
 */
function shouldSelectShortestDescriptionField(): void {
    const field = resolveShortestSideDescriptionField({
        professionalDescription: "职业侧描述已经相对完整，覆盖多个能力点。",
        lifeDescription: "短",
        instinctNeedsDescription: "本能侧也有一定内容。",
    });
    expect(field).toBe("lifeDescription");
}

/**
 * 作用：验证并列最短时按稳定顺序选择字段。
 * 意图：避免同长度输入导致字段跳变，保持可预测行为。
 * 调用时机：q2d 优先策略回归测试。
 * 问题/改进：后续可考虑让用户配置并列优先级。
 */
function shouldKeepStableOrderWhenLengthsTie(): void {
    const field = resolveShortestSideDescriptionField({
        professionalDescription: "",
        lifeDescription: "",
        instinctNeedsDescription: "",
    });
    expect(field).toBe("professionalDescription");
}

/**
 * 作用：注册问卷->描述建议解析测试集。
 * 意图：保证 q2d LLM 输出到建议结构的转换行为稳定。
 * 调用时机：vitest 加载该测试文件时执行。
 * 问题/改进：后续可补充更复杂输入分布测试。
 */
function runQuestionnaireToDescriptionLLMSuite(): void {
    it("应解析单条有效建议", shouldParseSingleQuestionnaireToDescriptionSuggestion);
    it("应解析 markdown fenced JSON", shouldParseFencedJSONSuggestion);
    it("应拒绝三侧之外字段", shouldRejectInvalidFieldSuggestion);
    it("应拒绝空白建议文本", shouldRejectBlankTextSuggestion);
    it("应优先命中最短描述侧", shouldSelectShortestDescriptionField);
    it("并列最短时应保持稳定字段顺序", shouldKeepStableOrderWhenLengthsTie);
}

describe("persona-seed-convergence-q2d-llm", runQuestionnaireToDescriptionLLMSuite);
