import type {AgentChatRuntime} from "./imports";
import {getUsableModelSignature} from "./imports";
import {getActiveMagiArmorSession} from "./imports";
import {requireSiyuanConfig} from "./imports";
import {refreshModelOptions} from "./imports";
import {resolveTargetPolicy} from "./imports";
import {showWelcome} from "./imports";
import {updateSendButtonState} from "./imports";

/** 根据宿主能力显示可用操作入口。 */
export function applyCapabilityVisibility(runtime: AgentChatRuntime) {
    runtime.guardianAuthBtn?.classList.toggle("fn__none", !runtime.capabilities.openIdentityAccess);
    runtime.tabBtn?.classList.toggle("fn__none", !runtime.capabilities.openTab);
    runtime.floatingBtn?.classList.toggle("fn__none", !runtime.capabilities.openFloat);
    runtime.sessionFilesBtn?.classList.toggle("fn__none", !runtime.capabilities.showMenu);
    const minimize = runtime.parent.panelElement.querySelector<HTMLElement>('[data-type="min"]');
    minimize?.classList.toggle("fn__none", !runtime.capabilities.minimizeDock);
    runtime.parent.panelElement.classList.toggle("agent-panel-runtime--no-menu", !runtime.capabilities.showMenu);
}

/** 根据当前会话目标刷新标题、模型与身份控件。 */
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
export function checkConfigChanged(runtime: AgentChatRuntime) {
    const signature = getUsableModelSignature(requireSiyuanConfig().ai);
    if (signature === runtime.modelOptionsSignature) {
        return;
    }
    refreshModelOptions(runtime);
    if (runtime.entries.length === 0 && runtime.messagesContainer.querySelector(".agent-welcome")) {
        showWelcome(runtime);
    }
}
