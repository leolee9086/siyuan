import {
    createEmptyConvergenceSession,
    restoreConvergenceSession,
} from "../../data/convergence/persona-seed-convergence";
import type { IpipPersonaSeedDescriptions } from "../../data/questionnaire.types";
import type { QuestionnaireDraft } from "../../data/convergence/persona-seed-panel.types";
import type { PanelState } from "./PersonaSeedPanel.types";
import { parseQuestionnaireDraft } from "./PersonaSeedPanel.guard";
import { getDraftKey } from "./PersonaSeedPanel.utils";

const EMPTY_DESCRIPTIONS: IpipPersonaSeedDescriptions = {
    professionalDescription: "",
    lifeDescription: "",
    instinctNeedsDescription: "",
    integratedDescription: "",
};

/**
 * 作用：批量赋值四轨描述到响应式 ref。
 * 意图：统一描述写回入口，避免四个 ref 分散赋值。
 * 调用时机：loadDraft 恢复草稿、acceptSuggestion 应用描述建议时调用。
 */
function assignDescriptions(s: PanelState, d: IpipPersonaSeedDescriptions): void {
    s.professionalDescription.value = d.professionalDescription;
    s.lifeDescription.value = d.lifeDescription;
    s.instinctNeedsDescription.value = d.instinctNeedsDescription;
    s.integratedDescription.value = d.integratedDescription;
}

/**
 * 作用：重置面板状态到初始空白值。
 * 意图：loadDraft 无草稿或解析失败时的统一重置路径。
 * 调用时机：loadDraft 内部调用。
 */
function resetPanelState(s: PanelState): void {
    s.answers.value = [];
    s.organization.value = "";
    s.role.value = "";
    s.careerGoal.value = "";
    assignDescriptions(s, EMPTY_DESCRIPTIONS);
    s.convergenceSession.value = createEmptyConvergenceSession();
    s.ratingVersion.value += 1;
}

/**
 * 作用：将当前面板状态序列化为草稿并写入 localStorage。
 * 意图：支持刷新恢复和多次编辑续写。
 * 调用时机：答案变更、描述变更、建议状态变更时调用。
 */
function saveDraft(s: PanelState): void {
    const payload: QuestionnaireDraft = {
        subject: {
            id: s.subjectId.value || "zhi",
            name: s.subjectName.value || "zhi",
            type: s.subjectType.value,
            organization: s.organization.value,
            role: s.role.value,
            careerGoal: s.careerGoal.value,
        },
        descriptions: s.seedDescriptions.value,
        answers: s.answers.value,
        convergence: s.convergenceSession.value,
    };
    localStorage.setItem(getDraftKey(payload.subject.id), JSON.stringify(payload));
}

/**
 * 作用：从 localStorage 恢复指定 subject 的草稿到响应式状态。
 * 意图：支持切换 subject 时自动恢复上次编辑进度。
 * 调用时机：初始化和 subjectId 变更时调用。
 */
function loadDraft(s: PanelState, id: string): void {
    const raw = localStorage.getItem(getDraftKey(id));
    // 无草稿时重置所有状态
    if (!raw) {
        resetPanelState(s);
        return;
    }
    const draft = parseQuestionnaireDraft(JSON.parse(raw));
    // 解析失败时同样重置
    if (!draft) {
        resetPanelState(s);
        return;
    }
    s.subjectName.value = draft.subject.name || s.subjectName.value;
    s.subjectType.value = draft.subject.type || s.subjectType.value;
    s.organization.value = draft.subject.organization;
    s.role.value = draft.subject.role;
    s.careerGoal.value = draft.subject.careerGoal;
    assignDescriptions(s, draft.descriptions);
    s.answers.value = draft.answers;
    s.convergenceSession.value = restoreConvergenceSession(draft.rawConvergence);
    s.ratingVersion.value += 1;
}

/** @同步豁免: UI构建 — Vue watch 回调必须同步触发草稿保存 */
/**
 * 作用：创建草稿保存处理器。
 * 意图：将 PanelState 闭包绑定，供 watch 回调和事件处理器使用。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createSaveDraftHandler(s: PanelState): () => void {
    return () => saveDraft(s);
}

/** @同步豁免: UI构建 — Vue watch 回调和 setup 初始化必须同步加载草稿 */
/**
 * 作用：创建草稿加载处理器。
 * 意图：将 PanelState 闭包绑定，供初始化和 subjectId watch 使用。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createLoadDraftHandler(s: PanelState): (id: string) => void {
    return (id: string) => loadDraft(s, id);
}

/** @同步豁免: UI构建 — 建议应用时同步写回描述到响应式 ref */
/**
 * 作用：创建描述赋值处理器。
 * 意图：将 PanelState 闭包绑定，供建议应用时写回描述。
 * 调用时机：usePersonaSeedPanelContext 构造时调用一次。
 */
export function createAssignDescriptionsHandler(s: PanelState): (d: IpipPersonaSeedDescriptions) => void {
    return (d: IpipPersonaSeedDescriptions) => assignDescriptions(s, d);
}
