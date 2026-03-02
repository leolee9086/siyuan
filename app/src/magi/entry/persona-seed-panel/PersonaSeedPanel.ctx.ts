import { computed, watch } from "vue";
import { ipipNeo120QuestionBank } from "../../data/ipip-neo-120";
import { applySuggestionToDescriptions, countSuggestionsByStatus } from "../../data/convergence/persona-seed-convergence";
import type { PersonaConvergenceSuggestion } from "../../data/convergence/persona-seed-convergence.types";
import type { IpipPersonaSeedDescriptions } from "../../data/questionnaire.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";
import { createLineDiffEngine } from "../../../util/diff/diff.engine";
import type { DiffModel } from "../../../util/diff/diff.types";
import type { PanelState, PersonaSeedSavedPayload } from "./PersonaSeedPanel.types";
import {
    canGenerateTrinityDescriptionSuggestion,
    findAnswerScore,
    getDescriptionFieldLabel,
    getSuggestionById,
} from "./PersonaSeedPanel.utils";
import { createSaveDraftHandler, createLoadDraftHandler, createAssignDescriptionsHandler } from "./PersonaSeedPanel.draft";
import {
    createViewSuggestionHandler,
    createAnswerUpdatedHandler,
    createAcceptSuggestionHandler,
    createRejectSuggestionHandler,
} from "./handlers/PersonaSeedPanel.handlers";
import {
    createGenerateHandler,
    createGenerateQuestionnaireToDescriptionHandler,
    createSubmitHandler,
} from "./handlers/PersonaSeedPanel.async.handlers";
import { createPanelState } from "./PersonaSeedPanel.state";

const lineDiffEngine = createLineDiffEngine();

/**
 * 作用：计算当前正在查看的建议摘要信息。
 * 意图：供模板展示建议预览区域。
 * 调用时机：viewingSuggestionSummary computed 求值时调用。
 */
function computeViewingSuggestionSummary(
    suggestions: readonly PersonaConvergenceSuggestion[],
    viewingId: string,
    answersArray: ReadonlyArray<{ q: number; score: LikertScore }>,
): { q: number; currentScoreText: string; suggestedScore: number } | null {
    const suggestion = getSuggestionById(suggestions, viewingId);
    // 仅当建议存在、为问卷类型且处于待确认状态时才显示摘要
    if (!suggestion || suggestion.payload.kind !== "questionnaire_answer" || suggestion.status !== "pending") {
        return null;
    }
    const currentScore = findAnswerScore(answersArray, suggestion.payload.q);
    return {
        q: suggestion.payload.q,
        currentScoreText: currentScore === null ? "未作答" : String(currentScore),
        suggestedScore: suggestion.payload.score,
    };
}

/**
 * 作用：计算当前正在查看的描述建议差异模型。
 * 意图：供描述建议查看面板展示“当前文本 vs 建议应用后文本”。
 * 调用时机：viewingDescriptionDiff computed 求值时调用。
 */
function computeViewingDescriptionDiff(
    suggestions: readonly PersonaConvergenceSuggestion[],
    viewingId: string,
    descriptions: IpipPersonaSeedDescriptions,
): { field: keyof IpipPersonaSeedDescriptions; fieldLabel: string; model: DiffModel } | null {
    const suggestion = getSuggestionById(suggestions, viewingId);
    // 仅当建议存在、为描述类型且处于待确认状态时才显示差异预览
    if (!suggestion || suggestion.payload.kind !== "description_append" || suggestion.status !== "pending") {
        return null;
    }
    const field = suggestion.payload.field;
    const oldText = descriptions[field];
    const nextDescriptions = applySuggestionToDescriptions(descriptions, suggestion);
    const newText = nextDescriptions[field];
    // 应用后无变化时不展示差异视图
    if (oldText === newText) {
        return null;
    }
    return {
        field,
        fieldLabel: getDescriptionFieldLabel(field),
        model: lineDiffEngine.build({
            oldText,
            newText,
            fileName: field,
            contextLines: 2,
            granularity: "line",
        }),
    };
}

/**
 * 作用：注册自动保存/加载的 watch 副作用。
 * 意图：将 watcher 逻辑从 composable 主体中分离，控制函数行数。
 * 调用时机：usePersonaSeedPanelContext 内部调用一次。
 */
function wireAutoSave(s: PanelState, saveDraft: () => void, loadDraft: (id: string) => void): void {
    loadDraft(s.subjectId.value);
    // subjectId 变更时重新加载草稿
    watch(s.subjectId, (value, oldValue) => {
        // 空值或相同值不触发
        if (!value || value === oldValue) {
            return;
        }
        loadDraft(value);
    });
    // 主体元信息变更时自动保存
    watch(s.subjectMeta, () => saveDraft());
    // 四轨描述变更时自动保存
    watch(s.seedDescriptions, () => saveDraft());
    // 收敛会话变更时自动保存
    watch(s.convergenceSession, () => saveDraft(), { deep: true });
}

/** @同步豁免: UI构建 — Vue composable 必须同步返回响应式上下文供 setup 使用 */
/**
 * 构建 PersonaSeedPanel 组件上下文。
 *
 * 作用：集中创建响应式状态、计算属性和 UI 事件处理函数。
 * 意图：满足 Fat Script 约束，让 .vue 文件仅保留装配层代码。
 * 调用时机：PersonaSeedPanel.vue setup 阶段调用一次。
 */
export function usePersonaSeedPanelContext(emit: {
    (e: "close"): void;
    (e: "saved", payload: PersonaSeedSavedPayload): void;
}) {
    const s = createPanelState();
    const saveDraft = createSaveDraftHandler(s);
    const loadDraft = createLoadDraftHandler(s);
    const assignDescriptions = createAssignDescriptionsHandler(s);

    wireAutoSave(s, saveDraft, loadDraft);

    return {
        ...s,
        questionBank: ipipNeo120QuestionBank,
        emit,
        ratingKey: computed(() => `${s.subjectId.value}-${s.ratingVersion.value}`),
        acceptedSuggestionCount: computed(() => countSuggestionsByStatus(s.convergenceSession.value, "accepted")),
        rejectedSuggestionCount: computed(() => countSuggestionsByStatus(s.convergenceSession.value, "rejected")),
        pendingSuggestions: computed(() => s.convergenceSession.value.suggestions.filter((x: PersonaConvergenceSuggestion) => x.status === "pending")),
        canGenerateTrinitySuggestion: computed(() => canGenerateTrinityDescriptionSuggestion(
            s.seedDescriptions.value,
            s.answers.value.length,
            ipipNeo120QuestionBank.length,
        )),
        viewingSuggestionSummary: computed(() => computeViewingSuggestionSummary(s.convergenceSession.value.suggestions, s.viewingSuggestionId.value, s.answers.value)),
        viewingDescriptionDiff: computed(() => computeViewingDescriptionDiff(
            s.convergenceSession.value.suggestions,
            s.viewingSuggestionId.value,
            s.seedDescriptions.value,
        )),
        onAnswerUpdated: createAnswerUpdatedHandler(s, saveDraft),
        acceptSuggestion: createAcceptSuggestionHandler(s, saveDraft, assignDescriptions),
        rejectSuggestion: createRejectSuggestionHandler(s, saveDraft),
        viewSuggestion: createViewSuggestionHandler(s),
        generateDescriptionToQuestionnaire: createGenerateHandler(s, saveDraft),
        generateQuestionnaireToDescription: createGenerateQuestionnaireToDescriptionHandler(s, saveDraft),
        onSubmitIpip: createSubmitHandler(s, saveDraft, (payload) => emit("saved", payload)),
        saveDraft,
        loadDraft,
    };
}
