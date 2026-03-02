import { computed, ref } from "vue";
import {
    countSuggestionsByStatus,
    createEmptyConvergenceSession,
} from "../../data/convergence/persona-seed-convergence";
import type {
    IpipNeo120SubjectMeta,
    IpipPersonaSeedDescriptions,
} from "../../data/questionnaire.types";
import type { PersonaConvergenceSession } from "../../data/convergence/persona-seed-convergence.types";
import type { SubjectType } from "../../data/convergence/persona-seed-panel.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { PanelState } from "./PersonaSeedPanel.types";

/** @同步豁免: UI构建 — computed 回调，聚合四轨描述 ref 为单一对象 */
/**
 * 作用：将四个描述 ref 聚合为 IpipPersonaSeedDescriptions。
 * 调用时机：seedDescriptions computed 求值时。
 */
function buildSeedDescriptions(s: {
    readonly professionalDescription: { readonly value: string };
    readonly lifeDescription: { readonly value: string };
    readonly instinctNeedsDescription: { readonly value: string };
    readonly integratedDescription: { readonly value: string };
}): IpipPersonaSeedDescriptions {
    return {
        professionalDescription: s.professionalDescription.value,
        lifeDescription: s.lifeDescription.value,
        instinctNeedsDescription: s.instinctNeedsDescription.value,
        integratedDescription: s.integratedDescription.value,
    };
}

/** @同步豁免: UI构建 — computed 回调，聚合主体元信息 ref 为单一对象 */
/**
 * 作用：将主体相关 ref 聚合为 IpipNeo120SubjectMeta。
 * 调用时机：subjectMeta computed 求值时。
 */
function buildSubjectMeta(s: {
    readonly subjectId: { readonly value: string };
    readonly subjectName: { readonly value: string };
    readonly subjectType: { readonly value: SubjectType };
    readonly organization: { readonly value: string };
    readonly role: { readonly value: string };
    readonly careerGoal: { readonly value: string };
}): IpipNeo120SubjectMeta {
    return {
        id: s.subjectId.value || "zhi",
        name: s.subjectName.value || "zhi",
        type: s.subjectType.value,
        organization: s.organization.value,
        role: s.role.value,
        careerGoal: s.careerGoal.value,
    };
}

/** @同步豁免: UI构建 — computed 回调，统计已填写描述数量 */
/**
 * 作用：统计四轨描述中已填写（非空白）的数量并格式化。
 * 调用时机：descriptionProgressText computed 求值时。
 */
function formatDescriptionProgress(s: {
    readonly professionalDescription: { readonly value: string };
    readonly lifeDescription: { readonly value: string };
    readonly instinctNeedsDescription: { readonly value: string };
    readonly integratedDescription: { readonly value: string };
}): string {
    let count = 0;
    // 逐个检查四轨描述是否已填写
    if (s.professionalDescription.value.trim()) {
        count += 1;
    }
    // 生活描述
    if (s.lifeDescription.value.trim()) {
        count += 1;
    }
    // 本能需求描述
    if (s.instinctNeedsDescription.value.trim()) {
        count += 1;
    }
    // 整合描述
    if (s.integratedDescription.value.trim()) {
        count += 1;
    }
    return `${count}/4`;
}

/** @同步豁免: UI构建 — 创建 Vue 响应式状态供 composable 使用 */
/**
 * 作用：集中创建 PersonaSeedPanel 所有响应式 ref 和 computed。
 * 意图：从 composable 中分离状态创建，控制函数行数。
 * 调用时机：usePersonaSeedPanelContext 内部调用一次。
 */
export function createPanelState(): PanelState {
    const subjectId = ref("zhi");
    const subjectName = ref("ZHI");
    const subjectType = ref<SubjectType>("ai_agent");
    const organization = ref("");
    const role = ref("");
    const careerGoal = ref("");
    const professionalDescription = ref("");
    const lifeDescription = ref("");
    const instinctNeedsDescription = ref("");
    const integratedDescription = ref("");
    const answers = ref<Array<{ q: number; score: LikertScore }>>([]);
    const convergenceSession = ref<PersonaConvergenceSession>(createEmptyConvergenceSession());
    const isGeneratingDescriptionToQuestionnaire = ref(false);
    const focusQuestionQ = ref<number | null>(null);
    const focusQuestionRequestId = ref(0);
    const viewingSuggestionId = ref("");
    const ratingVersion = ref(0);
    const statusMessage = ref("");

    const refs = {
        subjectId, subjectName, subjectType,
        organization, role, careerGoal,
        professionalDescription, lifeDescription,
        instinctNeedsDescription, integratedDescription,
    };

    const seedDescriptions = computed<IpipPersonaSeedDescriptions>(() => buildSeedDescriptions(refs));
    const subjectMeta = computed<IpipNeo120SubjectMeta>(() => buildSubjectMeta(refs));
    const pendingSuggestionCount = computed(() => countSuggestionsByStatus(convergenceSession.value, "pending"));
    const descriptionProgressText = computed(() => formatDescriptionProgress(refs));

    return {
        ...refs,
        answers,
        convergenceSession,
        isGeneratingDescriptionToQuestionnaire,
        focusQuestionQ,
        focusQuestionRequestId,
        viewingSuggestionId,
        ratingVersion,
        statusMessage,
        seedDescriptions,
        subjectMeta,
        pendingSuggestionCount,
        descriptionProgressText,
    };
}
