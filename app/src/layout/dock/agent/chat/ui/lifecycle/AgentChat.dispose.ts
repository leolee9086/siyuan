import type {AgentChatRuntime} from "./imports";
import {MAGI_IDENTITY_SESSION_CHANGED_EVENT} from "./imports";
import {closeTokenBreakdownPopup} from "./imports";
import {stopThinkingUpdates} from "./imports";

/** 释放 AgentChat 自有的监听器、观察器、请求和子控制器。 */
export function disposeAgentChatRuntime(runtime: AgentChatRuntime) {
    if (runtime.agentDestroyed) {
        return;
    }
    runtime.agentDestroyed = true;
    runtime.promptSourceController.destroy();
    runtime.sessionFileOperationSerial++;
    runtime.sessionFileOperationPending = false;
    runtime.abortController?.abort();
    runtime.abortController = null;
    runtime.magiConversationLoadController?.abort();
    runtime.magiConversationLoadController = null;
    stopThinkingUpdates(runtime);
    if (runtime.rafId) {
        cancelAnimationFrame(runtime.rafId);
        runtime.rafId = 0;
    }
    closeTokenBreakdownPopup(runtime);
    runtime.stickResizeObserver?.disconnect();
    runtime.stickResizeObserver = null;
    runtime.layoutResizeObserver?.disconnect();
    runtime.layoutResizeObserver = null;
    runtime.settingDialogObserver?.disconnect();
    runtime.settingDialogObserver = null;
    window.removeEventListener("focus", runtime.checkConfigChangedHandler);
    window.removeEventListener(MAGI_IDENTITY_SESSION_CHANGED_EVENT, runtime.handleMagiIdentitySessionChanged);
    runtime.capabilities.closeMenu?.("agent-current-session-files");
    runtime.promptSourceController.closeActions();
    runtime.sessionPanel?.destroy();
    runtime.composer?.destroy();
    runtime.composer = null;
    if (runtime.ws) {
        runtime.ws.onclose = null;
        runtime.ws.close();
    }
}
