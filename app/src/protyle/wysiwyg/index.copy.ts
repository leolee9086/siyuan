/** 用途: 块/AV/表格内容处理函数；使用范围: routeCopyContent；解耦评估: 与 DOM 结构强耦合 */
import { processSelectElements } from "./index.copy.helpers";
/** 用途: AV 单元格复制；使用范围: routeCopyContent；解耦评估: 与 DOM 结构耦合 */
import { processSelectAV } from "./index.copy.helpers";
/** 用途: 表格选择区域复制；使用范围: routeCopyContent；解耦评估: 与 DOM 结构耦合 */
import { processSelectTable } from "./index.copy.helpers";
/** 用途: 表格范围检测；使用范围: handleCopy 入口；解耦评估: 与 DOM 结构耦合 */
import { detectTableRange } from "./index.copy.helpers";
/** 用途: 选中元素收集；使用范围: handleCopy 入口；解耦评估: 与 DOM 结构耦合 */
import { collectSelectElements } from "./index.copy.helpers";
/** 用途: 剪贴板写入；使用范围: handleCopy；解耦评估: 与 Clipboard API 耦合 */
import { writeClipboardData } from "./index.copy.helpers";
/** 用途: 路由参数类型定义；使用范围: routeCopyContent；解耦评估: pure type */
import type { RouteContentParams } from "./index.copy.types";
import type { CopyClipboardEvent } from "./index.copy.types";
/** 用途: 块级元素查找；使用范围: handleCopy 等；解耦评估: 与 DOM 结构耦合 */
import { hasClosestBlock } from "../util/hasClosest";
/** 用途: 属性匹配；使用范围: processGenericRange 等；解耦评估: 与 DOM 结构耦合 */
import { hasClosestByAttribute } from "../util/hasClosest";
/** 用途: 标签匹配；使用范围: processGenericRange 等；解耦评估: 与 DOM 结构耦合 */
import { hasClosestByTag } from "../util/hasClosest";
/** 用途: 选区获取；使用范围: handleCopy 入口；解耦评估: 与 contenteditable 耦合 */
import { getEditorRange } from "../util/selection";
/** 用途: 常量；使用范围: 多处；解耦评估: pure 常量 */
import { Constants } from "../../constants";
/** 用途: 只读模式 HTML 处理；使用范围: processDisabledAndTextPlain；解耦评估: 与只读模式耦合 */
import { getEnableHTML } from "./removeEmbed";
/** 用途: 块结尾检测；使用范围: processGenericRange；解耦评估: 与 AST 结构耦合 */
import { isEndOfBlock } from "./getBlock";
/** 用途: nbsp转space；使用范围: normalizeTextPlain；解耦评估: pure 工具 */
import { nbsp2space } from "../util/normalizeText";
/** 用途: 去除ZWSP；使用范围: normalizeTextPlain；解耦评估: pure 工具 */
import { removeZWJ } from "../util/normalizeText";
/** 用途: 表格 HTML 生成；使用范围: routeCopyContent；解耦评估: 与表格 DOM 耦合 */
import {getTableRangeHTML} from "../util/table/grid/html";
import {convertPastedListItemSubtype, getPlainText} from "../util/paste";

/** @同步豁免: 需要绝对同步的DOM访问 */
export function emojiToMd(element: HTMLElement) {
    const emojiElements = element.querySelectorAll(".emoji");
    for (const item of emojiElements) {
        const itemElement = item;
        itemElement.outerHTML = `:${itemElement.getAttribute("alt")}:`;
    }
}

export const getCrossBlockPlainText = (element: HTMLElement) => Array.from(element.children)
    .map(item => getPlainText(item as HTMLElement).trimEnd())
    .filter(Boolean)
    .join("\n");

export const normalizeCrossBlockCopy = (sourceElement: HTMLElement, copiedElement: HTMLElement, range: Range) => {
    copiedElement.querySelectorAll<HTMLElement>('[data-type~="virtual-block-ref"]').forEach(item => {
        const types = (item.getAttribute("data-type") || "").split(" ")
            .filter(type => type && type !== "virtual-block-ref");
        if (types.length > 0) {
            item.setAttribute("data-type", types.join(" "));
        } else {
            item.replaceWith(...Array.from(item.childNodes));
        }
    });
    let firstElement = copiedElement.firstElementChild as HTMLElement | null;
    while (firstElement?.getAttribute("data-type") === "NodeListItem") {
        const childBlocks = Array.from(firstElement.children).filter(item =>
            item.hasAttribute("data-node-id")) as HTMLElement[];
        if (childBlocks.length !== 1 || childBlocks[0].getAttribute("data-type") !== "NodeList") {
            break;
        }
        const listItems = Array.from(childBlocks[0].children).filter(item =>
            item.getAttribute("data-type") === "NodeListItem");
        if (listItems.length === 0) {
            break;
        }
        firstElement.replaceWith(...listItems);
        firstElement = copiedElement.firstElementChild as HTMLElement | null;
    }
    copiedElement.querySelectorAll<HTMLElement>("[data-node-id]").forEach(item => {
        const sourceElements = sourceElement.querySelectorAll<HTMLElement>(
            `[data-node-id="${item.getAttribute("data-node-id")}"]`,
        );
        const source = Array.from(sourceElements).find(candidate => range.intersectsNode(candidate)) || sourceElements[0];
        if (!source) {
            return;
        }
        const prependElements = Array.from(source.children).filter(sourceChild =>
            (sourceChild.classList.contains("protyle-action") || sourceChild.classList.contains("callout-info")) &&
            !Array.from(item.children).some(child => child.className === sourceChild.className));
        item.prepend(...prependElements.map(child => child.cloneNode(true)));
        const attrElement = source.querySelector(":scope > .protyle-attr");
        if (attrElement && !item.querySelector(":scope > .protyle-attr")) {
            item.append(attrElement.cloneNode(true));
        }
    });
    const listItemElements = Array.from(copiedElement.children).filter(item =>
        item.getAttribute("data-type") === "NodeListItem") as HTMLElement[];
    const subtype = listItemElements[0]?.getAttribute("data-subtype");
    if (subtype && listItemElements.length > 1 && listItemElements.length === copiedElement.childElementCount) {
        listItemElements.forEach(item => {
            if (item.getAttribute("data-subtype") !== subtype) {
                convertPastedListItemSubtype(item, subtype);
            }
        });
    }
};

/** 处理匹配的行内元素或标题 */
function processMatchHeadingOrRange(range: Range) {
    const tempElement = document.createElement("div");
    const headingElement = hasClosestByAttribute(range.startContainer, "data-type", "NodeHeading");
    const matchHeading = headingElement && headingElement.textContent.replace(Constants.ZWSP, "") === range.toString();
    // 匹配标题时复制整个标题块
    if (matchHeading) {
        tempElement.append(headingElement.cloneNode(true));
        const textWithoutAttr = clearAttrContent(tempElement);
        headingElement.removeAttribute("fold");
        return { html: tempElement.innerHTML, textPlain: textWithoutAttr ?? range.toString() };
    }
    const parentEl = range.startContainer.parentElement;
    // @内联数组
    const blockTagNames = ["DIV", "TD", "TH", "TR"];
    // 非块级容器（DIV/TD/TH/TR）时复制整个行内元素
    if (!blockTagNames.includes(parentEl?.tagName ?? "") && parentEl) {
        tempElement.append(parentEl.cloneNode(true));
        emojiToMd(tempElement);
        return { html: tempElement.innerHTML, textPlain: range.toString() };
    }
    tempElement.append(range.cloneContents());
    const textWithoutAttr = clearAttrContent(tempElement);
    emojiToMd(tempElement);
    return { html: tempElement.innerHTML, textPlain: textWithoutAttr ?? range.toString() };
}

/** 处理部分选中的行内样式 */
function processPartialSelect(range: Range) {
    const parentElement = range.startContainer.parentElement;
    // 无父元素时直接返回选中文本
    if (!parentElement) {
        return { html: range.toString(), textPlain: range.toString() };
    }
    const attributes = parentElement.attributes;
    const clonedSpanElement = document.createElement("span");
    for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        if (attr) {
            clonedSpanElement.setAttribute(attr.name, attr.value);
        }
    }
    const dataType = clonedSpanElement.getAttribute("data-type");
    // 动态块引用需转为静态锚文本
    if (dataType && dataType.indexOf("block-ref") > -1 &&
        clonedSpanElement.getAttribute("data-subtype") === "d") {
        clonedSpanElement.setAttribute("data-subtype", "s");
    }
    clonedSpanElement.textContent = range.toString();
    return { html: clonedSpanElement.outerHTML, textPlain: range.toString() };
}

/** 收集混合内容文本 */
function collectMixedTextPlain(tempElement: HTMLElement, protyle: IProtyle) {
    let textPlain = "";
    for (const item of tempElement.childNodes) {
        // 文本节点直接拼接
        if (item.nodeType === 3) {
            textPlain += item.textContent;
            continue;
        }
        // 非 Element 节点跳过
        if (!(item instanceof Element)) {
            textPlain += item.textContent;
            continue;
        }
        const isImg = item.classList.contains("img");
        const isInlineMath = item.getAttribute("data-type") === "inline-math";
        // 行内数学公式需标记类型
        if (isInlineMath) {
            item.setAttribute("data-type", "inline-math");
            textPlain += protyle.lute.BlockDOM2StdMd(item.outerHTML).trimEnd();
            continue;
        }
        // 图片输出 Markdown 格式
        if (isImg) {
            textPlain += protyle.lute.BlockDOM2StdMd(item.outerHTML).trimEnd();
            continue;
        }
        textPlain += item.textContent;
    }
    return textPlain;
}

/** 处理一般范围复制 */
function processGenericRange(protyle: IProtyle, range: Range) {
    const tempElement = document.createElement("div");
    tempElement.append(range.cloneContents());
    const isCrossBlock = hasClosestBlock(range.startContainer) !== hasClosestBlock(range.endContainer);
    if (isCrossBlock) {
        normalizeCrossBlockCopy(protyle.wysiwyg.element, tempElement, range);
    }
    const textWithoutAttr = clearAttrContent(tempElement);
    const crossBlockTextPlain = isCrossBlock ? getCrossBlockPlainText(tempElement) : undefined;
    emojiToMd(tempElement);
    const inlineMathElement = hasClosestByAttribute(range.commonAncestorContainer, "data-type", "inline-math");
    const html = inlineMathElement ? inlineMathElement.outerHTML : tempElement.innerHTML;
    // 代码块内复制，标记 isInCodeBlock 防止 Markdown 语法转换
    if (hasClosestByAttribute(range.startContainer, "data-type", "NodeCodeBlock")) {
        const textPlain = isEndOfBlock(range) ? tempElement.textContent.replace(/\n$/, "") : tempElement.textContent;
        return { html, textPlain, isInCodeBlock: true };
    }
    // 表格内复制，将 <br> 转为换行
    if (hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH")) {
        tempElement.innerHTML = tempElement.innerHTML.replace(/<br>/g, "\n").replace(/<br\/>/g, "\n");
        const textPlain = tempElement.textContent.endsWith("\n") ? tempElement.textContent.replace(/\n$/, "") : tempElement.textContent;
        return { html, textPlain, isInCodeBlock: false };
    }
    // 包含图片或行内数学公式时单独拼接文本
    if (tempElement.querySelector('.img, [data-type~="inline-math"]')) {
        const textPlain = crossBlockTextPlain ?? collectMixedTextPlain(tempElement, protyle);
        return { html, textPlain, isInCodeBlock: false };
    }
    // 非 CODE 标签内的文本
    if (!hasClosestByTag(range.startContainer, "CODE")) {
        return { html, textPlain: crossBlockTextPlain ?? textWithoutAttr ?? range.toString(), isInCodeBlock: false };
    }
    return { html, textPlain: tempElement.textContent, isInCodeBlock: false };
}

/** 处理内联内容复制 */
function processInlineContent(params: {
    protyle: IProtyle;
    range: Range;
    selectImgElement: HTMLElement | null;
    selectTypes: string[];
}) {
    const { protyle, range, selectImgElement, selectTypes } = params;
    const spanElement = hasClosestByTag(range.startContainer, "SPAN");
    const headingElement = hasClosestByAttribute(range.startContainer, "data-type", "NodeHeading");
    const matchHeading = headingElement && headingElement.textContent.replace(Constants.ZWSP, "") === range.toString();
    // 选中整个行内元素或标题时复制结构和属性
    if ((selectTypes.length > 0 && spanElement && spanElement.textContent.replace(Constants.ZWSP, "") === range.toString()) ||
        matchHeading) {
        const result = processMatchHeadingOrRange(range);
        return { ...result, isInCodeBlock: false };
    }
    // 单独选中的图片
    if (selectImgElement) {
        return {
            html: selectImgElement.outerHTML,
            textPlain: protyle.lute.BlockDOM2StdMd(selectImgElement.outerHTML).replace(/%20/g, " "),
            isInCodeBlock: false,
        };
    }
    // 选中粗体等字体中的一部分，保留样式属性
    if (selectTypes.length > 0 && range.startContainer.nodeType === 3 &&
        range.startContainer.parentElement?.tagName === "SPAN" &&
        range.startContainer.parentElement === range.endContainer.parentElement) {
        const result = processPartialSelect(range);
        return { ...result, isInCodeBlock: false };
    }
    const genericResult = processGenericRange(protyle, range);
    return { html: genericResult.html, textPlain: genericResult.textPlain, isInCodeBlock: genericResult.isInCodeBlock };
}

/** 复制前将属性占位内容替换为空白标记，避免属性文本进入纯文本结果。 */
function clearAttrContent(element: HTMLElement) {
    const attrElements = element.querySelectorAll(".protyle-attr");
    if (attrElements.length === 0) {
        return undefined;
    }
    attrElements.forEach(item => {
        item.textContent = Constants.ZWSP;
    });
    return element.textContent;
}

/** 规范化 textPlain */
function normalizeTextPlain(textPlain: string, html: string, protyle: IProtyle) {
    const result = textPlain || protyle.lute.BlockDOM2StdMd(html).trimEnd();
    return removeZWJ(nbsp2space(result))
        .replace(new RegExp(Constants.ZWSP, "g"), "");
}

/** 禁用模式处理 + textPlain 规范化 */
function processDisabledAndTextPlain(protyle: IProtyle, html: string, textPlain: string) {
    let resultHtml = html;
    let resultText = textPlain;
    // 禁用模式时移除编辑属性
    if (protyle.disabled) {
        resultHtml = getEnableHTML(resultHtml);
    }
    resultText = normalizeTextPlain(resultText, resultHtml, protyle);
    return { html: resultHtml, textPlain: resultText };
}

/** 复制内容路由 */
async function routeCopyContent(params: RouteContentParams) {
    const { protyle, nodeElement, range, selectElements, selectImgElement, selectAVElement, selectTableElement, selectTableRange, tableRangeElement, tableRangeStartCell, tableRangeEndCell } = params;
    // 选中块优先处理
    if (selectElements.length > 0) {
        const blockResult = await processSelectElements(protyle, selectElements);
        return { html: blockResult.html, textPlain: "", isInCodeBlock: false, needClipboardWrite: blockResult.needClipboardWrite };
    }
    // 属性视图单元格复制
    if (selectAVElement) {
        const avResult = processSelectAV(nodeElement);
        return { html: avResult.html, textPlain: avResult.textPlain, isInCodeBlock: false, needClipboardWrite: false };
    }
    // 表格选择区域复制
    if (selectTableElement) {
        const tableResult = processSelectTable(protyle, nodeElement);
        return { html: tableResult.html, textPlain: tableResult.textPlain, isInCodeBlock: false, needClipboardWrite: false };
    }
    // 表格范围选择（跨单元格）复制
    const tableElement = selectTableRange ? tableRangeElement.querySelector("table") : null;
    if (tableElement) {
        const html = getTableRangeHTML(tableElement, tableRangeStartCell, tableRangeEndCell);
        const textPlain = protyle.lute.HTML2Md(html);
        return { html, textPlain, isInCodeBlock: false, needClipboardWrite: false };
    }
    const selectTypes = protyle.toolbar.getCurrentType(range);
    const inlineResult = processInlineContent({ protyle, range, selectImgElement, selectTypes });
    return { html: inlineResult.html, textPlain: inlineResult.textPlain, isInCodeBlock: inlineResult.isInCodeBlock, needClipboardWrite: false };
}

/** 处理复制事件入口 */
export async function handleCopy(
    protyle: IProtyle,
    event: CopyClipboardEvent,
    skipNativeClipboardWrite = false,
) {
    window.siyuan.ctrlIsPressed = false;
    // 编辑区外（PROTYLE-HTML 或 input 元素）不处理复制
    if (event.target.tagName === "PROTYLE-HTML" || event.target.localName === "input") {
        event.stopPropagation();
        return;
    }
    event.stopPropagation();
    event.preventDefault();
    const range = getEditorRange(protyle.wysiwyg.element);
    const nodeElement = hasClosestBlock(range.startContainer);
    // 无块级元素时返回
    if (!nodeElement) {
        return;
    }
    const selectImgElement = nodeElement.querySelector(".img--select");
    const selectAVElement = nodeElement.querySelector(".av__row--select, .av__cell--select");
    const tableSelectEl = nodeElement.querySelector(".table__select");
    const selectTableElement = tableSelectEl?.clientWidth > 0;
    const tableRange = detectTableRange(range, selectTableElement);
    const selectElements = collectSelectElements(protyle, nodeElement, range, selectImgElement, selectAVElement, selectTableElement, tableRange.selectTableRange);
    const routeResult = await routeCopyContent({
        protyle, nodeElement, range, selectElements,
        selectImgElement, selectAVElement, selectTableElement,
        selectTableRange: tableRange.selectTableRange,
        tableRangeElement: tableRange.tableRangeElement,
        tableRangeStartCell: tableRange.tableRangeStartCell,
        tableRangeEndCell: tableRange.tableRangeEndCell,
    });
    const processed = processDisabledAndTextPlain(protyle, routeResult.html, routeResult.textPlain);
    event.clipboardData.setData("text/plain", processed.textPlain);
    // 代码块内不写入 siyuan/html 格式
    if (!routeResult.isInCodeBlock) {
        await writeClipboardData(protyle, event, processed.html, processed.textPlain, selectTableElement, tableRange.selectTableRange,
            selectAVElement, routeResult.needClipboardWrite && !skipNativeClipboardWrite);
    }
}
