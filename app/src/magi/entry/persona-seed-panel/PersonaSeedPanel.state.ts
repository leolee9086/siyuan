import { computed, ref } from "vue";
import {
    countSuggestionsByStatus,
    createEmptyConvergenceSession,
} from "../../data/convergence/persona-seed-convergence";
import type {
    IpipNeo120SubjectMeta,
    IpipPersonaSeedDescriptions,
    SubjectCognitiveStances,
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
    readonly gender: { readonly value: string };
    readonly age: { readonly value: number | null };
    readonly subjectType: { readonly value: SubjectType };
    readonly organization: { readonly value: string };
    readonly role: { readonly value: string };
    readonly careerGoal: { readonly value: string };
    readonly profession: { readonly value: string };
    readonly primarySocialRelation: { readonly value: string };
    readonly selfName: { readonly value: string };
}): IpipNeo120SubjectMeta {
    const gender = s.gender.value.trim();
    const cognitiveStances = buildSubjectCognitiveStances(s);
    return {
        id: s.subjectId.value.trim(),
        name: s.subjectName.value.trim(),
        ...(gender ? { gender } : {}),
        ...(Number.isInteger(s.age.value) ? { age: s.age.value } : {}),
        type: s.subjectType.value,
        organization: s.organization.value,
        role: s.role.value,
        careerGoal: s.careerGoal.value,
        ...(cognitiveStances ? { cognitiveStances } : {}),
    };
}

/** @同步豁免: UI构建 — computed 回调中的纯字符串裁剪与对象拼装 */
function buildSubjectCognitiveStances(s: {
    readonly profession: { readonly value: string };
    readonly primarySocialRelation: { readonly value: string };
    readonly selfName: { readonly value: string };
}): SubjectCognitiveStances | undefined {
    const profession = s.profession.value.trim();
    const primarySocialRelation = s.primarySocialRelation.value.trim();
    const selfName = s.selfName.value.trim();
    if (!profession && !primarySocialRelation && !selfName) {
        return undefined;
    }
    return {
        profession,
        primarySocialRelation,
        selfName,
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
    const subjectId = ref("");
    const subjectName = ref("");
    const gender = ref("");
    const age = ref<number | null>(null);
    const subjectType = ref<SubjectType>("ai_agent");
    const organization = ref("");
    const role = ref("");
    const careerGoal = ref("");
    const profession = ref("");
    const primarySocialRelation = ref("");
    const selfName = ref("");
    const professionalDescription = ref("");
    const lifeDescription = ref("");
    const instinctNeedsDescription = ref("");
    const integratedDescription = ref("");
    const answers = ref<Array<{ q: number; score: LikertScore }>>([]);
    const convergenceSession = ref<PersonaConvergenceSession>(createEmptyConvergenceSession());
    const isGeneratingDescriptionToQuestionnaire = ref(false);
    const isGeneratingQuestionnaireToDescription = ref(false);
    const focusQuestionQ = ref<number | null>(null);
    const focusQuestionRequestId = ref(0);
    const viewingSuggestionId = ref("");
    const ratingVersion = ref(0);
    const statusMessage = ref("");
    const configLoadState = ref<PanelState["configLoadState"]["value"]>("loading");
    const configLoadMessage = ref("正在读取当前主管AI配置...");
    const activeProfilePath = ref("");
    const activeSamplePath = ref("");

    const refs = {
        subjectId, subjectName, gender, age, subjectType,
        organization, role, careerGoal,
        profession, primarySocialRelation, selfName,
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
        isGeneratingQuestionnaireToDescription,
        focusQuestionQ,
        focusQuestionRequestId,
        viewingSuggestionId,
        ratingVersion,
        statusMessage,
        configLoadState,
        configLoadMessage,
        activeProfilePath,
        activeSamplePath,
        seedDescriptions,
        subjectMeta,
        pendingSuggestionCount,
        descriptionProgressText,
    };
}
