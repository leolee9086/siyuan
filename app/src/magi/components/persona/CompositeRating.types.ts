/**
 * CompositeRating 组件类型定义
 *
 * 为复合评分组件提供 props、emits 和内部状态的类型约束。
 */

import type { CompositeRatingQuestion } from "../../data/questionnaire.types";

/**
 * CompositeRating 组件 Props
 *
 * 用途：定义复合评分组件的输入属性
 * 使用场景：人格问卷中渲染复合评分题目
 */
export interface CompositeRatingProps {
    /** 复合评分问题数据 */
    question: CompositeRatingQuestion;
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
}

/** 子问题选中状态映射（子问题索引 → 选中选项索引） */
export type SelectionMap = Map<number, number>;
