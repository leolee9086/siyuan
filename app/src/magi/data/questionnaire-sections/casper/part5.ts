/**
 * Casper 问卷 - 本能反应评估（第五部分）
 *
 * CASPER-03 本能反应特征集量表：本能驱动力、领地意识、直觉-理性平衡、本能整合。
 */
import type { CompositeRatingQuestion } from "../../questionnaire.types";

/** 本能驱动力评估 */
export const instinctDriveForceQuestion: CompositeRatingQuestion = {
    text: "本能驱动力评估",
    type: "composite_rating",
    subQuestions: [
        {
            text: "在面对机遇时的第一反应倾向：",
            type: "single",
            options: ["本能性退缩", "犹豫观望", "谨慎评估", "快速把握", "立即行动"],
            weight: 1.2,
            path: "本能反应.驱动力.机遇反应",
            hint: "评估对机遇的本能反应模式",
        },
        {
            text: "在遇到威胁时的即时反应倾向：",
            type: "single",
            options: ["完全冻结", "本能逃避", "观察评估", "防御准备", "主动应对"],
            weight: 1.3,
            path: "本能反应.驱动力.威胁应对",
            hint: "评估面对威胁时的本能反应",
        },
    ],
};
