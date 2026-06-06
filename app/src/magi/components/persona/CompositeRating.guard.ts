/**
 * CompositeRating 类型守卫
 *
 * 为 CompositeRating 的运行时输入校验提供类型守卫。
 */

/** 用途：LikertScore 分值类型。使用范围：CompositeRating 输入校验。解耦评估：同目录内导入，类型定义与守卫职责分离。 */
import type { LikertScore } from "./CompositeRating.types";

const LIKERT_MIN = 1;
const LIKERT_MAX = 5;

/**
 * 校验输入是否为合法的 5 级 Likert 分值。
 *
 * 作用：在运行时限制分值只能为 1~5 的整数。
 * 调用时机：用户选择 Likert 选项时。
 */
export const isLikertScore = (score: number): score is LikertScore => {
    return Number.isInteger(score) && score >= LIKERT_MIN && score <= LIKERT_MAX;
};
