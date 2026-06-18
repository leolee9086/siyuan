/**
 * 决策提示词模板
 *
 * 用于生成复杂决策场景的结构化提示词，支持上下文、约束条件和风险参数。
 */
/** 用途：DecisionPromptData 决策提示数据类型。使用范围：决策提示词模板的输入参数。解耦评估：类型导入，不涉及运行时耦合。 */
import type { DecisionPromptData } from "../data/questionnaire.types";
const expectedOutputSchema = {
    decision: {
        recommendation: "string",
        reasoning: "string",
        alternatives: ["string"],
        risks: ["string"],
        nextSteps: ["string"],
    },
} as const;

/**
 * 根据决策数据生成完整提示词
 *
 * @param data - 包含上下文和参数的决策输入数据
 * @returns 格式化的决策提示词字符串
 */
export async function generateDecisionPrompt(data: DecisionPromptData) {
    const constraintsList = data.context.constraints
        .map((c) => `- ${c}`)
        .join("\n");

    const resourcesList = Object.entries(data.context.resources)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n");

    const schemaStr = JSON.stringify(expectedOutputSchema, null, 2);

    return `
背景情况:
${data.context.situation}

需要考虑的约束:
${constraintsList}

可用资源:
${resourcesList}

决策优先级: ${data.parameters.priority}
时间框架: ${data.parameters.timeFrame}
风险承受度: ${data.parameters.riskTolerance}

请提供:
1. 主要建议
2. 决策理由
3. 替代方案
4. 潜在风险
5. 后续步骤

请以JSON格式输出,符合以下结构:
${schemaStr}
    `.trim();
}
