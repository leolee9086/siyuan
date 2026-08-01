import type {AgentChatRuntime} from "./imports";
import {initNavRail} from "./imports";
import {
    bindAgentChatElements,
    handleAgentChatScroll,
    createAgentChatSessionPanel,
    mountAgentChatComposer,
    observeAgentChatLayout,
    renderAgentChatPanel,
} from "./AgentChat.init.helpers";
import {requireElement} from "./imports";
import {initModelSelect} from "./imports";
import {initSessions} from "./imports";

/** 依次完成面板 DOM、编辑器、会话和布局观察器初始化。 */
export function initUI(runtime: AgentChatRuntime) {
    const panel = runtime.parent.panelElement;
    renderAgentChatPanel(panel);
    bindAgentChatElements(runtime, panel);
    runtime.messagesContainer.addEventListener("scroll", () => handleAgentChatScroll(runtime), {passive: true});
    initNavRail(runtime, requireElement<HTMLElement>(panel, ".agent-chat__messages-wrap"));
    initModelSelect(runtime);
    mountAgentChatComposer(runtime);
    createAgentChatSessionPanel(runtime);
    runtime.initialization = initSessions(runtime);
    observeAgentChatLayout(runtime);
}
