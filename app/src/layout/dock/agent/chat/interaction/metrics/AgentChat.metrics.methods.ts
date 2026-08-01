/** 用途：约束函数可读写的聊天状态；使用范围：令牌和思考卡片流程。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束思考步骤数据；使用范围：单张及合并思考卡片。 */
import type {ThinkingStep} from "./imports";
/** 用途：创建可展开的单步思考卡片；使用范围：思考步骤渲染。 */
import {createThinkingCardElement} from "./imports";
/** 用途：绑定思考卡片展开动作；使用范围：思考步骤渲染。 */
import {bindThinkingCardToggle} from "./imports";
/** 用途：绑定令牌弹窗生命周期；使用范围：弹窗打开后。 */
import {bindTokenPopupLifecycle} from "./AgentChat.metrics.helpers";
/** 用途：创建合并思考卡片 DOM；使用范围：历史会话渲染。 */
import {createMergedThinkingCard} from "./AgentChat.metrics.helpers";
/** 用途：计算可展示令牌分类；使用范围：打开令牌弹窗前。 */
import {formatTokenBreakdown} from "./AgentChat.metrics.helpers";
/** 用途：执行思考卡片后处理；使用范围：合并卡片插入 DOM 后。 */
import {postRenderThinkingCard} from "./AgentChat.metrics.helpers";
/** 用途：定位令牌弹窗；使用范围：弹窗插入 DOM 后。 */
import {positionTokenPopup} from "./AgentChat.metrics.helpers";
/** 用途：渲染思考步骤详情；使用范围：合并思考卡片。 */
import {renderThinkingStepsDetail} from "./AgentChat.metrics.helpers";
/** 用途：渲染令牌弹窗正文；使用范围：弹窗创建。 */
import {renderTokenPopupHTML} from "./AgentChat.metrics.helpers";
/** 用途：约束服务端令牌统计；使用范围：usage 事件处理。 */
import type {AgentChatTokenUsage} from "./AgentChat.metrics.types";

/** 渲染单个已完成的思考步骤。 @同步豁免: UI构建 */
export function renderSingleThinkingCard(runtime: AgentChatRuntime, step: ThinkingStep) {
    const element = createThinkingCardElement({
        reasoning: step.reasoning,
        text: "",
        reasoningContent: step.reasoningContent,
        ...(step.toolNames ? {toolNames: step.toolNames} : {}),
    });
    bindThinkingCardToggle(element);
    runtime.messagesContainer.appendChild(element);
}

/** 将历史思考步骤合并为一张可展开卡片。 @同步豁免: UI构建 */
export function renderMergedThinkingCard(
    runtime: AgentChatRuntime,
    input: {steps: ThinkingStep[]; entryID?: string; duration?: number},
) {
    if (input.steps.length === 0) {
        return;
    }
    const detail = renderThinkingStepsDetail(runtime, input.steps);
    const element = createMergedThinkingCard(formatThinkingHeader(input.duration), detail, input.entryID);
    bindThinkingCardToggle(element);
    runtime.messagesContainer.appendChild(element);
    postRenderThinkingCard(runtime, element);
}

/** 根据思考耗时生成卡片标题。 @同步豁免: UI构建 */
export function formatThinkingHeader(duration?: number) {
    const languages = window.siyuan.languages;
    if (duration && duration > 0) {
        return languages.agentThinkingDoneTime
            ? languages.agentThinkingDoneTime.replace("%s", Math.round(duration) + "s")
            : (languages.agentThinking || "Thinking");
    }
    return languages.agentThinking || "Thinking";
}

/** 让令牌圆环严格反映当前上下文统计。 @同步豁免: UI构建 */
export function updateTokenDisplay(runtime: AgentChatRuntime) {
    if (!runtime.tokenDisplayEl) {
        return;
    }
    runtime.tokenDisplayEl.classList.toggle("fn__none", runtime.contextTokens === 0);
    if (runtime.contextTokens === 0) {
        return;
    }
    const arc = runtime.tokenDisplayEl.querySelector<SVGCircleElement>(".agent-chat__tokens-arc");
    if (!arc) {
        return;
    }
    const circumference = 2 * Math.PI * 9;
    const ratio = runtime.contextLimit > 0
        ? Math.min(runtime.contextTokens / runtime.contextLimit, 1)
        : 0;
    arc.setAttribute(
        "stroke-dasharray",
        (circumference * ratio).toFixed(2) + " " + circumference.toFixed(2),
    );
}

/** 用服务端给出的最后一轮统计覆盖当前令牌状态。 @同步豁免: 生命周期 */
export function appendUsage(runtime: AgentChatRuntime, usage: AgentChatTokenUsage) {
    runtime.contextTokens = usage.lastPromptTokens;
    runtime.contextTokenBreakdown = usage.tokenBreakdown;
    runtime.contextCachedTokens = usage.cachedTokens;
    runtime.contextLimit = usage.contextLimit;
    updateTokenDisplay(runtime);
}

/** 打开令牌明细，并把关闭行为绑定到明确的 DOM 状态变化。 @同步豁免: UI构建 */
export function showTokenBreakdownPopup(runtime: AgentChatRuntime) {
    if (formatTokenBreakdown(runtime).length === 0 && runtime.contextCachedTokens === 0) {
        return;
    }
    closeTokenBreakdownPopup(runtime);
    const popup = document.createElement("div");
    popup.className = "agent-token-popup b3-menu";
    popup.innerHTML = renderTokenPopupHTML(runtime);
    document.body.appendChild(popup);
    popup.style.zIndex = (++window.siyuan.zIndex).toString();
    positionTokenPopup(runtime, popup);
    runtime.tokenPopup = popup;
    bindTokenPopupLifecycle(runtime, popup, () => closeTokenBreakdownPopup(runtime));
}

/** 关闭令牌明细并同步释放其全局监听器。 @同步豁免: 生命周期 */
export function closeTokenBreakdownPopup(runtime: AgentChatRuntime) {
    if (runtime.tokenPopupOutsideClickHandler) {
        document.removeEventListener("click", runtime.tokenPopupOutsideClickHandler);
        runtime.tokenPopupOutsideClickHandler = null;
    }
    if (runtime.tokenPopupResizeHandler) {
        window.removeEventListener("resize", runtime.tokenPopupResizeHandler);
        runtime.tokenPopupResizeHandler = null;
    }
    runtime.tokenPopup?.remove();
    runtime.tokenPopup = null;
}
