/**
 * Balthazar 问卷章节聚合
 *
 * 将Balthazar的11个情感倾向评估问题组合为完整的章节。
 * 注意：prompt生成器应直接从 ./prompts 导入，不通过此文件转发。
 */
import type { QuestionnaireSection } from "../../questionnaire.types";
import { calculateWeightedScore } from "../calculateScore";
import {
    emotionRecognitionQuestion,
    emotionRegulationQuestion,
    ethicalDecisionQuestion,
} from "./part1";
import {
    interpersonalQuestion,
    emotionalResonanceQuestion,
    professionalEthicsQuestion,
    teamEmotionQuestion,
    emotionalDepthQuestion,
} from "./part2";
import {
    valueIntegrationQuestion,
    emotionRationCoordQuestion,
    emotionBoundaryQuestion,
} from "./part3";

/** Balthazar 情感倾向评估章节 */
export const balthazarSection: QuestionnaireSection = {
    title: "情感倾向评估",
    systemTitle: "BALTHAZAR-02 情感特征与伦理倾向量表",
    description: "评估个体在情感处理与伦理决策中的自然倾向。",
    questions: [
        { ...emotionRecognitionQuestion, calculateScore: calculateWeightedScore },
        { ...emotionRegulationQuestion, calculateScore: calculateWeightedScore },
        { ...ethicalDecisionQuestion, calculateScore: calculateWeightedScore },
        { ...interpersonalQuestion, calculateScore: calculateWeightedScore },
        { ...emotionalResonanceQuestion, calculateScore: calculateWeightedScore },
        { ...professionalEthicsQuestion, calculateScore: calculateWeightedScore },
        { ...teamEmotionQuestion, calculateScore: calculateWeightedScore },
        { ...emotionalDepthQuestion, calculateScore: calculateWeightedScore },
        { ...valueIntegrationQuestion, calculateScore: calculateWeightedScore },
        { ...emotionRationCoordQuestion, calculateScore: calculateWeightedScore },
        { ...emotionBoundaryQuestion, calculateScore: calculateWeightedScore },
    ],
};
