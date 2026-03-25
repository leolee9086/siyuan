import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { IpipPersonaSeedDescriptions, SubjectCognitiveStances } from "../questionnaire.types";
import type { PersonaConvergenceSession } from "./persona-seed-convergence.types";

/**
 * 被试主体类型。
 *
 * 用途：约束人格种子录入面板中的主体类型字段。
 * 使用场景：`PersonaSeedPanel` 的主体信息录入和提交载荷。
 * 关联类型：`QuestionnaireDraft`。
 * 问题/改进：当前仅 human/ai_agent，后续可根据产品需求扩展。
 */
export type SubjectType = "human" | "ai_agent";

/**
 * 问卷草稿主体字段。
 *
 * 用途：承载草稿中主体元信息的存储结构。
 * 使用场景：草稿保存与恢复。
 * 关联类型：`SubjectType`、`QuestionnaireDraft`。
 * 问题/改进：如后续新增主体字段，需要同步更新保存与恢复逻辑。
 */
export interface QuestionnaireDraftSubject {
    readonly id: string;
    readonly name: string;
    readonly gender: string;
    readonly age: number | null;
    readonly type: SubjectType;
    readonly organization: string;
    readonly role: string;
    readonly careerGoal: string;
    readonly cognitiveStances?: SubjectCognitiveStances;
}

/**
 * 问卷草稿结构。
 *
 * 用途：定义 PersonaSeed 面板本地草稿存储格式。
 * 使用场景：localStorage 持久化、刷新恢复、多次编辑续写。
 * 关联类型：`QuestionnaireDraftSubject`、`IpipPersonaSeedDescriptions`、`PersonaConvergenceSession`。
 * 问题/改进：当前使用单 key 草稿，后续可增加版本号字段支持迁移。
 */
export interface QuestionnaireDraft {
    readonly subject: QuestionnaireDraftSubject;
    readonly descriptions: IpipPersonaSeedDescriptions;
    readonly answers: Array<{ q: number; score: LikertScore }>;
    readonly convergence?: PersonaConvergenceSession;
}
