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
    questionBank?: ReadonlyArray<IpipNeo120Item> | undefined;
    /** 新 IPIP-NEO-120 被试信息 */
    subject?: IpipNeo120SubjectMeta | undefined;
    /** 父层当前已作答结果（用于同步进度与高亮） */
    ipipAnswers?: ReadonlyArray<{ q: number; score: LikertScore }> | undefined;
    /** 父层请求定位的目标题号（用于“查看建议”跳转） */
    focusQuestionQ?: number | null | undefined;
    /** 父层请求定位序号（用于强制触发重复定位同一题号） */
    focusQuestionRequestId?: number | undefined;
    /** 父层传入的“待确认建议”题号集合（用于网格变色） */
    pendingSuggestionQuestionQs?: ReadonlyArray<number> | undefined;
}

/**
 * CompositeRating 对外暴露方法。
 *
 * 用途：允许父组件直接触发题号跳转，作为 props-watch 之外的兜底通道。
 * 使用场景：建议列表点击“查看”时强制定位到指定题目。
 */
export interface CompositeRatingExpose {
    jumpToQuestionByQ: (q: number) => void;
}

/**
 * IPIP 题号网格单元状态。
 *
 * 用途：描述 120 题状态格的渲染信息。
 * 使用场景：CompositeRating 顶部状态网格渲染（当前题/已作答/有建议）。
 * 关联类型：`CompositeRatingProps`、`LikertScore`。
 * 问题/改进：当前仅包含展示状态，后续可扩展冲突等级或置信度。
 */
export interface IpipQuestionGridCell {
    q: number;
    isCurrent: boolean;
    isAnswered: boolean;
    hasSuggestion: boolean;
    title: string;
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
