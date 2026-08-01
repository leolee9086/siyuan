/** 用途：约束导航轨道状态；使用范围：本文件全部函数；解耦评估：运行时契约已按领域收敛，无需再注入。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：转义标记无障碍文案；使用范围：导航重建；解耦评估：纯字符串转换，集中转出避免重复导入。 */
import {escapeAriaLabel} from "./imports";
/** 用途：转义用户消息；使用范围：导航重建；解耦评估：纯字符串转换，集中转出避免重复导入。 */
import {escapeHtml} from "./imports";
/** 用途：收窄点击目标；使用范围：轨道事件代理；解耦评估：DOM 类型守卫，集中转出避免重复导入。 */
import {isHTMLElement} from "./imports";

/** 动画完成或取消时清除一次跳转高亮。 */
function clearJumpHighlight(element: HTMLElement, event: AnimationEvent) {
    if (event.target !== element || event.animationName !== "agent-msg-jump") {
        return;
    }
    element.classList.remove("agent-chat__msg--jumped");
}

/** 跳转到被点击标记对应的消息。 */
function handleNavRailClick(runtime: AgentChatRuntime, event: MouseEvent) {
    const marker = isHTMLElement(event.target)
        ? event.target.closest<HTMLElement>(".agent-chat__nav-rail-marker")
        : null;
    if (marker) {
        jumpToMessage(runtime, marker.dataset.messageId || "");
    }
}

/** 创建消息导航轨道并绑定确定的悬浮和跳转状态。 @同步豁免: UI构建 */
export function initNavRail(runtime: AgentChatRuntime, wrap: HTMLElement) {
    runtime.navRail = document.createElement("div");
    runtime.navRail.className = "agent-chat__nav-rail";
    runtime.navRail.addEventListener("mouseenter", () =>
        runtime.navRail.classList.add("agent-chat__nav-rail--expanded"));
    runtime.navRail.addEventListener("mouseleave", () =>
        runtime.navRail.classList.remove("agent-chat__nav-rail--expanded"));
    runtime.navRail.addEventListener("click", (event: MouseEvent) => {
        handleNavRailClick(runtime, event);
    });
    wrap.appendChild(runtime.navRail);
}

/** 根据用户消息重建导航标记。 @同步豁免: UI构建 */
export function rebuildNavMarkers(runtime: AgentChatRuntime) {
    runtime.navRail.innerHTML = "";
    const userEntries = runtime.entries.filter((entry) => entry.type === "user");
    if (userEntries.length === 0) {
        return;
    }
    const gap = Math.max(0.5, Math.min(3, 40 / userEntries.length));
    runtime.navRail.style.setProperty("--nav-gap", gap + "px");
    for (const entry of userEntries) {
        const marker = document.createElement("div");
        marker.className = "agent-chat__nav-rail-marker ariaLabel";
        marker.dataset.messageId = entry.id || "";
        marker.setAttribute("data-position", "west");
        marker.setAttribute("aria-label", escapeAriaLabel(escapeHtml(entry.content)));
        marker.textContent = entry.content.slice(0, 120);
        runtime.navRail.appendChild(marker);
    }
    updateActiveMarker(runtime);
}

/** 根据滚动位置更新当前导航标记。 @同步豁免: 需要绝对同步的DOM访问 */
export function updateActiveMarker(runtime: AgentChatRuntime) {
    const userMessages = runtime.messagesContainer.querySelectorAll<HTMLElement>(
        ".agent-chat__msg--user[data-message-id]",
    );
    if (userMessages.length === 0) {
        return;
    }
    const threshold = runtime.messagesContainer.scrollTop + 50;
    let activeID = "";
    for (const userMessage of userMessages) {
        if (userMessage.offsetTop > threshold) {
            break;
        }
        activeID = userMessage.getAttribute("data-message-id") || "";
    }
    if (!activeID) {
        activeID = userMessages.item(0).getAttribute("data-message-id") || "";
    }
    for (const marker of runtime.navRail.children) {
        marker.classList.toggle(
            "agent-chat__nav-rail-marker--active",
            marker.getAttribute("data-message-id") === activeID,
        );
    }
}

/** 滚动到指定消息，并在高亮动画完成时清理状态。 @同步豁免: 需要绝对同步的DOM访问 */
export function jumpToMessage(runtime: AgentChatRuntime, messageID: string) {
    if (!messageID) {
        return;
    }
    const element = runtime.messagesContainer.querySelector<HTMLElement>('[data-message-id="' + messageID + '"]');
    if (!element) {
        return;
    }
    element.scrollIntoView({behavior: "smooth", block: "center"});
    element.addEventListener("animationend", clearJumpHighlight.bind(null, element), {once: true});
    element.addEventListener("animationcancel", clearJumpHighlight.bind(null, element), {once: true});
    element.classList.add("agent-chat__msg--jumped");
}
