import type {AgentChatRuntime} from "./imports";
import {bindAgentChatComposerEvents} from "./AgentChat.events.helpers";
import {bindAgentChatHostEvents} from "./AgentChat.events.helpers";
import {bindAgentChatSessionEvents} from "./AgentChat.events.helpers";
import {bindAgentChatTokenEvents} from "./AgentChat.events.helpers";

/** 按控件职责绑定聊天面板事件。 */
export function bindEvents(runtime: AgentChatRuntime) {
    bindAgentChatTokenEvents(runtime);
    bindAgentChatComposerEvents(runtime);
    bindAgentChatSessionEvents(runtime);
    bindAgentChatHostEvents(runtime);
}
