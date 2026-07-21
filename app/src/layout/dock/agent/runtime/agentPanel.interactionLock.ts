/** 用途：约束会话交互锁的最小控件；使用范围：流式状态切换；解耦评估：纯类型依赖，不引用具体宿主或控制器。 */
import type {AgentPanelInteractionLockControls} from "./agentPanel.interactionLock.types";

/**
 * 作用：将请求锁定状态同步到目标选择器、会话动作和已打开弹层。
 * 意图：所有宿主使用同一锁定语义，并能脱离完整 AgentChat 进行单元测试。
 * 调用时机：面板进入或退出流式请求状态时。
 */
/** @同步豁免: UI构建 */
export function applyAgentPanelInteractionLock(
    controls: AgentPanelInteractionLockControls,
    locked: boolean,
) {
    if (locked) {
        controls.closeSessionPanel?.();
    }
    if (controls.targetSelect) {
        controls.targetSelect.disabled = locked;
    }
    for (const button of controls.conversationButtons) {
        button?.setAttribute("aria-disabled", locked ? "true" : "false");
    }
}
