/** 用途：复用重试资格策略计算；使用范围：重试入口可见性判定；解耦评估：策略与视图分离，本文件只消费计算结果。 */
import {canRetryLastUserTurn} from "./imports";
/** 用途：转义错误消息文本；使用范围：错误卡片正文构建；解耦评估：纯字符串转义函数是最小安全边界，无需再注入。 */
import {escapeHtml} from "./imports";
/** 用途：约束错误卡片读写的聊天状态；使用范围：本文件全部函数；解耦评估：类型导入编译后消失，无运行时耦合。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：分派重新生成请求；使用范围：重试按钮点击；解耦评估：结构化事件隔离视图与流式重新生成实现。 */
import {dispatchAgentChatRegenerateRequest} from "./imports";
/** 用途：提交当前思考步骤；使用范围：错误卡片插入后的收尾；解耦评估：思考步骤提交集中在思考领域，经公开入口调用。 */
import {flushThinkingStep} from "./imports";
/** 用途：读取目标能力策略；使用范围：重试入口可见性判定；解耦评估：纯策略函数经网关进入，视图不复制目标判断。 */
import {resolveTargetPolicy} from "./imports";
/** 用途：维持消息视图贴底；使用范围：错误卡片插入后；解耦评估：滚动意图由反馈领域统一维护。 */
import {scrollToBottom} from "./imports";
/** 用途：移除流式思考卡片；使用范围：错误卡片插入前清理；解耦评估：思考卡片状态集中在思考领域，经公开入口调用。 */
import {clearThinking} from "./imports";
/** 用途：结束活动思考；使用范围：错误卡片插入前清理；解耦评估：思考生命周期集中在思考领域，经公开入口调用。 */
import {finishActiveThinking} from "./imports";

/** 判断当前错误卡片是否展示重新生成入口。 @同步豁免: 生命周期 */
function isRegenerationVisible(runtime: AgentChatRuntime) {
    return resolveTargetPolicy(runtime).regenerationVisible && canRetryLastUserTurn({
        entries: runtime.entries,
        activeToolCallCount: runtime.currentToolCalls.length,
        pendingConfirmationCount: runtime.pendingConfirms.length,
    });
}

/** 为错误正文追加重新生成入口。 @同步豁免: UI构建 */
export function appendErrorActions(runtime: AgentChatRuntime, element: HTMLElement) {
    if (!isRegenerationVisible(runtime)) {
        return;
    }
    const button = document.createElement("span");
    button.className = "block__icon block__icon--show ariaLabel agent-chat__error-retry";
    button.setAttribute("data-position", "north");
    button.setAttribute("aria-label", window.siyuan.languages.agentRegenerate || "Retry");
    button.innerHTML = '<svg><use xlink:href="#iconRefresh"></use></svg>';
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        dispatchAgentChatRegenerateRequest(runtime);
    });
    element.appendChild(button);
}

/** 追加普通流式错误卡片。 @同步豁免: UI构建 */
export function appendError(runtime: AgentChatRuntime, message: string) {
    finishActiveThinking(runtime);
    clearThinking(runtime);
    // 空助手占位没有可保留正文，错误卡片插入前先移除。
    if (runtime.currentAIElement && !runtime.currentContent) {
        runtime.currentAIElement.remove();
    }
    runtime.currentAIElement = null;
    const element = document.createElement("div");
    element.className = "agent-chat__msg agent-chat__msg--error";
    const body = document.createElement("div");
    body.className = "agent-chat__body agent-chat__body--error";
    body.innerHTML = '<svg class="agent-chat__error-icon"><use xlink:href="#iconTriangleAlert"></use></svg><span>' +
        escapeHtml(message) + "</span>";
    appendErrorActions(runtime, body);
    element.appendChild(body);
    runtime.messagesContainer.appendChild(element);
    scrollToBottom(runtime, true);
    flushThinkingStep(runtime);
}
