/** 用途：约束待释放实例状态；使用范围：AgentChat 销毁入口；解耦评估：纯运行时协议经目录网关进入，不加载门面实现。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：移除全局身份监听；使用范围：实例销毁；解耦评估：事件名复用既有身份服务常量，避免字符串复制。 */
import {MAGI_IDENTITY_SESSION_CHANGED_EVENT} from "./imports";
/** 用途：释放令牌弹层；使用范围：实例销毁；解耦评估：资源创建模块提供对称清理入口。 */
import {closeTokenBreakdownPopup} from "./imports";
/** 用途：停止思考状态更新；使用范围：实例销毁；解耦评估：定时资源由反馈模块集中清理。 */
import {stopThinkingUpdates} from "./imports";

/**
 * 释放 AgentChat 自有的监听器、观察器、请求和子控制器。
 * @同步豁免: 生命周期 - 布局框架要求 destroy 返回前立即撤销监听器、请求和 DOM 资源，否则迟到回调会访问已销毁实例。
 */
export function disposeAgentChatRuntime(runtime: AgentChatRuntime) {
    if (runtime.agentDestroyed) {
        return;
    }
    runtime.agentDestroyed = true;
    runtime.conversationController?.dispose();
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
