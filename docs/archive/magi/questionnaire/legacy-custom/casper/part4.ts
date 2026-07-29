/**
 * Casper 问卷 - 本能反应评估（第四部分）
 *
 * CASPER-03 本能反应特征集量表：资源竞争、危机预警、本能驱动力、领地意识、直觉-理性平衡、本能整合。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 资源竞争本能评估 */
export const resourceCompetitionQuestion: CompositeRatingQuestion = {
    text: "资源竞争本能评估",
    type: "composite_rating",
    hint: "评估资源竞争与合作中的本能反应",
    subQuestions: [
        {
            text: "在资源竞争情境中，候选者的本能倾向：",
            type: "single",
            options: ["完全回避竞争", "被动接受分配", "适度参与竞争", "积极争取资源", "强势主导分配"],
            weight: 1.2,
            path: "本能反应.竞争本能.资源获取",
            hint: "评估资源竞争中的本能反应",
        },
        {
            text: "在合作机会出现时，候选者的本能反应：",
            type: "single",
            options: ["本能性拒绝", "被动接受合作", "权衡后决定", "主动寻求合作", "战略性联盟"],
            weight: 1.1,
            path: "本能反应.竞争本能.合作倾向",
            hint: "评估合作情境中的本能反应",
        },
    ],
};

/** 危机预警系统评估 */
export const crisisWarningQuestion: CompositeRatingQuestion = {
    text: "危机预警系统评估",
    type: "composite_rating",
    hint: "评估个体的危机预警系统特征",
    subQuestions: [
        {
            text: "对潜在威胁的预感能力：",
            type: "single",
            options: ["完全忽视预警", "被提醒才注意", "基本感知威胁", "敏锐预感危机", "系统性预警"],
            weight: 1.3,
            path: "本能反应.预警系统.威胁感知",
            hint: "评估危机预警的本能敏感度",
        },
        {
            text: "面对不确定性时的本能反应：",
            type: "single",
            options: ["完全逃避", "被动等待", "保持警惕", "主动探索", "系统性应对"],
            weight: 1.2,
            path: "本能反应.预警系统.不确定性处理",
            hint: "评估不确定性下的本能反应",
        },
    ],
};
