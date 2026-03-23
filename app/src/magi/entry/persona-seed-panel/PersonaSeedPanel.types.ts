import type { Ref, ComputedRef } from "vue";
import type { IpipNeo120SubjectMeta, IpipPersonaSeedDescriptions } from "../../data/questionnaire.types";
import type { PersonaConvergenceSession } from "../../data/convergence/persona-seed-convergence.types";
import type { SubjectType } from "../../data/convergence/persona-seed-panel.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { PersonaSeedConfigLoadState } from "./handlers/PersonaSeedPanel.loader";

/**
 * PersonaSeedPanel 响应式状态集合。
 *
 * 用途：作为模块级处理函数的统一参数类型，避免逐个传递 ref。
 * 使用场景：所有 PersonaSeedPanel handler 函数的第一个参数。
 * 关联类型：usePersonaSeedPanelContext 返回值。
 */
export interface PanelState {
    readonly subjectId: Ref<string>;
    readonly subjectName: Ref<string>;
    readonly gender: Ref<string>;
    readonly age: Ref<number | null>;
    readonly subjectType: Ref<SubjectType>;
    readonly organization: Ref<string>;
    readonly role: Ref<string>;
    readonly careerGoal: Ref<string>;
    readonly professionalDescription: Ref<string>;
    readonly lifeDescription: Ref<string>;
    readonly instinctNeedsDescription: Ref<string>;
    readonly integratedDescription: Ref<string>;
    readonly answers: Ref<Array<{ q: number; score: LikertScore }>>;
    readonly convergenceSession: Ref<PersonaConvergenceSession>;
    readonly isGeneratingDescriptionToQuestionnaire: Ref<boolean>;
    readonly isGeneratingQuestionnaireToDescription: Ref<boolean>;
    readonly focusQuestionQ: Ref<number | null>;
    readonly focusQuestionRequestId: Ref<number>;
    readonly viewingSuggestionId: Ref<string>;
    readonly ratingVersion: Ref<number>;
    readonly statusMessage: Ref<string>;
    readonly configLoadState: Ref<PersonaSeedConfigLoadState>;
    readonly configLoadMessage: Ref<string>;
    readonly activeProfilePath: Ref<string>;
    readonly activeSamplePath: Ref<string>;
    readonly seedDescriptions: ComputedRef<IpipPersonaSeedDescriptions>;
    readonly subjectMeta: ComputedRef<IpipNeo120SubjectMeta>;
    readonly pendingSuggestionCount: ComputedRef<number>;
    readonly descriptionProgressText: ComputedRef<string>;
}

/**
 * PersonaSeedPanel 保存事件载荷。
 *
 * 用途：向上层传递问卷样本路径与人格档案路径。
 */
export interface PersonaSeedSavedPayload {
    readonly source?: "submission" | "import";
    readonly samplePath: string;
    readonly profilePath?: string;
}

/** PersonaSeedPanel `saved` 事件联合类型（兼容旧版字符串载荷）。 */
export type PersonaSeedSavedEvent = string | PersonaSeedSavedPayload;
