/**
 * Casper 问卷 - 本能反应评估（第六部分）
 *
 * CASPER-03 本能反应特征集量表：领地意识、直觉-理性平衡、本能整合。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 领地意识评估 */
export const territoryAwarenessQuestion: CompositeRatingQuestion = {
    text: "领地意识评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "对个人空间的本能维护倾向：",
            type: "single",
            options: ["完全开放", "被动接受", "基本界限", "明确边界", "强烈防御"],
            weight: 1.1,
            path: "本能反应.领地意识.空间维护",
        },
        {
            text: "对资源占有的本能倾向：",
            type: "single",
            options: ["完全共享", "易于放弃", "适度占有", "重视所有", "强烈占有"],
            weight: 1.1,
            path: "本能反应.领地意识.资源占有",
        },
    ],
};

/** 直觉-理性平衡评估 */
export const intuitionRationBalanceQuestion: CompositeRatingQuestion = {
    text: "直觉-理性平衡评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在时间压力下的决策倾向：",
            type: "single",
            options: [
                "完全依赖直觉",
                "主要靠直觉",
                "直觉理性并用",
                "倾向理性分析",
                "强制理性分析",
            ],
            weight: 1.3,
            path: "本能反应.决策平衡.时间压力",
        },
        {
            text: "在高度不确定环境中的判断倾向：",
            type: "single",
            options: [
                "完全依赖本能",
                "以本能为主",
                "本能理性结合",
                "以分析为主",
                "强制理性分析",
            ],
            weight: 1.2,
            path: "本能反应.决策平衡.不确定性",
        },
    ],
};

/** 本能整合评估 */
export const instinctIntegrationQuestion: CompositeRatingQuestion = {
    text: "本能整合评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "本能反应的可控性倾向：",
            type: "single",
            options: [
                "完全本能驱动",
                "低度意识控制",
                "基本意识调节",
                "主动控制整合",
                "高度系统整合",
            ],
            weight: 1.3,
            path: "本能反应.整合能力.控制程度",
        },
        {
            text: "在压力下的系统协调倾向：",
            type: "single",
            options: [
                "完全本能主导",
                "本能优先反应",
                "基本平衡协调",
                "理性指导调节",
                "系统性整合应对",
            ],
            weight: 1.2,
            path: "本能反应.整合能力.压力协调",
        },
    ],
};
