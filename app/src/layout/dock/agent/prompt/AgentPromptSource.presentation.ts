/** 用途：读取提示词公开状态和目标策略；使用范围：视图推导与投影。 */
import type {AgentPromptSourceDomain} from "./AgentPromptSource.types";
/** 用途：约束提示词控件 DOM；使用范围：视图投影。 */
import type {AgentPromptSourceElements} from "./AgentPromptSource.types";
/** 用途：固定无副作用视图模型；使用范围：提示词控件渲染。 */
import type {AgentPromptSourceView} from "./AgentPromptSource.types";

/** 根据错误与来源种类推导未锁定时的标签和说明。 */
function derivePromptSourceDescription(context: AgentPromptSourceDomain) {
    const source = context.state.sourceState?.source;
    if (context.state.errorMessage) {
        return {label: "系统提示词不可用", tooltip: context.state.errorMessage};
    }
    if (source?.kind !== "document") {
        return {label: "系统提示词：默认", tooltip: "选择一篇文档作为系统提示词"};
    }
    return {
        label: `系统提示词：${source.titleSnapshot || "未命名文档"}`,
        tooltip: context.state.sourceState?.state === "source-changed"
            ? "来源文档已变化；可重新选择文档，或在下拉菜单中刷新/保持当前快照"
            : "选择或更换系统提示词文档",
    };
}

/** 从可观察领域状态推导无 DOM 副作用的完整视图模型。 */
/** @同步豁免: UI构建 - DOM 投影必须从同一状态快照立即取得完整视图，异步间隙会混合不同会话状态。 */
export function derivePromptSourceView(context: AgentPromptSourceDomain) {
    const visible = context.runtime.getTargetPolicy().promptSourceVisible;
    const source = context.state.sourceState?.source;
    const description = derivePromptSourceDescription(context);
    let label = description.label;
    let tooltip = description.tooltip;
    const locked = context.state.sourceState?.state === "locked";
    if (locked) {
        label += "（已锁定）";
        tooltip = source?.kind === "document"
            ? "首次发送后已锁定当前快照；菜单中可创建独立副本"
            : "首次发送后已锁定默认系统提示词";
    }
    const pending = context.runtime.isStreaming() || context.state.operationPending;
    return {
        visible,
        label,
        tooltip,
        selectDisabled: pending || locked || !context.capabilities.createDialog,
        actionsVisible: Boolean(context.capabilities.showMenu && source?.kind === "document"),
        actionsDisabled: pending,
        sourceChanged: context.state.sourceState?.state === "source-changed",
        locked,
    } satisfies AgentPromptSourceView;
}

/** 将显式视图模型一次性投影到已装配的 DOM。 */
/** @同步豁免: UI构建 - 一次投影中的可见性、标签和禁用状态必须同步提交，避免控件短暂不一致。 */
export function renderPromptSourceView(elements: AgentPromptSourceElements, view: AgentPromptSourceView) {
    elements.row.classList.toggle("fn__none", !view.visible);
    if (!view.visible) {
        return;
    }
    elements.label.textContent = view.label;
    elements.label.setAttribute("title", view.tooltip);
    elements.selectButton.setAttribute("title", view.locked ? view.tooltip : "选择系统提示词文档");
    elements.selectButton.setAttribute("aria-label", view.locked ? view.tooltip : "选择系统提示词文档");
    elements.selectButton.disabled = view.selectDisabled;
    elements.actionsButton.classList.toggle("fn__none", !view.actionsVisible);
    elements.actionsButton.disabled = view.actionsDisabled;
    elements.row.classList.toggle("agent-chat__prompt-source-row--changed", view.sourceChanged);
    elements.row.classList.toggle("agent-chat__prompt-source-row--locked", view.locked);
}

/** 使用当前可观察状态刷新提示词来源控件。 */
/** @同步豁免: UI构建 - 外部状态变化后需要立即从公开状态推导并提交同一帧 DOM。 */
export function updatePromptSourcePresentation(context: AgentPromptSourceDomain) {
    // 控制器尚未完成 DOM 装配或已经销毁时，只保留公开状态，不执行视图副作用。
    if (context.state.elements) {
        renderPromptSourceView(context.state.elements, derivePromptSourceView(context));
    }
}
