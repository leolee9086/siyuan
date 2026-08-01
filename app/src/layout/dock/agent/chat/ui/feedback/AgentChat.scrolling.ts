/** 用途：创建流式卡片尺寸观察器；使用范围：贴底目标绑定；解耦评估：观察器构造为平台细节，注入工厂保持可替换。 */
import {createAgentChatResizeObserver} from "./AgentChat.observer.factory";
/** 用途：约束滚动函数读写的公开状态；使用范围：本文件全部导出函数。 */
import type {AgentChatRuntime} from "./imports";

/** 把思考卡片底部对齐到消息视口上方。 */
function alignBelowThinkingCard(runtime: AgentChatRuntime, card: HTMLElement) {
    // 卡片已经离开文档时不再修改当前会话的滚动位置。
    if (!card.isConnected) {
        return;
    }
    const containerRect = runtime.messagesContainer.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const target = runtime.messagesContainer.scrollTop + cardRect.bottom - containerRect.top + 8;
    const maximum = runtime.messagesContainer.scrollHeight - runtime.messagesContainer.clientHeight;
    runtime.programmaticScroll = true;
    runtime.messagesContainer.scrollTop = Math.min(target, maximum);
    requestAnimationFrame(() => {
        runtime.programmaticScroll = false;
    });
}

/**
 * 在布局过渡期间持续恢复指定的距底位置。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function restoreScrollToBottom(runtime: AgentChatRuntime, scrollBottom: number, duration = 320) {
    // 无效距底值不应触发滚动状态变化。
    if (scrollBottom < 0) {
        return;
    }
    const startedAt = Date.now();
    runtime.programmaticScroll = true;
    /** 在布局仍可见且过渡尚未结束时，按实际布局帧校正滚动位置。 */
    // @柯里化
    const tick = () => {
        // 布局不可见时停止校正，防止浏览器把隐藏容器位置钳制为零。
        if (!runtime.layoutVisible) {
            runtime.programmaticScroll = false;
            return;
        }
        runtime.messagesContainer.scrollTop = Math.max(0, runtime.messagesContainer.scrollHeight - scrollBottom);
        // 过渡期间继续等待下一次真实布局帧。
        if (Date.now() - startedAt < duration) {
            requestAnimationFrame(tick);
            return;
        }
        requestAnimationFrame(() => {
            runtime.programmaticScroll = false;
        });
    };
    requestAnimationFrame(tick);
}

/**
 * 在思考卡片折叠完成后定位到卡片下方。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function scrollToThinkingCardBelow(runtime: AgentChatRuntime, card: HTMLElement) {
    // @柯里化: 定位回调需要闭包捕获当前 runtime 与卡片引用，供布局帧或过渡结束回调共用。
    const align = () => alignBelowThinkingCard(runtime, card);
    const body = card.querySelector<HTMLElement>(".agent-chat__thinking-body");
    // 无折叠主体时在下一次真实布局帧读取最终几何值。
    if (!body) {
        requestAnimationFrame(align);
        return;
    }
    const transitionDuration = getComputedStyle(body).transitionDuration;
    // 没有 CSS 过渡时在下一次布局帧定位。
    if (transitionDuration === "0s") {
        requestAnimationFrame(align);
        return;
    }
    /** 只响应折叠主体自身的过渡完成或取消事件。 */
    // @柯里化: 过渡回调需要捕获当前主体和定位动作，以便在任一结束信号到达后同时解除两个监听器。
    const settle = (event: TransitionEvent) => {
        if (event.target !== body) {
            return;
        }
        body.removeEventListener("transitionend", settle);
        body.removeEventListener("transitioncancel", settle);
        align();
    };
    body.addEventListener("transitionend", settle);
    body.addEventListener("transitioncancel", settle);
}

/**
 * 将消息视图滚动到底部，并区分程序化滚动与用户滚动。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function scrollToBottom(runtime: AgentChatRuntime, force = false, smooth = false) {
    // 用户主动离开底部时保留其阅读位置，只有显式强制才重新贴底。
    if (!force && runtime.userScrolledUp) {
        return;
    }
    runtime.programmaticScroll = true;
    // @内联回调: 滚动执行体需要捕获当前容器及完成回调，拆分后会扩散一次性滚动状态。
    requestAnimationFrame(() => {
        // 非平滑滚动在下一帧直接写入最终位置，再延后一帧释放程序化标记。
        if (!smooth) {
            runtime.messagesContainer.scrollTop = runtime.messagesContainer.scrollHeight;
            requestAnimationFrame(() => {
                runtime.programmaticScroll = false;
            });
            return;
        }
        const maximum = runtime.messagesContainer.scrollHeight - runtime.messagesContainer.clientHeight;
        // 已经位于目标位置时不会产生 scrollend，直接完成状态切换。
        if (Math.abs(runtime.messagesContainer.scrollTop - maximum) <= 1) {
            runtime.programmaticScroll = false;
            return;
        }
        /** 平滑滚动由 scrollend 或用户输入明确结束。 */
        // @柯里化
        const finish = () => {
            runtime.messagesContainer.removeEventListener("scrollend", finish);
            runtime.messagesContainer.removeEventListener("wheel", finish);
            runtime.messagesContainer.removeEventListener("touchstart", finish);
            runtime.programmaticScroll = false;
        };
        runtime.messagesContainer.addEventListener("scrollend", finish, {once: true});
        runtime.messagesContainer.addEventListener("wheel", finish, {once: true, passive: true});
        runtime.messagesContainer.addEventListener("touchstart", finish, {once: true, passive: true});
        runtime.messagesContainer.scrollTo({top: runtime.messagesContainer.scrollHeight, behavior: "smooth"});
    });
}

/**
 * 观察流式卡片的异步尺寸变化并保持贴底。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function observeStickTarget(runtime: AgentChatRuntime, element: HTMLElement | null) {
    runtime.stickResizeObserver?.disconnect();
    runtime.stickResizeObserver = null;
    // 空目标只表示解除当前观察器。
    if (!element) {
        return;
    }
    runtime.stickResizeObserver = createAgentChatResizeObserver(() => {
        // 用户仍停留在底部时跟随卡片的实际尺寸变化。
        if (!runtime.userScrolledUp) {
            scrollToBottom(runtime);
        }
    });
    runtime.stickResizeObserver.observe(element);
}
