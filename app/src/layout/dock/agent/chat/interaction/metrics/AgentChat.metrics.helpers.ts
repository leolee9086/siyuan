/** 用途：约束令牌和思考渲染所读状态；使用范围：本文件全部辅助函数；解耦评估：运行时契约已按领域收敛，无需再注入。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：约束合并思考卡片输入；使用范围：思考详情渲染；解耦评估：类型导入编译后消失。 */
import type {ThinkingStep} from "./imports";
/** 用途：转义后端和会话文本；使用范围：所有 HTML 字符串构建；解耦评估：纯字符串转换，集中转出避免重复导入。 */
import {escapeHtml} from "./imports";
/** 用途：执行默认卡片后处理；使用范围：宿主没有提供渲染能力时；解耦评估：渲染能力经 capabilities 注入，此处为默认实现。 */
import {postRender} from "./imports";
/** 用途：定位令牌弹窗；使用范围：弹窗插入文档后；解耦评估：纯定位工具，集中转出避免重复导入。 */
import {setPosition} from "./imports";

/* @允许模块级变量: tokenBreakdownOrder 是令牌分类在明细弹窗中的固定展示顺序表
（system/skills/messages/nativeToolsDef/pluginToolsDef/mcpToolsDef/nativeTool/pluginTool/mcpTool/other），
仅作只读查找，运行期从不修改其内容或元素；
它属于渲染期稳定的展示契约而非跨调用共享状态，
改写为按调用构建会在每次渲染时复制同一顺序定义且无法保持展示顺序稳定，既不减少状态也无收益。
*/
const tokenBreakdownOrder = [
    ["system", "tokenCatSystem"],
    ["skills", "tokenCatSkills"],
    ["messages", "tokenCatMessages"],
    ["nativeToolsDef", "tokenCatNativeToolsDef"],
    ["pluginToolsDef", "tokenCatPluginToolsDef"],
    ["mcpToolsDef", "tokenCatMcpToolsDef"],
    ["nativeTool", "tokenCatNativeTool"],
    ["pluginTool", "tokenCatPluginTool"],
    ["mcpTool", "tokenCatMcpTool"],
    ["other", "tokenCatOther"],
] as const;

/* @允许模块级变量: binaryTokenMultiples 是判断上下文窗口进制缩写所需的只读查找集合，
固定包含 8/16/32/64/128/200/256/512/1024 这些 2 的幂及常用窗口倍数，
内容固定且无生命周期语义，运行期从不增删元素，也不承载任何跨调用状态；
formatTokenCount 在每次调用时都会用它判定 2^N 窗口的缩写格式，
若按调用构建 Set 会在每次格式化时重复构造同一集合，既不减少共享状态也无收益，反而降低热路径效率；
已评估把倍数判断改为纯数值位运算，但集合成员包含 200 这个非 2 幂值，位运算无法表达该例外；
未来若窗口倍数规则变化，可把集合提升为可配置的进制常量表。 */
const binaryTokenMultiples = new Set([8, 16, 32, 64, 128, 200, 256, 512, 1024]);

/**
 * `renderNewThinkingTools` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function renderNewThinkingTools(names: string[] | undefined, seenTools: Set<string>): string {
    const newTools = (names || []).filter((name) => !seenTools.has(name));
    if (newTools.length === 0) {
        return "";
    }
    for (const name of newTools) {
        seenTools.add(name);
    }
    return '<div class="agent-chat__thinking-tools-line"><span class="agent-chat__thinking-summary">Tool calls:</span>' +
        newTools.map((name) => '<span class="agent-chat__thinking-tool">' + escapeHtml(name) + "</span>").join("") +
        "</div>";
}

/** 把思考步骤按顺序渲染为正文、推理和新增工具明细。 */
export function renderThinkingStepsDetail(runtime: AgentChatRuntime, steps: ThinkingStep[]) {
    const seenTools = new Set<string>();
    let detail = "";
    for (const step of steps) {
        if (step.content) {
            const rendered = runtime.lute.ProtylePreviewStr("", step.content) || escapeHtml(step.content);
            detail += '<div class="agent-chat__thinking-chat b3-typography">' + rendered + "</div>";
        }
        if (step.reasoningContent) {
            detail += '<div class="agent-chat__thinking-reasoning-text">' +
                escapeHtml(step.reasoningContent) + "</div>";
        }
        detail += renderNewThinkingTools(step.toolNames, seenTools);
    }
    return detail;
}

/**
 * `createMergedThinkingCard` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 * @同步豁免: UI构建
 */
export function createMergedThinkingCard(headerText: string, detail: string, entryId?: string) {
    const el = document.createElement("div");
    el.className = "agent-chat__msg agent-chat__msg--thinking agent-chat__msg--thinking-done";
    if (entryId) {
        el.setAttribute("data-message-id", entryId);
    }
    el.innerHTML = '<div class="agent-chat__thinking-card"><div class="agent-chat__thinking-header">' +
        '<span class="agent-chat__thinking-arrow">' +
        '<svg class="agent-chat__thinking-arrow--expand"><use xlink:href="#iconExpand"></use></svg>' +
        '<svg class="agent-chat__thinking-arrow--contract fn__none"><use xlink:href="#iconContract"></use></svg>' +
        '</span><span class="agent-chat__thinking-text">' + escapeHtml(headerText) + "</span></div>" +
        '<div class="agent-chat__thinking-body">' + detail + "</div></div>";
    return el;
}

/** `postRenderThinkingCard` 负责宿主或默认后处理。 @同步豁免: UI构建 */
export function postRenderThinkingCard(runtime: AgentChatRuntime, el: HTMLElement) {
    // 条件 runtime.capabilities.postRender 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (runtime.capabilities.postRender) {
        runtime.capabilities.postRender(el);
    }
    // 条件 !runtime.capabilities.postRender 成立时才执行此分支，避免影响其它会话或响应阶段。
    if (!runtime.capabilities.postRender) {
        postRender(el);
    }
}

/**
 * `renderTokenUsageHeader` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function renderTokenUsageHeader(runtime: AgentChatRuntime): string {
    const L = window.siyuan.languages;
    const limitLine = runtime.contextLimit > 0
        ? formatTokenCount(runtime.contextTokens) + " / " + formatTokenCount(runtime.contextLimit) +
        " · " + Math.round(runtime.contextTokens / runtime.contextLimit * 100) + "%"
        : formatTokenCount(runtime.contextTokens);
    const divider = runtime.contextLimit > 0
        ? '<div class="agent-token-popup__bar"><span style="width:' +
        (Math.min(runtime.contextTokens / runtime.contextLimit, 1) * 100).toFixed(1) + '%"></span></div>'
        : '<div class="agent-token-popup__divider"></div>';
    return '<div class="agent-token-popup__total"><span class="agent-token-popup__label">' +
        (L.tokenUsage || "Context Usage") + '</span><span class="agent-token-popup__value">' + limitLine +
        "</span></div>" + divider;
}

/**
 * `renderTokenBreakdownRows` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function renderTokenBreakdownRows(runtime: AgentChatRuntime): string {
    return formatTokenBreakdown(runtime).map((row) =>
        '<div class="agent-token-popup__row"><span class="agent-token-popup__label">' + escapeHtml(row.label) +
        '</span><span class="agent-token-popup__value">' + row.percent + "</span></div>"
    ).join("");
}

/**
 * `renderCachedTokenRow` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 */
function renderCachedTokenRow(runtime: AgentChatRuntime): string {
    if (runtime.contextCachedTokens <= 0 || runtime.contextTokens <= 0) {
        return "";
    }
    const cachedPercent = Math.round(runtime.contextCachedTokens / runtime.contextTokens * 1000) / 10;
    return '<div class="agent-token-popup__divider"></div><div class="agent-token-popup__row">' +
        '<span class="agent-token-popup__label">' + (window.siyuan.languages.tokenCatCached || "Cache Hits") +
        '</span><span class="agent-token-popup__value">' + cachedPercent + "%</span></div>";
}

/**
 * `renderTokenPopupHTML` 负责交互反馈流程中的对应步骤，由上层流程或事件回调调用。
 * @显式返回类型原因 该签名跨职责模块或运行时契约使用，需固定返回边界，避免推导随实现细节漂移。
 * @同步豁免: UI构建
 */
export function renderTokenPopupHTML(runtime: AgentChatRuntime): string {
    return '<div class="b3-menu__items">' + renderTokenUsageHeader(runtime) +
        renderTokenBreakdownRows(runtime) + renderCachedTokenRow(runtime) + "</div>";
}

/** `positionTokenPopup` 根据入口的即时布局定位明细。 @同步豁免: 需要绝对同步的DOM访问 */
export function positionTokenPopup(runtime: AgentChatRuntime, popup: HTMLElement) {
    const rect = runtime.tokenDisplayEl.getBoundingClientRect();
    setPosition(popup, rect.right - 280, rect.bottom, rect.height, rect.width);
}

/** 根据指针离开后的目标决定是否结束令牌弹窗状态。 */
function closeTokenPopupAfterPointerLeave(runtime: AgentChatRuntime, event: MouseEvent, close: () => void) {
    const relatedTarget = event.relatedTarget;
    // 指针回到令牌入口时，入口和弹窗仍属于同一悬浮交互区域。
    if (relatedTarget instanceof Node && runtime.tokenDisplayEl.contains(relatedTarget)) {
        return;
    }
    close();
}

/** `bindTokenPopupLifecycle` 注册与弹窗一致寿命的事件。 @同步豁免: 生命周期 */
export function bindTokenPopupLifecycle(runtime: AgentChatRuntime, popup: HTMLElement, close: () => void) {
    popup.addEventListener("mouseleave", (event: MouseEvent) => closeTokenPopupAfterPointerLeave(runtime, event, close));
    popup.addEventListener("click", (event: MouseEvent) => event.stopPropagation());
    runtime.tokenPopupOutsideClickHandler = close;
    runtime.tokenPopupResizeHandler = close;
    document.addEventListener("click", runtime.tokenPopupOutsideClickHandler);
    window.addEventListener("resize", runtime.tokenPopupResizeHandler);
}

/** 将后端令牌分类转换为按固定顺序展示的本地化百分比。 @同步豁免: 性能考虑 */
export function formatTokenBreakdown(runtime: AgentChatRuntime) {
    const languages = window.siyuan.languages;
    const result: Array<{ label: string; percent: string }> = [];
    for (const [key, labelKey] of tokenBreakdownOrder) {
        const tokens = runtime.contextTokenBreakdown[key] || 0;
        const rounded = runtime.contextTokens > 0 ? Math.round(tokens / runtime.contextTokens * 1000) / 10 : 0;
        if (tokens <= 0 || rounded <= 0) {
            continue;
        }
        const localizedLabel = Reflect.get(languages, labelKey);
        result.push({label: typeof localizedLabel === "string" ? localizedLabel : key, percent: rounded + "%"});
    }
    return result;
}

/** 用产品约定的十进制或常见二进制边界格式化令牌数。 @同步豁免: 性能考虑 */
export function formatTokenCount(count: number) {
    if (count <= 0) {
        return String(count);
    }
    // 常见 2^N 窗口保持业界惯用缩写，其余数值使用十进制缩写。
    if (count >= 1024 && count % 1024 === 0 && binaryTokenMultiples.has(count / 1024)) {
        const quotient = count / 1024;
        return quotient >= 1024 ? (quotient / 1024) + "M" : quotient + "k";
    }
    // 百万以上使用 M，只有非整百万数保留一位小数。
    if (count >= 1000000) {
        return (count / 1000000).toFixed(count % 1000000 === 0 ? 0 : 1) + "M";
    }
    // 其余千位数使用十进制 k，保持服务端常见上下文值的原始含义。
    if (count >= 1000) {
        return (count / 1000).toFixed(count % 1000 === 0 ? 0 : 1) + "k";
    }
    return String(count);
}
