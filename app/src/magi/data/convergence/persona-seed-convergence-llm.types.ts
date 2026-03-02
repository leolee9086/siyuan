import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { IpipNeo120Item } from "../ipip-neo-120.types";
import type { IpipPersonaSeedDescriptions } from "../questionnaire.types";

/**
 * 问卷答案最小结构。
 *
 * 用途：为描述收敛模块提供题号与分值输入结构。
 * 使用场景：描述->问卷建议时用于过滤已作答题目。
 * 关联类型：`DescriptionToQuestionnaireSuggestionInput`。
 * 问题/改进：后续可扩展来源字段以支持审计。
 */
export interface PersonaSeedAnswerScore {
    readonly q: number;
    readonly score: LikertScore;
}

/**
 * 描述->问卷建议生成输入。
 *
 * 用途：收拢生成建议所需的主体、描述、题库和已答信息。
 * 使用场景：PersonaSeedPanel 点击“描述->问卷建议”时调用。
 * 关联类型：`PersonaSeedAnswerScore`、`IpipPersonaSeedDescriptions`、`IpipNeo120Item`。
 * 问题/改进：目前不含历史会话上下文，后续可追加多轮记忆。
 */
export interface DescriptionToQuestionnaireSuggestionInput {
    readonly subjectId: string;
    readonly subjectName: string;
    readonly descriptions: IpipPersonaSeedDescriptions;
    readonly answers: readonly PersonaSeedAnswerScore[];
    readonly questionBank: readonly IpipNeo120Item[];
}

/**
 * LLM 返回的单条问卷建议原始结构。
 *
 * 用途：承载模型输出中的题号、建议分值、置信度和理由。
 * 使用场景：LLM 输出 JSON 解析后进行守卫校验。
 * 关联类型：`DescriptionToQuestionnaireLLMResponse`。
 * 问题/改进：当前仅支持单题建议，后续可扩展分组建议。
 */
export interface DescriptionToQuestionnaireLLMItem {
    readonly q: number;
    readonly score: LikertScore;
    readonly confidence: number;
    readonly reason: string;
}

/**
 * 描述->问卷建议的 LLM 输出结构。
 *
 * 用途：约束模型返回必须包裹在 `suggestions` 数组中。
 * 使用场景：响应 JSON 解析后的结构守卫。
 * 关联类型：`DescriptionToQuestionnaireLLMItem`。
 * 问题/改进：后续可附加总体摘要与风险提示字段。
 */
export interface DescriptionToQuestionnaireLLMResponse {
    readonly suggestions: readonly DescriptionToQuestionnaireLLMItem[];
}
