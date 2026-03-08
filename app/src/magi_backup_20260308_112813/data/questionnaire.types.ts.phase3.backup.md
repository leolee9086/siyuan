/**
 * 问卷系统类型定义
 *
 * 定义MAGI人格评估问卷的数据结构，包括问题类型、章节结构和评分函数签名。
 */

/** 复合评分子问题 */
export interface QuestionnaireSubQuestion {
    readonly text: string;
    readonly type: "single";
    readonly options: readonly string[];
    readonly weight?: number;
    readonly path: string;
    readonly hint?: string;
}

/** 评分回调的答案条目 */
export interface ScoreAnswer {
    readonly selectedOptionIndex: number;
    readonly weight?: number;
}

/** 单选问题 */
export interface SingleQuestion {
    readonly text: string;
    readonly type: "single";
    readonly options: readonly string[];
    selectedOption?: string;
    readonly path: string;
    readonly hint?: string;
    readonly onChange?: (value: string, questions: QuestionnaireQuestion[]) => void;
}

/** 文本输入问题 */
export interface TextQuestion {
    readonly text: string;
    readonly type: "text";
    value?: string;
    placeholder?: string;
    readonly path: string;
    readonly hint?: string;
}

/** 多文本输入问题 */
export interface MultipleTextQuestion {
    readonly text: string;
    readonly type: "multiple_text";
    values: string[];
    readonly placeholder?: string;
    readonly path: string;
    readonly hint?: string;
    readonly validation?: {
        readonly pattern: RegExp;
        readonly message: string;
    };
}

/** 复合评分问题 */
export interface CompositeRatingQuestion {
    readonly text: string;
    readonly type: "composite_rating";
    readonly subQuestions: readonly QuestionnaireSubQuestion[];
    readonly calculateScore?: (answers: readonly ScoreAnswer[]) => Promise<number> | number;
    readonly hint?: string;
}

/** 问卷问题联合类型 */
export type QuestionnaireQuestion =
    | SingleQuestion
    | TextQuestion
    | MultipleTextQuestion
    | CompositeRatingQuestion;

/** 问卷章节 */
export interface QuestionnaireSection {
    readonly title: string;
    readonly systemTitle: string;
    readonly description: string;
    readonly questions: readonly QuestionnaireQuestion[];
}

/** 统一人格基底（P_base） */
export interface PersonaBase {
    readonly traits: Readonly<Record<"O" | "C" | "E" | "A" | "N", number>>;
    readonly facets: Readonly<Record<string, number>>;
}

/**
 * 统一总结输入：以 PersonaBase 为基底，允许附加展示层字段。
 *
 * 说明：旧的四贤者 SummaryData 已移除，调用链统一收敛到 PersonaBase。
 */
export type SummaryPromptPersonaData = PersonaBase &
    Readonly<Record<string, string | number | readonly string[] | undefined>>;

/** 总结提示词生成函数签名 */
export type SummaryPromptGenerator<T> = (data: T) => string;

/** 决策模板上下文 */
export interface DecisionContext {
    readonly situation: string;
    readonly background: string;
    readonly constraints: readonly string[];
    readonly resources: Readonly<Record<string, string>>;
    readonly previousDecisions: readonly string[];
}

/** 决策模板参数 */
export interface DecisionParameters {
    readonly priority: "high" | "medium" | "low";
    readonly timeFrame: string;
    readonly riskTolerance: number;
}

/** 决策模板输入数据 */
export interface DecisionPromptData {
    readonly context: DecisionContext;
    readonly parameters: DecisionParameters;
}
