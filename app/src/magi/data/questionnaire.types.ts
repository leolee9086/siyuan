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

/** 视角类型 */
export type MagiPerspective = "trinity" | "melchior" | "balthazar" | "casper";

/** 主导者选举依赖的三元立场。 */
export interface SubjectCognitiveStances {
    readonly profession: string;
    readonly primarySocialRelation: string;
    readonly selfName: string;
}

/** IPIP 输出中的被试信息 */
export interface IpipSubjectProfile {
    readonly id: string;
    readonly name: string;
    readonly age?: number;
    readonly gender?: string;
    readonly organization?: string;
    readonly role?: string;
    readonly careerGoal?: string;
    readonly cognitiveStances?: SubjectCognitiveStances;
}

/** IPIP-NEO-120 原始答案条目（前端提交载荷） */
export interface IpipNeo120RawAnswer {
    readonly q: number;
    readonly text: string;
    readonly score: 1 | 2 | 3 | 4 | 5;
}

/** IPIP-NEO-120 被试元信息（与设计文档 schema 对齐） */
export interface IpipNeo120SubjectMeta {
    readonly id: string;
    readonly name: string;
    readonly gender?: string;
    readonly age?: number;
    readonly type: "human" | "ai_agent";
    readonly organization: string;
    readonly role: string;
    readonly careerGoal: string;
    readonly cognitiveStances?: SubjectCognitiveStances;
}

/** IPIP-NEO-120 人格种子四轨描述 */
export interface IpipPersonaSeedDescriptions {
    readonly professionalDescription: string;
    readonly lifeDescription: string;
    readonly instinctNeedsDescription: string;
    readonly integratedDescription: string;
}

/** IPIP-NEO-120 原始答案提交载荷（前端仅收集，不做计分） */
export interface IpipNeo120SubmissionPayload {
    readonly schema_version: "IPIP-NEO-120-v1";
    readonly subject: IpipNeo120SubjectMeta;
    readonly date: string;
    readonly descriptions: IpipPersonaSeedDescriptions;
    readonly answers: readonly IpipNeo120RawAnswer[];
}

/** 基于 IPIP-NEO-120 的人格档案输入 */
export interface IpipPersonaProfile {
    readonly schemaVersion: "IPIP-NEO-120-v1";
    readonly subject: IpipSubjectProfile;
    readonly personaBase: PersonaBase;
    readonly generatedAt: string;
}

/** 极值过滤后的子维度条目 */
export interface ExtremeFacetItem {
    readonly key: string;
    readonly score: number;
    readonly polarity: "high" | "low";
}

/** 自述侧面标签定义 */
export interface SideLabelDescriptor {
    readonly perspective: Exclude<MagiPerspective, "trinity"> | "trinity";
    readonly label: string;
    readonly fileName: string;
}

/** 统一五层 Prompt 结构 */
export interface FiveLayerPrompt {
    readonly sharedResume: string;
    readonly perspectiveNarrative: string;
    readonly perspectiveGuide: string;
    readonly telemetry: string;
    readonly currentInput: string;
}

/** Phase 3 统一 Prompt 输入 */
export interface SummaryPromptInput {
    readonly profile: IpipPersonaProfile;
    readonly currentInput: string;
    readonly telemetry: string;
}

/** 总结提示词生成函数签名 */
export type SummaryPromptGenerator<T> = (data: T) => string | Promise<string>;

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
