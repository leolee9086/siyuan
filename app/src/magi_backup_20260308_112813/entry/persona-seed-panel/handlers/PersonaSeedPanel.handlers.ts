import {
    applySuggestionToAnswers,
    applySuggestionToDescriptions,
    countSuggestionsByStatus,
    transitionConvergenceState,
    updateSuggestionStatus,
} from "../../../data/convergence/persona-seed-convergence";
import type { IpipPersonaSeedDescriptions } from "../../../data/questionnaire.types";
import type { LikertScore } from "../../../components/persona/CompositeRating.types";
import type { PanelState } from "../PersonaSeedPanel.types";
import {
    findAnswerScore,
    getDescriptionFieldLabel,
    getSuggestionById,
} from "../PersonaSeedPanel.utils";

/**
 * 作用：当指定题号的建议被解决时，清除正在查看的建议 id。
 * 意图：避免用户查看已失效的建议预览。
 * 调用时机：作答或接受/拒绝建议后调用。
 */
function clearViewingSuggestionWhenResolved(s: PanelState, q: number): void {
    // 无正在查看的建议时跳过
    if (!s.viewingSuggestionId.value) {
        return;
    }
    const suggestion = getSuggestionById(s.convergenceSession.value.suggestions, s.viewingSuggestionId.value);
    // 建议不存在或非问卷类型时直接清除
    if (!suggestion || suggestion.payload.kind !== "questionnaire_answer") {
        s.viewingSuggestionId.value = "";
        return;
    }
    // 仅当题号匹配时清除
    if (suggestion.payload.q === q) {
        s.viewingSuggestionId.value = "";
    }
}

/**
 * 作用：当建议被接受/拒绝后，按建议 id 清理查看状态。
 * 意图：避免描述类建议在状态变更后仍显示旧预览。
 * 调用时机：accept/reject 建议后调用。
 */
function clearViewingSuggestionById(s: PanelState, id: string): void {
    if (s.viewingSuggestionId.value !== id) {
        return;
    }
    s.viewingSuggestionId.value = "";
}

/**
 * 作用：注销指定题号的所有待确认建议。
 * 意图：用户手动作答后，该题的建议不再有意义，自动拒绝。
 * 调用时机：onAnswerUpdated 中用户作答后调用。
 */
function dismissPendingSuggestionsForQuestion(s: PanelState, q: number): number {
    let dismissedCount = 0;
    let session = transitionConvergenceState(s.convergenceSession.value, "applying");
    for (const suggestion of session.suggestions) {
        // 仅处理待确认的问卷类型建议且题号匹配
        if (suggestion.status !== "pending") {
            continue;
        }
        if (suggestion.payload.kind !== "questionnaire_answer") {
            continue;
        }
        if (suggestion.payload.q !== q) {
            continue;
        }
        session = updateSuggestionStatus(session, suggestion.id, "rejected");
        dismissedCount += 1;
    }
    // 无建议被注销时保持原状
    if (dismissedCount === 0) {
        return 0;
    }
    const nextState = countSuggestionsByStatus(session, "pending") > 0 ? "ready" : "done";
    s.convergenceSession.value = transitionConvergenceState(session, nextState);
    clearViewingSuggestionWhenResolved(s, q);
    return dismissedCount;
}

/**
 * 作用：查看指定建议的详情并定位到对应题目。
 * 意图：让用户在问卷中直观对比当前分值与建议分值。
 * 调用时机：用户点击建议列表中的"查看"按钮时调用。
 */
function handleViewSuggestion(s: PanelState, id: string): void {
    const suggestion = getSuggestionById(s.convergenceSession.value.suggestions, id);
    // 仅对待确认建议生效
    if (!suggestion || suggestion.status !== "pending") {
        return;
    }
    s.viewingSuggestionId.value = id;
    // 问卷建议沿用“定位到题目”流程，描述建议走差异预览流程。
    if (suggestion.payload.kind === "questionnaire_answer") {
        s.focusQuestionQ.value = suggestion.payload.q;
        s.focusQuestionRequestId.value += 1;
        const currentScore = findAnswerScore(s.answers.value, suggestion.payload.q);
        const currentScoreText = currentScore === null ? "未作答" : String(currentScore);
        s.statusMessage.value = `已定位 Q${suggestion.payload.q}，当前 ${currentScoreText}，建议 ${suggestion.payload.score}。选择任意分值将注销该建议。`;
        return;
    }
    s.focusQuestionQ.value = null;
    const fieldLabel = getDescriptionFieldLabel(suggestion.payload.field);
    s.statusMessage.value = `已打开${fieldLabel}建议差异预览。`;
}

/**
 * 作用：用户作答后更新答案列表并注销对应建议。
 * 意图：保持答案与建议状态同步。
 * 调用时机：CompositeRating 触发 update:ipip-answer 事件时调用。
 */
function handleAnswerUpdated(
    s: PanelState,
    saveDraft: () => void,
    answer: { q: number; score: LikertScore },
): void {
    const nextAnswers = s.answers.value.filter((item) => item.q !== answer.q);
    nextAnswers.push(answer);
    s.answers.value = nextAnswers;
    const dismissedCount = dismissPendingSuggestionsForQuestion(s, answer.q);
    // 有建议被注销时更新状态消息
    if (dismissedCount > 0) {
        s.statusMessage.value = `已作答 Q${answer.q}=${answer.score}，并注销 ${dismissedCount} 条对应建议。`;
    }
    saveDraft();
}

/**
 * 作用：接受一条建议，将其内容写入答案或描述。
 * 意图：用户确认建议后自动应用变更并推进收敛状态。
 * 调用时机：用户点击建议列表中的"接受"按钮时调用。
 */
function handleAcceptSuggestion(
    s: PanelState,
    saveDraft: () => void,
    assignDescriptions: (d: IpipPersonaSeedDescriptions) => void,
    id: string,
): void {
    const suggestion = getSuggestionById(s.convergenceSession.value.suggestions, id);
    // 建议不存在时跳过
    if (!suggestion) {
        return;
    }
    const applyingSession = transitionConvergenceState(s.convergenceSession.value, "applying");
    s.convergenceSession.value = updateSuggestionStatus(applyingSession, id, "accepted");
    s.answers.value = applySuggestionToAnswers(s.answers.value, suggestion);
    assignDescriptions(applySuggestionToDescriptions(s.seedDescriptions.value, suggestion));
    clearViewingSuggestionById(s, id);
    // 问卷类型建议被接受后清除查看状态
    if (suggestion.payload.kind === "questionnaire_answer") {
        clearViewingSuggestionWhenResolved(s, suggestion.payload.q);
    }
    const nextState = s.pendingSuggestionCount.value > 0 ? "ready" : "done";
    s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, nextState);
    s.statusMessage.value = `已接受建议并应用，描述进度 ${s.descriptionProgressText.value}，剩余待确认 ${s.pendingSuggestionCount.value} 条。`;
    saveDraft();
}

/**
 * 作用：拒绝一条建议，不应用其内容。
 * 意图：用户不认可建议时标记为已拒绝并推进收敛状态。
 * 调用时机：用户点击建议列表中的"拒绝"按钮时调用。
 */
function handleRejectSuggestion(s: PanelState, saveDraft: () => void, id: string): void {
    const suggestion = getSuggestionById(s.convergenceSession.value.suggestions, id);
    // 建议不存在时跳过
    if (!suggestion) {
        return;
    }
    const applyingSession = transitionConvergenceState(s.convergenceSession.value, "applying");
    s.convergenceSession.value = updateSuggestionStatus(applyingSession, id, "rejected");
    clearViewingSuggestionById(s, id);
    // 问卷类型建议被拒绝后清除查看状态
    if (suggestion.payload.kind === "questionnaire_answer") {
        clearViewingSuggestionWhenResolved(s, suggestion.payload.q);
    }
    const nextState = s.pendingSuggestionCount.value > 0 ? "ready" : "done";
    s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, nextState);
    s.statusMessage.value = `已拒绝建议，描述进度 ${s.descriptionProgressText.value}，剩余待确认 ${s.pendingSuggestionCount.value} 条。`;
    saveDraft();
}

/** @同步豁免: UI构建 — 创建查看建议处理器供模板事件绑定 */
/**
 * 作用：创建查看建议处理器。
 * 意图：将 PanelState 闭包绑定，供模板事件使用。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createViewSuggestionHandler(s: PanelState): (id: string) => void {
    return (id: string) => handleViewSuggestion(s, id);
}

/** @同步豁免: UI构建 — 创建作答处理器供 CompositeRating 事件绑定 */
/**
 * 作用：创建作答更新处理器。
 * 意图：将 PanelState 和 saveDraft 闭包绑定。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createAnswerUpdatedHandler(
    s: PanelState,
    saveDraft: () => void,
): (answer: { q: number; score: LikertScore }) => void {
    return (answer) => handleAnswerUpdated(s, saveDraft, answer);
}

/** @同步豁免: UI构建 — 创建接受建议处理器供模板事件绑定 */
/**
 * 作用：创建接受建议处理器。
 * 意图：将 PanelState、saveDraft、assignDescriptions 闭包绑定。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createAcceptSuggestionHandler(
    s: PanelState,
    saveDraft: () => void,
    assignDescriptions: (d: IpipPersonaSeedDescriptions) => void,
): (id: string) => void {
    return (id: string) => handleAcceptSuggestion(s, saveDraft, assignDescriptions, id);
}

/** @同步豁免: UI构建 — 创建拒绝建议处理器供模板事件绑定 */
/**
 * 作用：创建拒绝建议处理器。
 * 意图：将 PanelState 和 saveDraft 闭包绑定。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createRejectSuggestionHandler(
    s: PanelState,
    saveDraft: () => void,
): (id: string) => void {
    return (id: string) => handleRejectSuggestion(s, saveDraft, id);
}

