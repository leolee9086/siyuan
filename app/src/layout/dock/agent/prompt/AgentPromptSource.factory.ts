/** 用途：关闭提示词动作菜单；使用范围：控制器生命周期；解耦评估：同领域命名动作不持有控制器状态。 */
import {closePromptSourceActions} from "./AgentPromptSource.actions";
/** 用途：执行首次发送前来源检查；使用范围：控制器发送门禁；解耦评估：同领域命名动作显式接收公开上下文。 */
import {ensurePromptSourceDecisionBeforeFirstTurn} from "./AgentPromptSource.actions";
/** 用途：刷新提示词来源；使用范围：控制器会话生命周期；解耦评估：同领域命名动作显式接收公开上下文。 */
import {refreshPromptSource} from "./AgentPromptSource.actions";
/** 用途：装配提示词控件；使用范围：控制器 attach；解耦评估：DOM 事件集中在同领域装配边界。 */
import {attachPromptSourceElements} from "./AgentPromptSource.events";
/** 用途：投影提示词控件；使用范围：控制器状态变化；解耦评估：DOM 写入集中在同领域 presentation 层。 */
import {updatePromptSourcePresentation} from "./AgentPromptSource.presentation";
/** 用途：创建公开初始状态；使用范围：控制器装配；解耦评估：状态创建集中在同领域状态模块。 */
import {createPromptSourceControllerState} from "./AgentPromptSource.state";
/** 用途：重置公开状态；使用范围：控制器会话切换；解耦评估：状态变化集中在同领域状态模块。 */
import {resetPromptSourceControllerState} from "./AgentPromptSource.state";
/** 用途：约束宿主面板能力；使用范围：控制器组合边界。 */
import type {AgentPanelCapabilities} from "./imports";
/** 用途：约束公开控制器状态；使用范围：可选状态注入。 */
import type {AgentPromptSourceControllerState} from "./AgentPromptSource.types";
/** 用途：固定提示词来源抽象接口；使用范围：控制器组合结果。 */
import type {AgentPromptSourceDomain} from "./AgentPromptSource.types";
/** 用途：约束提示词控件 DOM；使用范围：控制器 attach。 */
import type {AgentPromptSourceElements} from "./AgentPromptSource.types";
/** 用途：约束会话与仓储端口；使用范围：控制器组合边界。 */
import type {AgentPromptSourceSessionRuntime} from "./AgentPromptSource.types";

/** 创建只持有公开状态和抽象端口的提示词来源控制器。 */
/** @同步豁免: 生命周期 - AgentChat 初始化必须在绑定 DOM 前立即取得完整且独立的领域控制器。 */
export function createAgentPromptSourceController(
    capabilities: AgentPanelCapabilities,
    runtime: AgentPromptSourceSessionRuntime,
    state: AgentPromptSourceControllerState = createPromptSourceControllerState(),
) {
    const controller: AgentPromptSourceDomain = {
        capabilities,
        runtime,
        state,
        /** 在控件创建后绑定 DOM，并立即投影当前公开状态。 */
        attach(elements: AgentPromptSourceElements) {
            attachPromptSourceElements(controller, elements);
        },
        /** 在切换或新建会话时使旧异步结果失效，并恢复未加载状态。 */
        reset() {
            resetPromptSourceControllerState(state);
            closePromptSourceActions(controller);
            updatePromptSourcePresentation(controller);
        },
        /** 在其它面板动作开始前关闭本控制器拥有的菜单。 */
        closeActions() {
            closePromptSourceActions(controller);
        },
        /** 在 AgentChat 销毁时阻止后续状态提交并释放 DOM 引用。 */
        destroy() {
            state.destroyed = true;
            controller.reset();
            state.elements = null;
        },
        /** 在会话装载或修订变化后从权威仓储刷新公开状态。 */
        refresh() {
            return refreshPromptSource(controller);
        },
        /** 在原生 Agent 首轮发送前确认来源快照仍可使用。 */
        ensureDecisionBeforeFirstTurn() {
            return ensurePromptSourceDecisionBeforeFirstTurn(controller);
        },
        /** 在外部流式状态变化后重新投影当前提示词视图。 */
        updatePresentation() {
            updatePromptSourcePresentation(controller);
        },
        /** 供会话操作锁同步读取当前提示词命令状态。 */
        isOperationPending() {
            return state.operationPending;
        },
    };
    return controller;
}
