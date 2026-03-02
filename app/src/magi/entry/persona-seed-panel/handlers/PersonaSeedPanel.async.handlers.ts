import { ipipNeo120QuestionBank } from "../../../data/ipip-neo-120";
import {
    countSuggestionsByStatus,
    setConvergenceSuggestions,
    transitionConvergenceState,
} from "../../../data/convergence/persona-seed-convergence";
import { generateDescriptionToQuestionnaireSuggestions } from "../../../data/convergence/persona-seed-convergence-llm";
import { generateQuestionnaireToDescriptionSuggestions } from "../../../data/convergence/q2d/persona-seed-convergence-q2d-llm";
import type { PersonaDescriptionField } from "../../../data/convergence/q2d/persona-seed-convergence-q2d-llm.types";
import type { IpipNeo120SubmissionPayload } from "../../../data/questionnaire.types";
import type { PanelState } from "../PersonaSeedPanel.types";
import {
    canGenerateTrinityDescriptionSuggestion,
    collectMissingFields,
    getDescriptionFieldLabel,
    hasAnyDescriptionText,
    saveSubmissionPayload,
} from "../PersonaSeedPanel.utils";

/**
 * 作用：基于四轨描述调用 LLM 生成问卷建议。
 * 意图：实现描述->问卷的双向收敛。
 * 调用时机：用户点击"描述->问卷建议"按钮时调用。
 */
async function handleGenerateDescriptionToQuestionnaire(s: PanelState, saveDraft: () => void): Promise<void> {
    // 防止重复触发或双向并发生成
    if (s.isGeneratingDescriptionToQuestionnaire.value || s.isGeneratingQuestionnaireToDescription.value) {
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
 * 作用：基于问卷作答调用 LLM 生成单条描述补充建议。
 * 意图：实现问卷->描述方向收敛，且一次只更新一个侧面描述。
 * 调用时机：用户点击"问卷 -> 描述建议"按钮时调用。
 */
async function handleGenerateQuestionnaireToDescription(
    s: PanelState,
    saveDraft: () => void,
    targetField?: PersonaDescriptionField,
): Promise<void> {
    // 防止重复触发或双向并发生成
    if (s.isGeneratingQuestionnaireToDescription.value || s.isGeneratingDescriptionToQuestionnaire.value) {
        return;
    }
    // 至少需要一条问卷作答才能推导描述建议
    if (s.answers.value.length === 0) {
        s.statusMessage.value = "请先完成至少一题问卷作答，再生成描述建议。";
        return;
    }
    const allowIntegratedSuggestion = canGenerateTrinityDescriptionSuggestion(
        s.seedDescriptions.value,
        s.answers.value.length,
        ipipNeo120QuestionBank.length,
    );
    // 指定 Trinity 目标时，先在 UI 层拦截门槛不满足场景。
    if (targetField === "integratedDescription" && !allowIntegratedSuggestion) {
        s.statusMessage.value = "Trinity 建议需先完成三侧描述，且问卷进度超过 1/3。";
        return;
    }
    s.isGeneratingQuestionnaireToDescription.value = true;
    s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, "generating");
    const targetLabel = targetField ? getDescriptionFieldLabel(targetField) : "最短侧描述";
    s.statusMessage.value = `正在基于问卷作答生成${targetLabel}建议...`;
    try {
        const suggestions = await generateQuestionnaireToDescriptionSuggestions({
            subject: s.subjectMeta.value,
            descriptions: s.seedDescriptions.value,
            preferredField: targetField,
            allowIntegratedSuggestion,
            answers: s.answers.value,
            questionBank: ipipNeo120QuestionBank,
        });
        s.convergenceSession.value = setConvergenceSuggestions(s.convergenceSession.value, suggestions);
        const generatedCount = countSuggestionsByStatus(s.convergenceSession.value, "pending");
        s.statusMessage.value = generatedCount > 0
            ? `已生成 ${generatedCount} 条描述补充建议。`
            : "未生成可用描述建议，请补充问卷作答后重试。";
        saveDraft();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        s.convergenceSession.value = transitionConvergenceState(s.convergenceSession.value, "error", message);
        s.statusMessage.value = `描述建议生成失败: ${message}`;
    } finally {
        s.isGeneratingQuestionnaireToDescription.value = false;
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
 * 作用：创建问卷->描述建议生成处理器。
 * 意图：将 PanelState 和 saveDraft 闭包绑定。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createGenerateQuestionnaireToDescriptionHandler(
    s: PanelState,
    saveDraft: () => void,
): (targetField?: PersonaDescriptionField) => Promise<void> {
    return (targetField) => handleGenerateQuestionnaireToDescription(s, saveDraft, targetField);
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
