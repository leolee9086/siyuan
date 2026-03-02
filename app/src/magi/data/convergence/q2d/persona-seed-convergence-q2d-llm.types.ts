import type { IpipNeo120Item } from "../../ipip-neo-120.types";
import type { IpipNeo120SubjectMeta } from "../../questionnaire.types";
import type { PersonaSeedAnswerScore } from "../persona-seed-convergence-llm.types";

/**
 * 侧面描述字段（仅三侧）。
 *
 * 用途：约束“问卷 -> 描述建议”一次只能命中一个侧面描述。
 * 使用场景：LLM 输出校验、建议 payload 构造。
 * 关联类型：`QuestionnaireToDescriptionLLMItem`。
 * 问题/改进：当前不包含 integratedDescription，后续可按产品策略扩展。
 */
export type PersonaSideDescriptionField =
    | "professionalDescription"
    | "lifeDescription"
    | "instinctNeedsDescription";

/**
 * 问卷 -> 描述建议输入。
 *
 * 用途：收拢建议生成所需的基础资料、旧描述与问卷答案上下文。
 * 使用场景：PersonaSeedPanel 点击“问卷 -> 描述建议”时调用。
 * 关联类型：`IpipNeo120SubjectMeta`、`PersonaSeedAnswerScore`、`IpipNeo120Item`。
 * 问题/改进：当前为单轮输入，后续可加历史确认记录。
 */
export interface QuestionnaireToDescriptionSuggestionInput {
    readonly subject: IpipNeo120SubjectMeta;
    readonly sideDescriptions: Readonly<Record<PersonaSideDescriptionField, string>>;
    readonly answers: readonly PersonaSeedAnswerScore[];
    readonly questionBank: readonly IpipNeo120Item[];
}

/**
 * LLM 返回的单条描述建议结构。
 *
 * 用途：约束模型一次仅返回一个侧面描述建议。
 * 使用场景：JSON 解析后的结构守卫与转换流程。
 * 关联类型：`QuestionnaireToDescriptionLLMResponse`。
 * 问题/改进：目前 text 为纯文本追加段，后续可扩展结构化片段。
 */
export interface QuestionnaireToDescriptionLLMItem {
    readonly field: PersonaSideDescriptionField;
    readonly text: string;
    readonly confidence: number;
    readonly reason: string;
}

/**
 * 问卷 -> 描述建议 LLM 输出结构。
 *
 * 用途：要求模型输出严格单建议对象，避免一次覆盖多个侧面。
 * 使用场景：模型输出结构校验。
 * 关联类型：`QuestionnaireToDescriptionLLMItem`。
 * 问题/改进：后续如需批量建议，可增加 suggestions 数组版本。
 */
export interface QuestionnaireToDescriptionLLMResponse {
    readonly suggestion: QuestionnaireToDescriptionLLMItem;
}
