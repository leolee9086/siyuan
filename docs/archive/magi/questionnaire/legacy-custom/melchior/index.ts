/**
 * Melchior 问卷章节聚合
 *
 * 将Melchior的14个认知控制评估问题组合为完整的章节。
 * 注意：prompt生成器应直接从 ./prompts 导入，不通过此文件转发。
 */
import type { QuestionnaireSection } from "../../questionnaire.types";
import { calculateWeightedScore } from "../calculateScore";
import {
    logicAnalysisQuestion,
    decisionExecutionQuestion,
    metaCognitionQuestion,
    cognitiveControlQuestion,
} from "./part1";
import {
    rationalDecisionQuestion,
    cognitiveAdaptQuestion,
    professionalDecisionQuestion,
    timePressureQuestion,
    teamRationalQuestion,
} from "./part2";
import {
    analysisDepthQuestion,
    rationalBalanceQuestion,
    rationalEmotionQuestion,
    systemThinkingQuestion,
    systemIntegrationQuestion,
} from "./part3";

/** Melchior 认知控制评估章节 */
export const melchiorSection: QuestionnaireSection = {
    title: "认知控制评估",
    systemTitle: "MELCHIOR-01 理性决策与认知控制特征量表",
    description: "评估个体在理性决策与认知控制方面的特征倾向。",
    questions: [
        { ...logicAnalysisQuestion, calculateScore: calculateWeightedScore },
        { ...decisionExecutionQuestion, calculateScore: calculateWeightedScore },
        { ...metaCognitionQuestion, calculateScore: calculateWeightedScore },
        { ...cognitiveControlQuestion, calculateScore: calculateWeightedScore },
        { ...rationalDecisionQuestion, calculateScore: calculateWeightedScore },
        { ...cognitiveAdaptQuestion, calculateScore: calculateWeightedScore },
        { ...professionalDecisionQuestion, calculateScore: calculateWeightedScore },
        { ...timePressureQuestion, calculateScore: calculateWeightedScore },
        { ...teamRationalQuestion, calculateScore: calculateWeightedScore },
        { ...analysisDepthQuestion, calculateScore: calculateWeightedScore },
        { ...rationalBalanceQuestion, calculateScore: calculateWeightedScore },
        { ...rationalEmotionQuestion, calculateScore: calculateWeightedScore },
        { ...systemThinkingQuestion, calculateScore: calculateWeightedScore },
        { ...systemIntegrationQuestion, calculateScore: calculateWeightedScore },
    ],
};
