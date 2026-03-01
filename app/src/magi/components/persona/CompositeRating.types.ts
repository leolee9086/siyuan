/**
 * CompositeRating 组件类型定义
 *
 * 为复合评分组件提供 props、emits 和内部状态的类型约束。
 */

import type {
    CompositeRatingQuestion,
    IpipNeo120SubmissionPayload,
    IpipNeo120SubjectMeta,
} from "../../data/questionnaire.types";
import type { IpipNeo120Item } from "../../data/ipip-neo-120.types";

/** IPIP 5 级 Likert 分值类型（1~5） */
export type LikertScore = 1 | 2 | 3 | 4 | 5;

/**
 * CompositeRating 组件 Props
 *
 * 用途：定义复合评分组件的输入属性
 * 使用场景：人格问卷中渲染复合评分题目
 */
export interface CompositeRatingProps {
    /** 兼容旧复合评分模式（旧问卷结构） */
    question?: CompositeRatingQuestion | undefined;
    /** 新 IPIP-NEO-120 题库（逐题 5 级 Likert） */
    questionBank?: readonly IpipNeo120Item[] | undefined;
    /** 新 IPIP-NEO-120 被试信息 */
    subject?: IpipNeo120SubjectMeta | undefined;
}

/**
 * CompositeRating 组件 Emits
 *
 * 用途：定义复合评分组件的事件类型
 * 使用场景：子问题选项变化时通知父组件更新数据和分数
 */
export interface CompositeRatingEmits {
    (e: "update:question", question: CompositeRatingQuestion): void;
    (e: "update:score", score: number): void;
    (e: "update:ipip-answer", answer: { q: number; score: LikertScore }): void;
    (e: "submit:ipip", payload: IpipNeo120SubmissionPayload): void;
}

/** 子问题选中状态映射（子问题索引 → 选中选项索引） */
export type SelectionMap = Map<number, number>;

/** IPIP 题目作答映射（题号 q → Likert 分值） */
export type LikertSelectionMap = Map<number, LikertScore>;
