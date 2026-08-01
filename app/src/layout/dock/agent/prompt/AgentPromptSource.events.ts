/** 用途：打开提示词生命周期菜单；使用范围：动作按钮事件；解耦评估：同领域事件层只调用命名动作。 */
import {openPromptSourceActions} from "./AgentPromptSource.actions";
/** 用途：提交提示词操作错误；使用范围：异步按钮事件；解耦评估：同领域错误出口统一更新公开状态。 */
import {reportPromptSourceError} from "./AgentPromptSource.actions";
/** 用途：分派提示词来源动作；使用范围：主按钮事件；解耦评估：同领域事件层不持有动作实现状态。 */
import {runPromptSourceAction} from "./AgentPromptSource.actions";
/** 用途：刷新提示词来源视图；使用范围：DOM 装配完成后；解耦评估：事件层只触发同领域的显式投影。 */
import {updatePromptSourcePresentation} from "./AgentPromptSource.presentation";
/** 用途：读取当前交互资格；使用范围：提示词按钮事件；解耦评估：交互条件集中在同领域状态函数。 */
import {canInteractWithPromptSource} from "./AgentPromptSource.state";
/** 用途：约束提示词领域上下文；使用范围：事件处理。 */
import type {AgentPromptSourceDomain} from "./AgentPromptSource.types";
/** 用途：约束提示词控件 DOM；使用范围：事件装配。 */
import type {AgentPromptSourceElements} from "./AgentPromptSource.types";

/** 处理主按钮点击，并只在当前会话可交互时启动文档选择。 */
function handlePromptSourceSelect(context: AgentPromptSourceDomain, event: Event) {
    event.stopPropagation();
    if (!canInteractWithPromptSource(context)) {
        return;
    }
    void runPromptSourceAction(context, "bind-document")
        .catch((error) => reportPromptSourceError(context, error));
}

/** 处理动作按钮点击，并只在宿主提供菜单端口时打开生命周期动作。 */
function handlePromptSourceActions(context: AgentPromptSourceDomain, event: Event) {
    event.stopPropagation();
    if (!canInteractWithPromptSource(context) || !context.capabilities.showMenu) {
        return;
    }
    void openPromptSourceActions(context)
        .catch((error) => reportPromptSourceError(context, error));
}

/** 装配提示词来源 DOM，并将事件明确分派给领域动作。 */
/** @同步豁免: UI构建 - 控件创建后必须立即登记事件并完成首次状态投影。 */
export function attachPromptSourceElements(
    context: AgentPromptSourceDomain,
    elements: AgentPromptSourceElements,
) {
    context.state.elements = elements;
    elements.selectButton.addEventListener("click", (event) => handlePromptSourceSelect(context, event));
    elements.actionsButton.addEventListener("click", (event) => handlePromptSourceActions(context, event));
    updatePromptSourcePresentation(context);
}
