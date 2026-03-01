/**
 * Casper 问卷章节聚合
 *
 * 将Casper的14个本能反应评估问题组合为完整的章节。
 * 注意：prompt生成器应直接从 ./prompts 导入，不通过此文件转发。
 */
import type { QuestionnaireSection } from "../../questionnaire.types";
import { calculateWeightedScore } from "../calculateScore";
import { instinctReactionQuestion, stressResponseQuestion } from "./part1";
import {
    selfRegulationQuestion,
    instinctDriveQuestion,
    survivalInstinctQuestion,
} from "./part2";
import {
    motivationSystemQuestion,
    intuitionJudgmentQuestion,
    socialInstinctQuestion,
} from "./part3";
import { resourceCompetitionQuestion, crisisWarningQuestion } from "./part4";
import { instinctDriveForceQuestion } from "./part5";
import {
    territoryAwarenessQuestion,
    intuitionRationBalanceQuestion,
    instinctIntegrationQuestion,
} from "./part6";

/** Casper 本能反应评估章节 */
export const casperSection: QuestionnaireSection = {
    title: "本能反应评估",
    systemTitle: "CASPER-03 本能反应特征集量表",
    description: "评估生存机制、动机系统与自动化行为模式。",
    questions: [
        { ...instinctReactionQuestion, calculateScore: calculateWeightedScore },
        { ...stressResponseQuestion, calculateScore: calculateWeightedScore },
        { ...selfRegulationQuestion, calculateScore: calculateWeightedScore },
        { ...instinctDriveQuestion, calculateScore: calculateWeightedScore },
        { ...survivalInstinctQuestion, calculateScore: calculateWeightedScore },
        { ...motivationSystemQuestion, calculateScore: calculateWeightedScore },
        { ...intuitionJudgmentQuestion, calculateScore: calculateWeightedScore },
        { ...socialInstinctQuestion, calculateScore: calculateWeightedScore },
        { ...resourceCompetitionQuestion, calculateScore: calculateWeightedScore },
        { ...crisisWarningQuestion, calculateScore: calculateWeightedScore },
        { ...instinctDriveForceQuestion, calculateScore: calculateWeightedScore },
        { ...territoryAwarenessQuestion, calculateScore: calculateWeightedScore },
        { ...intuitionRationBalanceQuestion, calculateScore: calculateWeightedScore },
        { ...instinctIntegrationQuestion, calculateScore: calculateWeightedScore },
    ],
};
