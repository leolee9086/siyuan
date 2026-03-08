import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { IpipPersonaSeedDescriptions } from "../questionnaire.types";

/**
 * 收敛建议来源类型。
 *
 * 用途：标记建议来自“描述推问卷”还是“问卷补描述”方向。
 * 使用场景：建议列表分组展示、来源过滤、日志追踪。
 * 关联类型：`PersonaConvergenceSuggestion`。
 * 问题/改进：当前仅支持双向收敛两种来源，后续可扩展为人工建议来源。
 */
export type PersonaConvergenceSuggestionSource =
    | "description_to_questionnaire"
    | "questionnaire_to_description";

/**
 * 收敛建议状态类型。
 *
 * 用途：表示建议在确认流程中的状态机节点。
 * 使用场景：UI 按钮禁用、回写逻辑分支、持久化恢复。
 * 关联类型：`PersonaConvergenceSuggestion`。
 * 问题/改进：当前三态足够 Phase 3，后续可增加“撤销”态。
 */
export type PersonaConvergenceSuggestionStatus = "pending" | "accepted" | "rejected";

/**
 * 收敛会话运行状态。
 *
 * 用途：表示一次建议生成与确认流程的总体状态。
 * 使用场景：面板状态栏展示、按钮可用性控制、错误提示。
 * 关联类型：`PersonaConvergenceSession`。
 * 问题/改进：目前为前端本地状态，后续如需多端同步可增加服务端状态。
 */
export type PersonaConvergenceState =
    | "idle"
    | "generating"
    | "ready"
    | "applying"
    | "done"
    | "error";

/**
 * 问卷建议负载。
 *
 * 用途：承载对单题的建议分值与覆盖策略。
 * 使用场景：描述->问卷建议生成后写回问卷答案。
 * 关联类型：`PersonaConvergenceSuggestionPayload`。
 * 问题/改进：当前粒度是单题，后续可增加批量分组建议能力。
 */
export interface PersonaConvergenceQuestionnairePayload {
    readonly kind: "questionnaire_answer";
    readonly q: number;
    readonly score: LikertScore;
    readonly onlyWhenUnanswered: boolean;
}

/**
 * 描述建议负载。
 *
 * 用途：承载针对四轨描述某一字段的补充文本建议。
 * 使用场景：问卷->描述补充建议确认后回写文本框。
 * 关联类型：`PersonaConvergenceSuggestionPayload`。
 * 问题/改进：当前采用追加策略，后续可扩展替换/重写策略。
 */
export interface PersonaConvergenceDescriptionPayload {
    readonly kind: "description_append";
    readonly field: keyof IpipPersonaSeedDescriptions;
    readonly text: string;
    readonly separator?: string;
}

/**
 * 收敛建议负载联合类型。
 *
 * 用途：统一承载问卷建议与描述建议。
 * 使用场景：建议列表渲染、确认写回逻辑分派。
 * 关联类型：`PersonaConvergenceQuestionnairePayload`、`PersonaConvergenceDescriptionPayload`。
 * 问题/改进：联合类型增长时建议配套 guard 工具集中管理。
 */
export type PersonaConvergenceSuggestionPayload =
    | PersonaConvergenceQuestionnairePayload
    | PersonaConvergenceDescriptionPayload;

/**
 * 单条收敛建议数据结构。
 *
 * 用途：描述一条可确认的建议项。
 * 使用场景：建议列表展示、逐条确认/拒绝、持久化恢复。
 * 关联类型：`PersonaConvergenceSession`。
 * 问题/改进：`reason` 当前为短文本，后续可升级结构化证据链。
 */
export interface PersonaConvergenceSuggestion {
    readonly id: string;
    readonly source: PersonaConvergenceSuggestionSource;
    readonly target: "questionnaire_answer" | keyof IpipPersonaSeedDescriptions;
    readonly status: PersonaConvergenceSuggestionStatus;
    readonly confidence: number;
    readonly reason: string;
    readonly payload: PersonaConvergenceSuggestionPayload;
    readonly createdAt: string;
}

/**
 * 收敛会话数据结构。
 *
 * 用途：聚合本轮收敛流程状态和建议集合。
 * 使用场景：草稿持久化、页面刷新恢复、状态栏展示。
 * 关联类型：`PersonaConvergenceSuggestion`、`PersonaConvergenceState`。
 * 问题/改进：当前为单会话模型，后续可扩展历史会话列表。
 */
export interface PersonaConvergenceSession {
    readonly state: PersonaConvergenceState;
    readonly suggestions: readonly PersonaConvergenceSuggestion[];
    readonly updatedAt: string;
    readonly errorMessage?: string;
}
