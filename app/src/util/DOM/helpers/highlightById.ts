/** 用途：恢复编辑器 Range 焦点；使用范围：选区滚动辅助函数在插入临时节点后恢复选区；解耦评估：选区恢复依赖既有编辑器工具，通过 helpers 网关复用最稳。 */
import { focusByRange } from "./imports";
/** 用途：读取编辑器当前 Range；使用范围：未显式传入节点时回退到当前光标块；解耦评估：选区读取与 Protyle 结构强相关，不适合在 helper 中重写。 */
import { getEditorRange } from "./imports";
/** 用途：读取浏览器 Selection；使用范围：当前选区滚动逻辑；解耦评估：窗口 API 已封装到 environment 层，通过 helpers 网关继续访问即可。 */
import { getWindowSelection } from "./imports";
/** 用途：识别最近的块级 DOM 节点；使用范围：当前选区滚动和回退定位逻辑；解耦评估：块查找依赖 Protyle 结构，直接复用既有实现更可靠。 */
import { hasClosestBlock } from "./imports";
/** 用途：识别嵌入块中的重复命中节点；使用范围：按块 ID 查找高亮目标时过滤嵌入块结果；解耦评估：判定逻辑与 Protyle DOM 强耦合，直接复用更稳。 */
import { isInEmbedBlock } from "./imports";
/** 用途：读取编辑器配置；使用范围：顶部对齐滚动的额外空白计算；解耦评估：配置读取已抽象到 environment 层，通过 helpers 网关复用即可。 */
import { getSiyuanConfig } from "./imports";
/** 用途：执行不依赖编辑器状态的目标滚动；使用范围：明确目标节点后的滚动分支；解耦评估：经本目录网关直达纯 DOM 唯一实现。 */
import {scrollTargetIntoView} from "./imports";

const MOBILE_BOTTOM_GAP = 74;
const START_POSITION_EXTRA_GAP = 24;

/**
 * 规范化历史调用方传入的滚动位置参数，兼容旧代码仍传布尔值的情况。
 * 调用时机：`highlightById.ts` 在执行主流程前同步调用。
 * 问题/改进：当前把 `true` 解释为顶部对齐，延续了旧式 `scrollIntoView(true)` 的语义。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const normalizeScrollPosition = (position?: ScrollLogicalPosition | boolean) => {
    const usesLegacyTopAlign = position === true;
    if (usesLegacyTopAlign) {
        return "start";
    }
    const isNamedPosition = position === "start" || position === "center" || position === "nearest";
    if (isNamedPosition) {
        return position;
    }
    return "nearest";
};

/** @简洁函数 */
const getTopSpacing = () => (getSiyuanConfig()?.editor?.fontSize ?? 16) * 1.625 * 2 + START_POSITION_EXTRA_GAP;

/**
 * 查找块 ID 对应的首个可高亮节点，同时跳过嵌入块内部的重复命中。
 * 调用时机：`highlightById.ts` 在执行滚动前同步调用。
 * 问题/改进：当前依赖 DOM 顺序返回第一个匹配项，如果未来需要更精细的优先级可再扩展。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const findHighlightTarget = (protyle: IProtyle, id: string) => {
    for (const item of protyle.wysiwyg.element.querySelectorAll<HTMLElement>(`[data-node-id="${id}"]`)) {
        const belongsToEmbedBlock = isInEmbedBlock(item);
        if (belongsToEmbedBlock) {
            continue;
        }
        return item;
    }
    return undefined;
};

/**
 * 从编辑器当前选区回退到最近块级元素，供未显式传入目标节点时使用。
 * 调用时机：`highlightById.ts` 在没有 `nodeElement` 且当前焦点不在原生输入框时调用。
 * 问题/改进：当前仍依赖编辑器选区存在，若未来存在更多焦点源可继续补充回退策略。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const resolveCurrentBlockElement = (protyle: IProtyle) => {
    const activeTagName = document.activeElement?.tagName;
    const isNativeTextInput = activeTagName === "TEXTAREA" || activeTagName === "INPUT";
    if (isNativeTextInput) {
        return undefined;
    }
    const editorRange = getEditorRange(protyle.wysiwyg.element);
    const blockElement = hasClosestBlock(editorRange.startContainer);
    const isHtmlElement = blockElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    return blockElement;
};

/**
 * 用于检测数据库视图头尾是否正在发生 transform 滚动，从而避免撤销流程里误触发滚动。
 * 调用时机：属性视图分支滚动前同步调用。
 * 问题/改进：当前通过 style 字符串判断 transform，后续若视图层提供状态标记可替换为更明确的信号。
 */
const containsTransformStyle = (element: Element | null) => {
    const styleValue = element?.getAttribute("style");
    const hasStyleValue = !!styleValue;
    if (!hasStyleValue) {
        return false;
    }
    return styleValue.includes("transform");
};

/**
 * 处理代码块内选区滚动，避免临时插入节点后破坏代码块横向滚动位置。
 * 调用时机：当前选区命中代码块时调用。
 * 问题/改进：当前依赖插入临时 `br` 节点的方式定位，后续如果浏览器提供更稳定 API 可替换。
 */
const scrollCodeBlockSelection = (
    blockElement: HTMLElement,
    range: Range,
    options: ScrollIntoViewOptions
) => {
    const hljsElement = blockElement.querySelector<HTMLElement>(".hljs");
    const hasHljsElement = !!hljsElement;
    if (!hasHljsElement) {
        blockElement.scrollIntoView(options);
        return;
    }
    const scrollLeft = hljsElement.scrollLeft;
    const markerElement = document.createElement("br");
    range.insertNode(markerElement);
    markerElement.scrollIntoView(options);
    markerElement.remove();
    hljsElement.scrollLeft = scrollLeft;
};

/**
 * 处理数据库属性视图中的选区滚动，优先滚动当前激活单元格而不是整个表格容器。
 * 调用时机：当前选区命中 `av` 视图时调用。
 * 问题/改进：当前仍依赖 DOM 查询判断激活单元格，后续如视图层暴露明确状态可继续收敛。
 */
const scrollAttributeViewSelection = (
    blockElement: HTMLElement,
    position: ScrollLogicalPosition,
    behavior: ScrollBehavior
) => {
    const headerElement = blockElement.querySelector<HTMLElement>(".av__row--header");
    const footerElement = blockElement.querySelector<HTMLElement>(".av__row--footer");
    const isDuringTransformScroll = containsTransformStyle(headerElement) || containsTransformStyle(footerElement);
    if (isDuringTransformScroll) {
        return;
    }
    const activeElement = blockElement.querySelector<HTMLElement>(".av__cell--select, .av__row--select, .av__gallery-item--select");
    const scrollTarget = activeElement || blockElement;
    scrollTarget.scrollIntoView({ block: position, behavior });
};

/**
 * 在普通编辑区根据当前选区位置调整容器滚动，同时在结束后恢复原始 Range。
 * 调用时机：当前选区命中普通块时调用。
 * 问题/改进：当前通过临时插入节点测量光标位置，虽然稳妥但会产生一次额外 DOM 变更。
 */
const scrollSelectionInsideEditor = (protyle: IProtyle, range: Range, behavior: ScrollBehavior) => {
    const cloneRange = range.cloneRange();
    const markerElement = document.createElement("br");
    range.insertNode(markerElement);
    const editorElement = protyle.contentElement;
    const cursorTop = markerElement.getBoundingClientRect().top - editorElement.getBoundingClientRect().top;
    let scrollTop = 0;
    const shouldScrollUp = cursorTop < 0;
    if (shouldScrollUp) {
        scrollTop = editorElement.scrollTop + cursorTop;
    }
    const bottomThreshold = editorElement.clientHeight - MOBILE_BOTTOM_GAP;
    const shouldScrollDown = cursorTop > bottomThreshold;
    if (shouldScrollDown) {
        scrollTop = editorElement.scrollTop + (cursorTop + MOBILE_BOTTOM_GAP - editorElement.clientHeight);
    }
    const hasScrollOffset = scrollTop !== 0;
    if (hasScrollOffset) {
        editorElement.scroll({ top: scrollTop, behavior });
    }
    markerElement.remove();
    focusByRange(cloneRange);
};

/**
 * 优先按当前 Selection 处理滚动，这样在未传入显式节点时仍能把光标附近内容带回可视区。
 * 调用时机：`highlightById.ts` 在编辑器未禁用且未显式传入目标节点时调用。
 * 问题/改进：当前只使用第一个 Range，后续若浏览器广泛支持多选区可继续扩展。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const scrollCurrentSelection = (
    protyle: IProtyle,
    position: ScrollLogicalPosition,
    behavior: ScrollBehavior
) => {
    const selection = getWindowSelection();
    const hasSelection = !!selection;
    if (!hasSelection) {
        return false;
    }
    const hasRange = selection.rangeCount > 0;
    if (!hasRange) {
        return false;
    }
    const range = selection.getRangeAt(0);
    const blockElement = hasClosestBlock(range.startContainer);
    const isHtmlElement = blockElement instanceof HTMLElement;
    if (!isHtmlElement) {
        return false;
    }
    const isCodeBlock = blockElement.classList.contains("code-block");
    if (isCodeBlock) {
        scrollCodeBlockSelection(blockElement, range, {block: position, behavior});
        return true;
    }
    const isAttributeView = blockElement.classList.contains("av") && blockElement.dataset.render === "true";
    if (isAttributeView) {
        scrollAttributeViewSelection(blockElement, position, behavior);
        return true;
    }
    scrollSelectionInsideEditor(protyle, range, behavior);
    return true;
};

/**
 * 根据规范化后的滚动模式把目标块滚动到可见区域。
 * 调用时机：`highlightById.ts` 获得明确目标元素后调用。
 * 问题/改进：当前三种模式分散在独立 helper 内，便于后续按模式继续扩展。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const scrollNodeIntoView = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    options: Required<Pick<ScrollIntoViewOptions, "block" | "behavior">>
) => {
    const {block, behavior} = options;
    // 顶部对齐需要注入由编辑器字体配置计算的留白。
    if (block === "start") {
        scrollTargetIntoView(protyle.contentElement, nodeElement, {
            position: block,
            behavior,
            topSpacing: getTopSpacing(),
        });
        return;
    }
    scrollTargetIntoView(protyle.contentElement, nodeElement, {position: block, behavior});
};
