import type {AgentChatRuntime} from "./imports";
import {addCopyButton} from "./imports";
import {postRenderAssistant} from "./AgentChat.persisted.methods";
import {renderAssistantMarkdown} from "./AgentChat.persisted.methods";
import {scrollToBottom} from "./imports";

/** 在流式结束后把正文从轻量文本渲染升级为完整富文本。 @同步豁免: UI构建 */
export function finalizeStreamingBody(runtime: AgentChatRuntime, content: string, timestamp: number) {
    if (!runtime.currentAIElement) {
        return;
    }
    const bodyElement = runtime.currentAIElement.querySelector<HTMLElement>(".agent-chat__body");
    if (!bodyElement) {
        return;
    }
    bodyElement.classList.remove("agent-chat__body--streaming");
    if (!content) {
        return;
    }
    bodyElement.innerHTML = renderAssistantMarkdown(runtime, content);
    postRenderAssistant(runtime, bodyElement);
    addCopyButton(runtime, runtime.currentAIElement, {
        timestamp,
        allowRegenerate: runtime.currentToolCalls.length === 0,
    });
    scrollToBottom(runtime, true);
}
