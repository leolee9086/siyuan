/**
 * Melchior 问卷 - 认知控制评估（第三部分）
 *
 * 分析深度、决策平衡、理性-情感整合、系统思维、系统整合评估。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 分析深度倾向评估 */
export const analysisDepthQuestion: CompositeRatingQuestion = {
    text: "分析深度倾向评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在处理复杂问题时的分析倾向：",
            type: "single",
            options: ["倾向直觉判断", "简单分类处理", "基本逻辑分析", "系统性思考", "深度结构化分析"],
            weight: 1.3,
            path: "认知控制.分析深度.复杂问题",
            hint: "评估深度分析的自然倾向",
        },
        {
            text: "在面对矛盾信息时的处理倾向：",
            type: "single",
            options: ["忽略矛盾", "选择性接受", "基本核实", "系统验证", "深度交叉验证"],
            weight: 1.2,
            path: "认知控制.分析深度.信息验证",
        },
    ],
};

/** 理性决策平衡评估 */
export const rationalBalanceQuestion: CompositeRatingQuestion = {
    text: "理性决策平衡评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在权衡多个方案时的倾向：",
            type: "single",
            options: ["依赖直觉选择", "简单对比选择", "基本成本效益分析", "系统性对比分析", "全面量化评估"],
            weight: 1.2,
            path: "认知控制.决策平衡.方案评估",
        },
    ],
};

/** 理性-情感整合评估 */
export const rationalEmotionQuestion: CompositeRatingQuestion = {
    text: "理性-情感整合评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在进行重要决策时，理性分析与情感考虑的平衡倾向：",
            type: "single",
            options: ["完全理性分析", "以理性为主", "理性情感均衡", "重视情感因素", "深度情感整合"],
            weight: 1.3,
            path: "认知控制.决策整合.理情平衡",
            hint: "评估理性与情感因素的整合倾向",
        },
        {
            text: "在评估方案时，对定性因素的处理倾向：",
            type: "single",
            options: ["仅关注定量指标", "优先定量分析", "定量定性结合", "重视定性分析", "深度质化分析"],
            weight: 1.2,
            path: "认知控制.决策整合.定性处理",
        },
    ],
};

/** 系统思维深度评估 */
export const systemThinkingQuestion: CompositeRatingQuestion = {
    text: "系统思维深度评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在构建分析框架时的倾向：",
            type: "single",
            options: ["简单线性思维", "基本逻辑框架", "多维度分析", "系统性思维", "复杂系统建模"],
            weight: 1.2,
            path: "认知控制.系统思维.框架构建",
        },
    ],
};

/** 系统整合能力评估 */
export const systemIntegrationQuestion: CompositeRatingQuestion = {
    text: "系统整合能力评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在复杂决策中的系统协调倾向：",
            type: "single",
            options: ["完全依赖单一系统", "主要依赖优势系统", "基本平衡各系统", "灵活调用整合", "系统性深度整合"],
            weight: 1.3,
            path: "认知控制.系统整合.协调能力",
        },
        {
            text: "在信息处理中的系统切换倾向：",
            type: "single",
            options: ["固守单一处理模式", "被动响应切换", "基本适应切换", "主动灵活切换", "策略性系统切换"],
            weight: 1.2,
            path: "认知控制.系统整合.切换灵活性",
        },
    ],
};
