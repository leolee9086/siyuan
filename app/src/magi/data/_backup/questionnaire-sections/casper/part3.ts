/**
 * Casper 问卷 - 本能反应评估（第三部分）
 *
 * CASPER-03 本能反应特征集量表：动机系统、直觉判断、社会本能、资源竞争、危机预警。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 动机系统评估 */
export const motivationSystemQuestion: CompositeRatingQuestion = {
    text: "动机系统评估",
    type: "composite_rating",
    hint: "评估候选者的内在动机系统",
    subQuestions: [
        {
            text: "在追求目标时，候选者表现出：",
            type: "single",
            options: ["缺乏明确目标", "被动执行任务", "保持基本动力", "积极追求目标", "持续高度专注"],
            weight: 1,
            path: "本能反应.动机系统.驱动强度.目标导向",
            hint: "评估目标导向的驱动力",
        },
        {
            text: "面对困难和挫折时，候选者会：",
            type: "single",
            options: ["轻易放弃", "需要他人鼓励", "保持基本坚持", "积极寻求突破", "越挫越勇"],
            weight: 1,
            path: "本能反应.动机系统.驱动强度.韧性",
            hint: "评估面对困难时的韧性",
        },
    ],
};

/** 直觉判断模式评估 */
export const intuitionJudgmentQuestion: CompositeRatingQuestion = {
    text: "直觉判断模式评估",
    type: "composite_rating",
    hint: "评估个体的直觉判断系统特征",
    subQuestions: [
        {
            text: "在缺乏完整信息的情况下，候选者的判断倾向：",
            type: "single",
            options: ["完全回避判断", "被动等待信息", "基于经验判断", "快速直觉决策", "综合直觉分析"],
            weight: 1.2,
            path: "本能反应.直觉系统.判断模式.信息缺失",
            hint: "评估信息不足时的直觉判断倾向",
        },
        {
            text: "面对复杂情境时，候选者的第一反应倾向：",
            type: "single",
            options: ["完全混乱", "寻求外部指导", "依据经验应对", "快速把握关键", "直觉性系统判断"],
            weight: 1.1,
            path: "本能反应.直觉系统.判断模式.复杂情境",
            hint: "评估复杂情境中的直觉反应",
        },
    ],
};

/** 社会本能评估 */
export const socialInstinctQuestion: CompositeRatingQuestion = {
    text: "社会本能评估",
    type: "composite_rating",
    hint: "评估社会互动中的本能反应模式",
    subQuestions: [
        {
            text: "在群体互动中，候选者的本能反应是：",
            type: "single",
            options: ["本能回避群体", "被动适应群体", "自然融入群体", "主动影响群体", "本能主导群体"],
            weight: 1.2,
            path: "本能反应.社会本能.群体互动",
            hint: "评估群体互动中的本能反应",
        },
        {
            text: "关于个人边界，候选者的本能维护倾向：",
            type: "single",
            options: ["边界感模糊", "被动接受侵犯", "基本维护边界", "主动设置界限", "强烈领地意识"],
            weight: 1.1,
            path: "本能反应.社会本能.边界意识",
            hint: "评估个人边界的本能维护倾向",
        },
    ],
};
