import { isHTMLElement } from "../../../util/DOM/element.guard";
import { hasClosestByTag } from "../../util/hasClosest";
import { getContenteditableElement, getNextBlock } from "../getBlock";
import { getSelectionOffset, setFirstNodeRange, setLastNodeRange } from "../../util/selection";
import { matchHotKey } from "../../util/hotKey";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { isMac } from "../../util/compatibility";

/**
 * 处理向上选中的空白情况逻辑。
 * 
 * 当光标在可编辑元素的开头附近时，选中到该元素的起始位置。
 * 
 * @returns true 表示处理完毕，需要提前 return；false 表示继续执行
 */
export const handleSelectUpEmpty = (options: {
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    event: KeyboardEvent,
}) => {
    const tdElement = hasClosestByTag(options.range.startContainer, "TD") || hasClosestByTag(options.range.startContainer, "TH");
    const nodeEditableElement = tdElement || getContenteditableElement(options.nodeElement) || options.nodeElement;
    if (!isHTMLElement(nodeEditableElement)) {
        return false;
    }
    const startIndex = getSelectionOffset(nodeEditableElement, options.editorElement, options.range).start;
    const innerText = nodeEditableElement.innerText;
    const isExpandUp = matchHotKey(getSiyuanConfig().keymap.editor.general.expandUp.custom, options.event);

    // Windows 中 ⌥⇧↑ 默认无选中功能会导致 https://ld246.com/article/1716635371149
    if (startIndex === 0 || (!isMac() && isExpandUp)) {
        return false;
    }

    // 选中上一个节点的处理在 toolbar/index.ts 中 `shift+方向键或三击选中`
    // 当第一行太长自然换行的情况：检查光标前没有换行符，且光标距离元素顶部很近
    const noNewlineBeforeCursor = innerText.substring(0, startIndex).indexOf("\n") === -1;
    const paddingTop = parseInt(getComputedStyle(nodeEditableElement).paddingTop);
    const isNearTop = options.range.getBoundingClientRect().top - nodeEditableElement.getBoundingClientRect().top - paddingTop < 14;

    if (noNewlineBeforeCursor && isNearTop) {
        setFirstNodeRange(nodeEditableElement, options.range);
        options.event.preventDefault();
    }
    return true;
};

/**
 * 处理向下选中或者 expandDown 的空白选区情况逻辑。
 * 
 * 当光标在可编辑元素的末尾附近时，选中到该元素的末尾位置。
 * 
 * @returns true 表示处理完毕，需要提前 return；false 表示继续执行
 */
export const handleSelectDownEmpty = (options: {
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    event: KeyboardEvent,
}) => {
    const tdElement = hasClosestByTag(options.range.startContainer, "TD") || hasClosestByTag(options.range.startContainer, "TH");
    const nodeEditableElement = tdElement || getContenteditableElement(options.nodeElement) || options.nodeElement;
    if (!isHTMLElement(nodeEditableElement)) {
        return false;
    }
    const endIndex = getSelectionOffset(nodeEditableElement, options.editorElement, options.range).end;
    const innerText = nodeEditableElement.innerText;
    const isExpandDown = matchHotKey(getSiyuanConfig().keymap.editor.general.expandDown.custom, options.event);

    // Windows 中 ⌥⇧↓ 默认无选中功能会导致 https://ld246.com/article/1716635371149
    if (!isMac() && isExpandDown) {
        return false;
    }
    if (endIndex >= innerText.length) {
        return false;
    }

    // 选中下一个节点的处理在 toolbar/index.ts 中 `shift+方向键或三击选中`
    // 当最后一行太长自然换行的情况
    const isAtEndLine = innerText.trimRight().substring(endIndex).indexOf("\n") === -1;
    const paddingBottom = parseInt(getComputedStyle(nodeEditableElement).paddingBottom);
    const isBottomClose = nodeEditableElement.getBoundingClientRect().bottom - options.range.getBoundingClientRect().bottom - paddingBottom < 14;

    // 先计算所有条件
    const isLastBlockEnd = !getNextBlock(options.nodeElement) && isAtEndLine && isBottomClose;
    const isCodeBlockExpandDown = isLastBlockEnd && options.nodeElement.classList.contains("code-block") && isExpandDown;

    // 代码块中 shift+alt 向下选中到末尾时，最后一个字符无法选中
    if (isCodeBlockExpandDown) {
        options.event.preventDefault();
    }

    // 当为最后一个块时应选中末尾
    if (isLastBlockEnd) {
        setLastNodeRange(nodeEditableElement, options.range, false);
        return true;
    }

    if (tdElement) {
        setLastNodeRange(tdElement, options.range, false);
        options.event.preventDefault();
        return true;
    }
    return true;
};
