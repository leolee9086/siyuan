/**
 * Balthazar 问卷 - 情感倾向评估（第三部分）
 *
 * BALTHAZAR-02 情感特征与伦理倾向量表：价值观整合、情感-理性协调、情感边界识别。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 价值观整合评估 */
export const valueIntegrationQuestion: CompositeRatingQuestion = {
    text: "价值观整合评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在价值观冲突时的处理倾向：",
            type: "single",
            options: ["回避冲突", "被动接受", "寻求平衡", "主动整合", "系统重构"],
            weight: 1.3,
            path: "情感倾向.价值观.整合能力",
        },
        {
            text: "对新价值观的接纳倾向：",
            type: "single",
            options: ["完全排斥", "被动接受", "审慎评估", "开放包容", "主动整合"],
            weight: 1.2,
            path: "情感倾向.价值观.开放程度",
        },
    ],
};

/** 情感-理性协调评估 */
export const emotionRationCoordQuestion: CompositeRatingQuestion = {
    text: "情感-理性协调评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在情感决策中，理性分析的整合倾向：",
            type: "single",
            options: [
                "纯粹情感驱动",
                "以情感为主",
                "情理相互参考",
                "理性框架下的情感",
                "系统性情理整合",
            ],
            weight: 1.3,
            path: "情感倾向.决策整合.情理协调",
            hint: "评估情感决策中的理性整合程度",
        },
        {
            text: "在伦理判断中的分析倾向：",
            type: "single",
            options: [
                "纯粹价值判断",
                "价值导向分析",
                "价值理性结合",
                "理性框架下的价值",
                "系统性价值分析",
            ],
            weight: 1.2,
            path: "情感倾向.伦理分析.分析方式",
        },
    ],
};

/** 情感边界识别评估 */
export const emotionBoundaryQuestion: CompositeRatingQuestion = {
    text: "情感边界识别评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在情感决策中的边界意识：",
            type: "single",
            options: [
                "完全忽略边界",
                "模糊边界意识",
                "基本认知边界",
                "清晰界定范围",
                "精确把握边界",
            ],
            weight: 1.2,
            path: "情感倾向.边界意识.决策边界",
        },
        {
            text: "在价值判断中的理性参考度：",
            type: "single",
            options: [
                "完全感性判断",
                "主要依赖直觉",
                "情理参考平衡",
                "理性框架指导",
                "系统性整合判断",
            ],
            weight: 1.3,
            path: "情感倾向.边界意识.判断参考",
        },
    ],
};
