/**
 * 问卷评分计算工具
 *
 * 提供问卷子问题的加权评分计算逻辑，被casper和balthazar问卷共用。
 */
import type { ScoreAnswer } from "../questionnaire.types";

/**
 * 计算加权评分百分比
 *
 * @param answers - 包含选项索引和权重的答案数组
 * @returns 0-100的百分比分数
 */
export async function calculateWeightedScore(answers: readonly ScoreAnswer[]): Promise<number> {
    const scores = answers.map((answer) => answer.selectedOptionIndex * (answer.weight ?? 1));
    const totalWeight = answers.reduce((sum, answer) => sum + (answer.weight ?? 1), 0);
    const weightedSum = scores.reduce((sum, score) => sum + score, 0);
    return Math.round((weightedSum / (totalWeight * 4)) * 100);
}
