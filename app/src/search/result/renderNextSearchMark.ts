/** 用途：搜索标记轮转所需高亮和滚动能力；使用范围：当前结果预览；解耦评估：经 result 子域网关直达唯一实现并支持确定性测试替换。 */
import {highlightById} from "./imports";
/** 用途：选择 CSS Highlight 或旧 DOM 标记路径；使用范围：当前结果预览；解耦评估：能力检测经 result 子域网关隔离。 */
import {isSupportCSSHL} from "./imports";
/** 用途：滚动到当前文本范围；使用范围：CSS Highlight 路径；解耦评估：滚动算法经 result 子域网关隔离。 */
import {scrollToCurrent} from "./imports";
/** 用途：约束搜索预览编辑器完整表面；使用范围：结果标记轮转；解耦评估：纯类型经子域网关直达领域根。 */
import type {ProtyleDomain} from "./imports";

/** 取得搜索预览已经挂载的正文容器。 */
const getRequiredContentElement = (protyle: IProtyle) => {
    // 结果轮转仅在搜索预览完成挂载后有效。
    if (!protyle.contentElement) {
        throw new TypeError("Search preview Protyle is missing contentElement");
    }
    return protyle.contentElement;
};

/** 取得旧 DOM 标记路径已经挂载的编辑区域。 */
const getRequiredWysiwygElement = (protyle: IProtyle) => {
    // 旧标记由 wysiwyg DOM 承载，缺失时不能进行结果轮转。
    if (!protyle.wysiwyg?.element) {
        throw new TypeError("Search preview Protyle is missing wysiwyg element");
    }
    return protyle.wysiwyg.element;
};

/** 轮转 CSS Highlight 范围并滚动到新的当前项。 */
const renderNextCSSHighlight = (protyle: IProtyle, id: string, contentRect: DOMRect) => {
    protyle.highlight.markHL.clear();
    protyle.highlight.mark.clear();
    protyle.highlight.rangeIndex++;
    // 超过最后一个范围时循环回首项。
    if (protyle.highlight.rangeIndex >= protyle.highlight.ranges.length) {
        protyle.highlight.rangeIndex = 0;
    }
    let currentRange: Range | undefined;
    for (const [index, item] of protyle.highlight.ranges.entries()) {
        // 当前下标对应的新焦点进入强调集合，其余范围进入普通搜索集合。
        if (protyle.highlight.rangeIndex === index) {
            protyle.highlight.markHL.add(item);
            currentRange = item;
            continue;
        }
        protyle.highlight.mark.add(item);
    }
    // 没有可轮转范围时只保留清空后的高亮状态。
    if (!currentRange) {
        return;
    }
    // 空文本范围代表块级命中，沿用块高亮而不是范围滚动。
    if (!currentRange.toString()) {
        highlightById(protyle, id, "center");
        return;
    }
    scrollToCurrent(getRequiredContentElement(protyle), currentRange, contentRect);
};

/** 清除旧 DOM 焦点并取得循环后的下一个搜索标记。 */
const getNextLegacySearchMark = (protyle: IProtyle) => {
    const wysiwygElement = getRequiredWysiwygElement(protyle);
    const allMatchElements = Array.from(wysiwygElement.querySelectorAll<HTMLElement>('span[data-type~="search-mark"]'));
    let matchElement: HTMLElement | undefined;
    for (const [itemIndex, item] of allMatchElements.entries()) {
        // 每个旧焦点都被清除，下一兄弟候选保持旧实现的最后一次赋值语义。
        if (item.classList.contains("search-mark--hl")) {
            item.classList.remove("search-mark--hl");
            matchElement = allMatchElements[itemIndex + 1];
        }
    }
    return matchElement || allMatchElements[0];
};

/** 轮转旧 DOM 搜索标记并保持原滚动计算。 */
const renderNextLegacySearchMark = (protyle: IProtyle, contentRect: DOMRect) => {
    const matchElement = getNextLegacySearchMark(protyle);
    // 搜索结果没有标记时不改变滚动位置。
    if (!matchElement) {
        return;
    }
    matchElement.classList.add("search-mark--hl");
    const contentElement = getRequiredContentElement(protyle);
    contentElement.scrollTop = contentElement.scrollTop + matchElement.getBoundingClientRect().top - contentRect.top - contentRect.height / 2;
};

/** 在当前搜索结果中轮转到下一个匹配标记。 */
/** @同步豁免: 需要绝对同步的DOM访问 - 点击同一搜索结果时必须在当前事件栈内更新 Highlight 集合、焦点类和 scrollTop；调用方随后立即恢复输入焦点，改为异步会改变可观察的焦点与滚动顺序。 */
export const renderNextSearchMark = (options: {
    id: string;
    edit: ProtyleDomain;
    target: Element;
}) => {
    const protyle = options.edit.protyle;
    const contentRect = getRequiredContentElement(protyle).getBoundingClientRect();
    // 浏览器支持 CSS Highlight 时轮转 Range，否则使用旧 span 标记。
    if (isSupportCSSHL()) {
        renderNextCSSHighlight(protyle, options.id, contentRect);
        return;
    }
    renderNextLegacySearchMark(protyle, contentRect);
};
