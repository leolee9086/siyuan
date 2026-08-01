import type {AgentChatRuntime} from "./imports";
import {mountComposer} from "./imports";
import {createAgentPromptSourceController} from "./imports";
import {createAgentSessionPanelController} from "./imports";
import {updateHotkeyAfterTip} from "./imports";
import {escapeHtml} from "./imports";
import {getAgentChatLanguages} from "./imports";
import {requireElement} from "./imports";
import {requireSiyuanConfig} from "./imports";
import {deleteSession} from "./imports";
import {
    applyCapabilityVisibility,
    applyConversationCapabilityVisibility,
    updateGuardianAuthButton,
} from "./AgentChat.shell.methods";
import {resolveTargetPolicy} from "./imports";
import {initReasoningEffortSelect} from "./imports";
import {bindComposerDragDrop} from "./imports";
import {switchSession} from "./imports";
import {ensureCurrentSessionPersisted} from "./imports";
import {updateActiveMarker} from "./imports";
import {sendMessage} from "./imports";
import {updateSendButtonState} from "./imports";
import {reportSessionFileError} from "./imports";
import {restoreScrollToBottom} from "./imports";
/** 用途：创建布局尺寸观察器；使用范围：Dock 展开状态跟踪；解耦评估：实例化集中在既有观察器工厂。 */
import {createAgentChatResizeObserver} from "./imports";

/** 构建标题栏，保持会话、目标和宿主窗口动作的原有顺序。 */
const buildAgentChatHeaderHTML = () => {
    const L = getAgentChatLanguages();
    return '<div class="block__icons fn__hidescrollbar">' +
        '<div class="block__logo fn__flex-1 agent-chat__title">' + (L.agentChat || "Agent") + "</div>" +
        '<label class="agent-chat__target-wrap"><span class="fn__none">Target</span>' +
        '<select class="b3-select b3-select--noborder agent-chat__target" data-type="conversation-target" aria-label="Conversation target">' +
        '<option value="native-agent">' + escapeHtml(L.agentChat || "Agent") + '</option><option value="magi">MAGI</option>' +
        "</select></label>" +
        '<span data-type="guardian-auth" class="block__icon block__icon--show ariaLabel" data-position="north" aria-label="登录 Guardian Armor">' +
        '<svg><use xlink:href="#iconLock"></use></svg></span>' +
        '<span data-type="magi-identity-label" class="agent-chat__identity-label fn__none"></span><span class="fn__space"></span>' +
        '<span data-type="new-session" class="block__icon ariaLabel" data-position="north" aria-label="' + (L.agentNewSession || "New Session") + '">' +
        '<svg><use xlink:href="#iconAdd"></use></svg></span><span class="fn__space"></span>' +
        '<span data-type="session-menu" class="block__icon ariaLabel" data-position="north" aria-label="' + L.manageSessions + '">' +
        '<svg><use xlink:href="#iconFolderClock"></use></svg></span><span class="fn__space"></span>' +
        '<span data-type="open-as-tab" class="block__icon ariaLabel" data-position="north" aria-label="' + (L.openInNewTab || "Open in tab") + '">' +
        '<svg><use xlink:href="#iconOpen"></use></svg></span><span class="fn__space"></span>' +
        '<span data-type="open-as-dialog" class="block__icon ariaLabel" data-position="north" aria-label="' + (L.refPopover || "Open in popover") + '">' +
        '<svg><use xlink:href="#iconPictureInPicture"></use></svg></span><span class="fn__space"></span>' +
        '<span data-type="min" class="block__icon ariaLabel" data-position="north" aria-label="' +
        getAgentChatLanguages().min + updateHotkeyAfterTip(requireSiyuanConfig().keymap.general.closeTab.custom) + '">' +
        '<svg><use xlink:href="#iconMin"></use></svg></span></div>';
};

/** 构建消息区和输入区，字符串同步写入以确保后续查询能立即取得节点。 */
const buildAgentChatBodyHTML = () => {
    const L = getAgentChatLanguages();
    return '<div class="agent-chat__messages-wrap"><div class="agent-chat__messages fn__flex-1"></div>' +
        '<span class="agent-chat__scroll-bottom ariaLabel" data-position="west" aria-label="' + L.scrollToBottom + '">' +
        '<svg><use xlink:href="#iconArrowDown"></use></svg></span></div><div class="agent-chat__input-area">' +
        '<div class="agent-chat__prompt-source-row fn__none" data-type="prompt-source-row">' +
        '<div class="agent-chat__prompt-source-controls" role="group" aria-label="系统提示词来源">' +
        '<button type="button" class="agent-chat__prompt-source-btn agent-chat__prompt-source-select b3-button b3-button--cancel" ' +
        'data-type="prompt-source-select" aria-label="选择系统提示词文档" aria-haspopup="dialog">' +
        '<svg aria-hidden="true"><use xlink:href="#iconFile"></use></svg>' +
        '<span class="agent-chat__prompt-source-label" data-type="prompt-source-label"></span></button>' +
        '<button type="button" class="agent-chat__prompt-source-btn agent-chat__prompt-source-actions b3-button b3-button--cancel" ' +
        'data-type="prompt-source-actions" aria-label="系统提示词操作" aria-haspopup="menu">' +
        '<svg class="agent-chat__prompt-source-arrow" aria-hidden="true"><use xlink:href="#iconDown"></use></svg></button>' +
        '</div></div><div class="agent-chat__composer-host"></div><div class="agent-chat__buttons">' +
        '<button class="agent-chat__session-files b3-button b3-button--icon b3-button--cancel b3-tooltips b3-tooltips__n" ' +
        'data-type="session-files" aria-label="' + (L.upload || "Upload") + " " + (L.agentCatFile || "file") + '">' +
        '<svg><use xlink:href="#iconUpload"></use></svg></button>' +
        '<input class="agent-chat__session-files-input fn__none" type="file" multiple><span class="fn__flex-1"></span>' +
        '<span class="agent-chat__tokens fn__none b3-button b3-button--icon b3-button--cancel" aria-label="' +
        (L.tokenUsage || "Context Usage") + '"><svg viewBox="0 0 24 24"><circle class="agent-chat__tokens-track" cx="12" cy="12" r="9" stroke-width="3"></circle>' +
        '<circle class="agent-chat__tokens-arc" cx="12" cy="12" r="9" stroke-width="3" stroke-dasharray="0 56.55"></circle></svg></span>' +
        '<select class="b3-select b3-select--noborder agent-chat__model" data-type="model" tabindex="0"></select>' +
        '<div class="b3-form__icon ariaLabel agent-chat__reasoning-effort" aria-label="' + (L.reasoningEffortTooltip || "Reasoning effort") + '">' +
        '<svg class="b3-form__icon-icon"><use xlink:href="#iconBrain"></use></svg>' +
        '<select class="b3-select b3-select--noborder b3-form__icon-input agent-chat__reasoning-effort-select" tabindex="0"></select></div>' +
        '<button class="agent-chat__send b3-button b3-button--icon b3-button--text b3-tooltips b3-tooltips__n" aria-label="' +
        (L.agentSend || "Send") + '"><svg><use xlink:href="#iconSend"></use></svg></button>' +
        '<button class="agent-chat__stop b3-button b3-button--icon b3-button--cancel fn__none b3-tooltips b3-tooltips__n" aria-label="' +
        (L.agentStop || "Stop") + '"><svg><use xlink:href="#iconSquareStop"></use></svg></button></div></div>' +
        '<div class="agent-chat__preview-notice">' + (L.featurePreview || "") + "</div>";
};

/** 同步建立 AgentChat 根 DOM，供后续初始化步骤绑定引用。 */
export function renderAgentChatPanel(panel: HTMLElement) {
    panel.classList.add("fn__flex-column", "file-tree", "sy__agentChat", "dockPanel");
    panel.innerHTML = '<div class="agent-chat fn__flex-column fn__flex-1">' +
        buildAgentChatHeaderHTML() + buildAgentChatBodyHTML() + "</div>";
}

/** 查询并保存后续流程共享的 DOM 引用，同时初始化提示词控制器。 */
export function bindAgentChatElements(runtime: AgentChatRuntime, panel: HTMLElement) {
    runtime.messagesContainer = requireElement<HTMLElement>(panel, ".agent-chat__messages");
    runtime.composerHost = requireElement<HTMLElement>(panel, ".agent-chat__composer-host");
    runtime.sendBtn = requireElement<HTMLElement>(panel, ".agent-chat__send");
    runtime.stopBtn = requireElement<HTMLElement>(panel, ".agent-chat__stop");
    runtime.sessionFilesBtn = requireElement<HTMLButtonElement>(panel, ".agent-chat__session-files");
    runtime.sessionFilesInput = requireElement<HTMLInputElement>(panel, ".agent-chat__session-files-input");
    runtime.promptSourceController = createAgentPromptSourceController(runtime.capabilities, {
        /** `getConversation` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        getConversation: () => ({kind: runtime.conversationKind, sessionId: runtime.sessionId}),
        /** `ensurePersisted` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        ensurePersisted: (sessionID) => ensureCurrentSessionPersisted(runtime, sessionID),
        /** `refreshSessionPanel` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        refreshSessionPanel: () => runtime.sessionPanel?.refresh() ?? Promise.resolve(),
        /** `isStreaming` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        isStreaming: () => runtime.isStreaming,
        /** `isDestroyed` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        isDestroyed: () => runtime.agentDestroyed,
        /** `getTargetPolicy` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        getTargetPolicy: () => resolveTargetPolicy(runtime),
        /** 返回当前组合根已经观察到的会话修订。 */
        getSessionRevision: (sessionID) => runtime.sessionPorts.repository.getRevision(sessionID),
        /** 提示词控制器只依赖完整领域仓储。 */
        sourceRepository: runtime.sessionPorts.promptSources,
    });
    runtime.promptSourceController.attach({
        row: requireElement<HTMLElement>(panel, '[data-type="prompt-source-row"]'),
        label: requireElement<HTMLElement>(panel, '[data-type="prompt-source-label"]'),
        selectButton: requireElement<HTMLButtonElement>(
            panel, '.agent-chat__prompt-source-btn[data-type="prompt-source-select"]'),
        actionsButton: requireElement<HTMLButtonElement>(
            panel, '.agent-chat__prompt-source-btn[data-type="prompt-source-actions"]'),
    });
    bindAgentChatActionElements(runtime, panel);
}

/** 保存标题栏、模型栏和滚动按钮引用，并同步当前能力可见性。 */
function bindAgentChatActionElements(runtime: AgentChatRuntime, panel: HTMLElement) {
    runtime.guardianAuthBtn = requireElement<HTMLElement>(panel, '.block__icon[data-type="guardian-auth"]');
    runtime.identityLabelElement = requireElement<HTMLElement>(panel, '[data-type="magi-identity-label"]');
    runtime.newSessionBtn = requireElement<HTMLElement>(panel, '.block__icon[data-type="new-session"]');
    runtime.sessionMenuBtn = requireElement<HTMLElement>(panel, '.block__icon[data-type="session-menu"]');
    runtime.tabBtn = requireElement<HTMLElement>(panel, '.block__icon[data-type="open-as-tab"]');
    runtime.floatingBtn = requireElement<HTMLElement>(panel, '.block__icon[data-type="open-as-dialog"]');
    runtime.titleElement = requireElement<HTMLElement>(panel, ".agent-chat__title");
    runtime.tokenDisplayEl = requireElement<HTMLElement>(panel, ".agent-chat__tokens");
    runtime.targetSelect = requireElement<HTMLSelectElement>(
        panel, '.agent-chat__target[data-type="conversation-target"]');
    runtime.modelSelect = requireElement<HTMLSelectElement>(panel, '.agent-chat__model[data-type="model"]');
    runtime.reasoningEffortSelect = requireElement<HTMLSelectElement>(
        panel, ".agent-chat__reasoning-effort-select");
    runtime.scrollBottomBtn = requireElement<HTMLElement>(panel, ".agent-chat__scroll-bottom");
    initReasoningEffortSelect(runtime);
    runtime.targetSelect.value = runtime.conversationKind;
    applyCapabilityVisibility(runtime);
    applyConversationCapabilityVisibility(runtime);
    updateGuardianAuthButton(runtime);
}

/** 处理一次消息区滚动，将用户位置投影到公开运行时状态。 */
export function handleAgentChatScroll(runtime: AgentChatRuntime) {
    const {scrollTop, scrollHeight, clientHeight} = runtime.messagesContainer;
    // 面板可见且会话已建立时记录距底部位置，折叠期间的零尺寸不会污染状态。
    if (runtime.layoutVisible && clientHeight > 0 && runtime.sessionId) {
        runtime.scrollBottomBySession.set(runtime.sessionId, scrollHeight - scrollTop);
    }
    // 程序主动调整滚动位置时不改变用户是否脱离底部的判断。
    if (runtime.programmaticScroll) {
        return;
    }
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // 尚未标记为上滚时，只在离开底部阈值后切换状态。
    if (!runtime.userScrolledUp) {
        runtime.userScrolledUp = distanceFromBottom >= 60;
    }
    // 用户重新接近底部时恢复自动跟随。
    if (runtime.userScrolledUp && distanceFromBottom <= 10) {
        runtime.userScrolledUp = false;
    }
    runtime.scrollBottomBtn.classList.toggle("agent-chat__scroll-bottom--visible", runtime.userScrolledUp);
    updateActiveMarker(runtime);
}

/** 挂载输入编辑器，并为无完整 App 的宿主补充块引用拖放。 */
export function mountAgentChatComposer(runtime: AgentChatRuntime) {
    runtime.composer = mountComposer({
        host: runtime.composerHost,
        /** Composer 提交统一进入聊天发送命令。 */
        onSend: () => void sendMessage(runtime),
        /** 内容变化时同步刷新发送按钮可用状态。 */
        onChange: () => updateSendButtonState(runtime),
        ...(runtime.app ? {app: runtime.app} : {}),
    });
    if (!runtime.app) {
        bindComposerDragDrop(runtime);
    }
}

/** 创建会话面板控制器，保持切换、删除、重命名和错误回调集中。 */
export function createAgentChatSessionPanel(runtime: AgentChatRuntime) {
    runtime.sessionPanel = createAgentSessionPanelController({
        triggerBtn: runtime.sessionMenuBtn,
        host: runtime.parent.panelElement,
        /** `getCurrentSessionId` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        getCurrentSessionId: () => runtime.sessionId,
        /** `getDefaultTitle` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        getDefaultTitle: () => runtime.defaultTitle,
        /** `getTargetKind` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
        getTargetKind: () => runtime.conversationKind,
        sessionRepository: runtime.sessionPorts.repository,
        taskDirectoryRepository: runtime.sessionPorts.taskDirectories,
        callbacks: {
            /** `onSwitch` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
            onSwitch: (id) => switchSession(runtime, id),
            /** `onDelete` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
            onDelete: (id) => deleteSession(runtime, id),
            /** `onRename` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
            onRename: async (id, title) => {
                const currentSession = id === runtime.sessionId;
                if (currentSession) {
                    runtime.sessionTitle = title;
                    runtime.titleElement.textContent = title;
                }
                // 活跃轮次中延后持久化标题，避免覆盖本轮提交状态。
                if (currentSession && (runtime.isStreaming || runtime.currentTurnID)) {
                    runtime.pendingSessionTitle = title;
                    return;
                }
                await runtime.sessionPorts.repository.rename({id, title});
            },
            /** `onError` 负责界面生命周期中的对应步骤，由上层流程或事件回调调用并集中维护状态变化。 */
            onError: (error) => reportSessionFileError(runtime, error),
        },
    });
}

/** 处理一次布局尺寸变化，并在 Dock 恢复可见时还原会话位置。 */
function handleAgentChatLayoutResize(runtime: AgentChatRuntime) {
    const collapsed = runtime.messagesContainer.clientWidth === 0 || runtime.messagesContainer.clientHeight === 0;
    // 折叠状态不读取零尺寸滚动位置，只记录布局当前不可见。
    if (collapsed) {
        runtime.layoutVisible = false;
        return;
    }
    // 只有从折叠恢复为可见时才还原保存的位置，普通尺寸变化不干预用户滚动。
    if (!runtime.layoutVisible) {
        runtime.layoutVisible = true;
        restoreScrollToBottom(runtime, runtime.scrollBottomBySession.get(runtime.sessionId) ?? 0);
    }
}

/** 观察 Dock 展开状态，并在重新可见时恢复会话滚动位置。 */
export function observeAgentChatLayout(runtime: AgentChatRuntime) {
    runtime.layoutResizeObserver = createAgentChatResizeObserver(() => handleAgentChatLayoutResize(runtime));
    runtime.layoutResizeObserver.observe(runtime.messagesContainer);
}
