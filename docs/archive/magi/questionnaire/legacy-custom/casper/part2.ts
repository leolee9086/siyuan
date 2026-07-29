/**
 * Casper 问卷 - 本能反应评估（第二部分）
 *
 * CASPER-03 本能反应特征集量表：自我调节、本能驱动、生存本能、动机系统、直觉判断。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 自我调节倾向评估 */
export const selfRegulationQuestion: CompositeRatingQuestion = {
    text: "自我调节倾向评估",
    type: "composite_rating",
    hint: "评估自我调节与平衡维护能力",
    subQuestions: [
        {
            text: "面对情绪波动时，候选者的控制倾向是：",
            type: "single",
            options: ["完全随波逐流", "勉强维持表象", "基本保持稳定", "主动调节情绪", "严格情绪管理"],
            weight: 1.2,
            path: "本能反应.自我调节.情绪控制",
            hint: "评估情绪自我调节倾向",
        },
        {
            text: "在高强度工作后，候选者的恢复倾向是：",
            type: "single",
            options: ["完全忽视恢复", "被迫休息调整", "基本注意休息", "主动规划恢复", "系统化恢复管理"],
            weight: 1,
            path: "本能反应.自我调节.能量管理",
            hint: "评估能量自我管理倾向",
        },
    ],
};

/** 本能驱动模式评估 */
export const instinctDriveQuestion: CompositeRatingQuestion = {
    text: "本能驱动模式评估",
    type: "composite_rating",
    hint: "评估本能驱动力与目标导向特征",
    subQuestions: [
        {
            text: "面对挑战性任务时，候选者的驱动倾向是：",
            type: "single",
            options: ["本能回避困难", "需要外部推动", "保持基本动力", "主动迎接挑战", "持续挑战极限"],
            weight: 1.2,
            path: "本能反应.驱动模式.挑战动力",
            hint: "评估面对挑战时的本能驱动力",
        },
        {
            text: "在追求目标过程中，候选者的坚持倾向是：",
            type: "single",
            options: ["轻易放弃目标", "遇阻易改方向", "基本坚持目标", "顽强克服困难", "执着坚守目标"],
            weight: 1.1,
            path: "本能反应.驱动模式.目标坚持",
            hint: "评估目标追求的持续性倾向",
        },
    ],
};

/** 生存本能评估 */
export const survivalInstinctQuestion: CompositeRatingQuestion = {
    text: "生存本能评估",
    type: "composite_rating",
    hint: "评估候选者的基本生存本能",
    subQuestions: [
        {
            text: "在可能存在风险的情况下，候选者会：",
            type: "single",
            options: [
                "完全忽视潜在风险",
                "被提醒才会注意",
                "会考虑基本防护",
                "主动采取防护措施",
                "全面系统地防范",
            ],
            weight: 1,
            path: "本能反应.生存机制.自我保护.风险防范",
            hint: "评估自我保护意识",
        },
        {
            text: "面对生理需求（如饥饿、疲劳）时，候选者会：",
            type: "single",
            options: [
                "完全忽视身体需求",
                "经常忽略基本需求",
                "基本注意自我照顾",
                "主动关注身体状态",
                "系统性维护健康",
            ],
            weight: 1,
            path: "本能反应.生存机制.自我维护.基础需求",
            hint: "评估基本生理需求的维护能力",
        },
    ],
};
