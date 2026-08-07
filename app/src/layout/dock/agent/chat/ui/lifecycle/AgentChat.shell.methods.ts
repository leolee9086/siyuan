/** 用途：约束面板运行时契约；使用范围：本文件全部可见性职责；解耦评估：纯类型依赖，编译后消失。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：计算可用模型签名；使用范围：配置变化检测；解耦评估：经本目录网关转发，不加载模型领域实现。 */
import {getUsableModelSignature} from "./imports";
/** 用途：读取当前激活的 MAGI 身份会话；使用范围：Guardian 授权按钮刷新；解耦评估：经本目录网关转发身份查询。 */
import {getActiveMagiArmorSession} from "./imports";
/** 用途：读取全局配置；使用范围：模型签名计算；解耦评估：经本目录网关转发环境读取。 */
import {requireSiyuanConfig} from "./imports";
/** 用途：从最新配置重建可选模型列表；使用范围：配置变化刷新；解耦评估：模型职责经网关复用。 */
import {refreshModelOptions} from "./imports";
/** 用途：解析目标策略；使用范围：标题与控件可见性；解耦评估：纯策略计算经网关转发。 */
import {resolveTargetPolicy} from "./imports";
/** 用途：重绘欢迎示例；使用范围：配置变化后欢迎页刷新；解耦评估：展示职责经网关转发。 */
import {showWelcome} from "./imports";
/** 用途：刷新发送按钮状态；使用范围：目标切换后；解耦评估：控件状态集中经网关转发。 */
import {updateSendButtonState} from "./imports";

/** 根据宿主能力显示可用操作入口。 */
/** @同步豁免: UI构建 - 可见性切换必须在同步渲染周期内完成 DOM 类名更新。 */
export function applyCapabilityVisibility(runtime: AgentChatRuntime) {
    runtime.guardianAuthBtn?.classList.toggle("fn__none", !runtime.capabilities.openIdentityAccess);
    runtime.tabBtn?.classList.toggle("fn__none", !runtime.capabilities.openTab);
    runtime.tabNewBtn?.classList.toggle("fn__none", !runtime.capabilities.openTabNew);
    runtime.floatingBtn?.classList.toggle("fn__none", !runtime.capabilities.openFloat);
    runtime.sessionFilesBtn?.classList.toggle("fn__none", !runtime.capabilities.showMenu);
    const minimize = runtime.parent.panelElement.querySelector<HTMLElement>('[data-type="min"]');
    minimize?.classList.toggle("fn__none", !runtime.capabilities.minimizeDock);
    runtime.parent.panelElement.classList.toggle("agent-panel-runtime--no-menu", !runtime.capabilities.showMenu);
}

/** 根据当前会话目标刷新标题、模型与身份控件。 */
/** @同步豁免: UI构建 - 目标切换后必须同步刷新控件可见性和标题。 */
export function applyConversationCapabilityVisibility(runtime: AgentChatRuntime) {
    const policy = resolveTargetPolicy(runtime);
    const nativeAgent = runtime.conversationKind === "native-agent";
    runtime.defaultTitle = policy.title;
    runtime.modelSelect?.classList.toggle("fn__none", !nativeAgent);
    runtime.reasoningEffortSelect?.closest<HTMLElement>(".agent-chat__reasoning-effort")
        ?.classList.toggle("fn__none", !nativeAgent);
    runtime.tokenDisplayEl?.classList.toggle("agent-chat__tokens--target-hidden", !nativeAgent);
    runtime.parent.panelElement.classList.toggle("agent-chat-host--magi", !nativeAgent);
    runtime.newSessionBtn?.classList.toggle("fn__none", !policy.sessionActionsVisible);
    runtime.sessionMenuBtn?.classList.toggle("fn__none", !policy.sessionActionsVisible);
    runtime.identityLabelElement?.classList.toggle("fn__none", !policy.identityVisible);
    if (runtime.identityLabelElement) {
        runtime.identityLabelElement.textContent = policy.identityLabel;
        runtime.identityLabelElement.setAttribute("title", policy.identityLabel);
    }
    runtime.guardianAuthBtn?.classList.toggle("fn__none", !policy.identityVisible || !runtime.capabilities.openIdentityAccess);
    if (runtime.targetSelect) {
        runtime.targetSelect.value = runtime.conversationKind;
        runtime.targetSelect.disabled = runtime.isStreaming;
    }
    runtime.promptSourceController.updatePresentation();
    updateSendButtonState(runtime);
}

/** 刷新 Guardian 授权按钮并同步目标能力。 */
/** @同步豁免: UI构建 - 授权状态变化必须同步刷新图标与标签。 */
export function updateGuardianAuthButton(runtime: AgentChatRuntime) {
    if (!runtime.guardianAuthBtn) {
        return;
    }
    const session = getActiveMagiArmorSession();
    const authorized = session?.routeClass === "guardian" && session.channel === "magi-main-ui";
    const icon = runtime.guardianAuthBtn.querySelector("use");
    icon?.setAttribute("xlink:href", authorized ? "#iconKey" : "#iconLock");
    runtime.guardianAuthBtn.setAttribute(
        "aria-label",
        authorized ? `Guardian: ${session.displayName}` : "登录 Guardian Armor",
    );
    runtime.guardianAuthBtn.classList.toggle("ft__primary", authorized);
    applyConversationCapabilityVisibility(runtime);
}

/** 在 AI 配置变化后刷新模型，并仅在欢迎页重绘示例。 */
/** @同步豁免: UI构建 - 配置变化回调在事件派发周期内同步刷新模型列表。 */
export function checkConfigChanged(runtime: AgentChatRuntime) {
    const signature = getUsableModelSignature(requireSiyuanConfig().ai);
    if (signature === runtime.modelOptionsSignature) {
        return;
    }
    refreshModelOptions(runtime);
    // 仅当面板仍处于欢迎页（无消息且存在欢迎节点）时重绘示例，避免覆盖已开始的会话内容。
    if (runtime.entries.length === 0 && runtime.messagesContainer.querySelector(".agent-welcome")) {
        showWelcome(runtime);
    }
}
