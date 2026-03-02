import { ipipNeo120QuestionBank } from "../../data/ipip-neo-120";
import {
    applySuggestionToAnswers,
    applySuggestionToDescriptions,
    countSuggestionsByStatus,
    setConvergenceSuggestions,
    transitionConvergenceState,
    updateSuggestionStatus,
} from "../../data/convergence/persona-seed-convergence";
import { generateDescriptionToQuestionnaireSuggestions } from "../../data/convergence/persona-seed-convergence-llm";
import type { IpipNeo120SubmissionPayload, IpipPersonaSeedDescriptions } from "../../data/questionnaire.types";
import type { LikertScore } from "../../components/persona/CompositeRating.types";
import type { PanelState } from "./PersonaSeedPanel.types";
import { collectMissingFields, findAnswerScore, getSuggestionById, hasAnyDescriptionText, saveSubmissionPayload } from "./PersonaSeedPanel.utils";

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
    // 仅对待确认的问卷类型建议生效
    if (!suggestion || suggestion.payload.kind !== "questionnaire_answer" || suggestion.status !== "pending") {
        return;
    }
    s.viewingSuggestionId.value = id;
    s.focusQuestionQ.value = suggestion.payload.q;
    s.focusQuestionRequestId.value += 1;
    const currentScore = findAnswerScore(s.answers.value, suggestion.payload.q);
    const currentScoreText = currentScore === null ? "未作答" : String(currentScore);
    s.statusMessage.value = `已定位 Q${suggestion.payload.q}，当前 ${currentScoreText}，建议 ${suggestion.payload.score}。选择任意分值将注销该建议。`;
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
    // 问卷类型建议被拒绝后清除查看状态
    if (suggestion.payload.kind === "questionnaire_answer") {
        clearViewingSuggestionWhenResolved(s, suggestion.payload.q);
    }
    const nextState = s.pendingSuggestionCount.value > 0 ? "ready" : "done";
    s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, nextState);
    s.statusMessage.value = `已拒绝建议，描述进度 ${s.descriptionProgressText.value}，剩余待确认 ${s.pendingSuggestionCount.value} 条。`;
    saveDraft();
}

/**
 * 作用：基于四轨描述调用 LLM 生成问卷建议。
 * 意图：实现描述->问卷的双向收敛。
 * 调用时机：用户点击"描述->问卷建议"按钮时调用。
 */
async function handleGenerateDescriptionToQuestionnaire(s: PanelState, saveDraft: () => void): Promise<void> {
    // 防止重复触发
    if (s.isGeneratingDescriptionToQuestionnaire.value) {
        return;
    }
    // 至少需要一项描述才能生成建议
    if (!hasAnyDescriptionText(s.seedDescriptions.value)) {
        s.statusMessage.value = "请先填写至少一项描述，再生成问卷建议。";
        return;
    }
    s.isGeneratingDescriptionToQuestionnaire.value = true;
    s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, "generating");
    s.statusMessage.value = "正在基于描述生成问卷建议...";
    try {
        const suggestions = await generateDescriptionToQuestionnaireSuggestions({
            subjectId: s.subjectId.value || "zhi",
            subjectName: s.subjectName.value || "zhi",
            descriptions: s.seedDescriptions.value,
            answers: s.answers.value,
            questionBank: ipipNeo120QuestionBank,
        });
        s.convergenceSession.value = setConvergenceSuggestions(s.convergenceSession.value, suggestions);
        const generatedCount = countSuggestionsByStatus(s.convergenceSession.value, "pending");
        // 有建议生成时提示数量
        if (generatedCount > 0) {
            s.statusMessage.value = `已生成 ${generatedCount} 条待确认建议。`;
        }
        // 无建议生成时提示补充描述
        if (generatedCount === 0) {
            s.statusMessage.value = "未生成可用建议，请补充描述后重试。";
        }
        saveDraft();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, "error", message);
        s.statusMessage.value = `建议生成失败: ${message}`;
    } finally {
        s.isGeneratingDescriptionToQuestionnaire.value = false;
    }
}

/**
 * 作用：提交问卷并保存人格档案。
 * 意图：将完整的问卷数据和计算后的人格档案持久化。
 * 调用时机：CompositeRating 触发 submit:ipip 事件时调用。
 */
async function handleSubmitIpip(
    s: PanelState,
    saveDraft: () => void,
    emitSaved: (filePath: string) => void,
    payload: IpipNeo120SubmissionPayload,
): Promise<void> {
    const missingFields = collectMissingFields(
        s.organization.value, s.role.value, s.careerGoal.value, s.seedDescriptions.value,
    );
    // 存在未填写字段时阻止提交并提示
    if (missingFields.length > 0) {
        s.statusMessage.value = `请先补全字段: ${missingFields.join(" / ")}`;
        return;
    }
    const enrichedPayload: IpipNeo120SubmissionPayload = {
        ...payload,
        subject: s.subjectMeta.value,
        descriptions: s.seedDescriptions.value,
    };
    try {
        s.statusMessage.value = "正在保存问卷与人格档案...";
        const { samplePath, profilePath } = await saveSubmissionPayload(enrichedPayload);
        saveDraft();
        s.statusMessage.value = `问卷已保存: ${samplePath}; 人格档案已保存: ${profilePath}`;
        emitSaved(samplePath);
    } catch (error) {
        s.statusMessage.value = `保存失败: ${error instanceof Error ? error.message : String(error)}`;
    }
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

/** @同步豁免: UI构建 — 工厂函数，同步返回异步处理器闭包 */
/**
 * 作用：创建描述->问卷建议生成处理器。
 * 意图：将 PanelState 和 saveDraft 闭包绑定。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createGenerateHandler(
    s: PanelState,
    saveDraft: () => void,
): () => Promise<void> {
    return () => handleGenerateDescriptionToQuestionnaire(s, saveDraft);
}

/** @同步豁免: UI构建 — 工厂函数，同步返回异步处理器闭包 */
/**
 * 作用：创建问卷提交处理器。
 * 意图：将 PanelState、saveDraft、emit 闭包绑定。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createSubmitHandler(
    s: PanelState,
    saveDraft: () => void,
    emitSaved: (filePath: string) => void,
): (payload: IpipNeo120SubmissionPayload) => Promise<void> {
    return (payload) => handleSubmitIpip(s, saveDraft, emitSaved, payload);
}
