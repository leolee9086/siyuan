/**
 * Casper 问卷 - 本能反应评估（第一部分）
 *
 * CASPER-03 本能反应特征集量表：警觉性、应激反应、自我调节、本能驱动、生存本能。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 本能反应评估 */
export const instinctReactionQuestion: CompositeRatingQuestion = {
    text: "本能反应评估",
    type: "composite_rating",
    hint: "评估个体的自然警觉倾向与注意力分配模式",
    subQuestions: [
        {
            text: "在公共场所时，候选者的注意力倾向是：",
            type: "single",
            options: ["专注于当前活动", "被提醒才会环顾", "定期检查环境", "持续观察周围", "保持全面警戒"],
            weight: 1,
            path: "本能反应.生存机制.警觉性.环境意识",
            hint: "评估环境安全意识的自然倾向",
        },
        {
            text: "在陌生环境中，候选者对变化的关注倾向：",
            type: "single",
            options: ["专注于既定目标", "被动接收信息", "保持基本观察", "主动搜索变化", "持续扫描环境"],
            weight: 1,
            path: "本能反应.生存机制.警觉性.变化感知",
            hint: "评估对环境变化的自然关注倾向",
        },
        {
            text: "在团队互动中，候选者对他人情绪的关注倾向：",
            type: "single",
            options: ["专注于任务本身", "被提醒才会注意", "保持基本关注", "主动观察情绪", "持续追踪变化"],
            weight: 1,
            path: "本能反应.生存机制.警觉性.情绪敏感度",
            hint: "评估对情绪变化的自然关注倾向",
        },
    ],
};

/** 应激反应倾向评估 */
export const stressResponseQuestion: CompositeRatingQuestion = {
    text: "应激反应倾向评估",
    type: "composite_rating",
    hint: "评估在压力情境下的本能反应模式",
    subQuestions: [
        {
            text: "面对突发情况时，候选者的第一反应倾向是：",
            type: "single",
            options: ["寻求他人指导", "遵循既有流程", "快速评估局势", "立即采取行动", "系统性应对"],
            weight: 1.2,
            path: "本能反应.生存机制.应激反应.紧急处理",
            hint: "评估紧急情况下的自然反应模式",
        },
        {
            text: "在高压环境下，候选者的决策倾向是：",
            type: "single",
            options: ["回避做出决定", "寻求他人建议", "依据经验判断", "快速权衡利弊", "系统分析决策"],
            weight: 1.1,
            path: "本能反应.生存机制.应激反应.压力决策",
            hint: "评估压力下的决策倾向",
        },
        {
            text: "面对意外变化时，候选者的适应倾向是：",
            type: "single",
            options: ["固守原有方案", "被动接受变化", "基本调整适应", "积极重新规划", "灵活动态调整"],
            weight: 1,
            path: "本能反应.生存机制.应激反应.变化适应",
            hint: "评估对突发变化的适应倾向",
        },
    ],
};
