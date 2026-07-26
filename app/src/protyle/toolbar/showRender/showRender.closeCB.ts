/**
 * showRender 模块 - 关闭回调
 */
import * as dayjs from "dayjs";
import { focusBlock, focusByRange, focusByWbr } from "../../util/selection";
import { hasClosestByClassName } from "../../util/hasClosest";
import { contentRendererRegistry } from "../../../registry/contentRenderer/ContentRendererRegistry";
import { blockRender } from "../../render/blockRender";
import {updateTransaction} from "../../wysiwyg/transaction/update";
import { showMessage } from "../../runtime/dialog.port";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getDOMPurify } from "../../../util/siyuanEnvironments/getDOMPurify.environment";
import type { 渲染面板上下文 } from "./showRender.types";


/** 处理 HTML 块保存 */
function 处理HTML块保存(renderElement: Element, value: string): void {
    const htmlElement = renderElement.querySelector("protyle-html");
    if (!htmlElement) {
        return;
    }

    let htmlText = value;
    if (!htmlText) {
        htmlElement.setAttribute("data-content", "");
        return;
    }

    // 移除首尾空白和连续换行
    htmlText = htmlText.trim().replace(/\n+/g, "\n");

    // 需要 div 包裹
    const 需要包裹 = !(htmlText.startsWith("<div>") && htmlText.endsWith("</div>"));
    if (需要包裹) {
        htmlText = `<div>\n${htmlText}\n</div>`;
    }

    htmlElement.setAttribute("data-content", Lute.EscapeHTMLStr(htmlText));
}

/** 处理单个行内备注元素清空 */
function 处理行内备注清空(item: Element, 是最后一个: boolean): Element | undefined {
    const currentTypes = (item.getAttribute("data-type") ?? "").split(" ");
    const 仅有备注类型 = currentTypes.length === 1 && currentTypes[0] === "inline-memo";

    if (仅有备注类型) {
        const wbr = 是最后一个 ? "<wbr>" : "";
        item.outerHTML = item.innerHTML + wbr;
        return 是最后一个 ? item : undefined;
    }

    const newTypes = currentTypes.filter(t => t !== "inline-memo");
    item.setAttribute("data-type", newTypes.join(" "));
    item.removeAttribute("data-inline-memo-content");
    return 是最后一个 ? item : undefined;
}

/** 处理行内备注保存 */
function 处理行内备注保存(
    renderElement: Element,
    value: string,
    updateElements?: Element[]
): Element | undefined {
    const elements = updateElements ?? [renderElement];
    const lastIndex = elements.length - 1;
    let 最后节点: Element | undefined;

    for (let i = 0; i < elements.length; i++) {
        const item = elements[i];
        if (!item) {
            continue;
        }
        const 是最后一个 = i === lastIndex;

        if (!value) {
            最后节点 = 处理行内备注清空(item, 是最后一个);
            continue;
        }

        if (item.nodeType !== 3) {
            const sanitizedValue = getDOMPurify().sanitize(value);
            item.setAttribute("data-inline-memo-content", sanitizedValue);
        }
    }

    return 最后节点;
}

/** 处理行内数学公式保存 */
function 处理行内数学公式保存(renderElement: Element, value: string): Element | undefined {
    if (value) {
        renderElement.setAttribute("data-content", Lute.EscapeHTMLStr(value));
        renderElement.removeAttribute("data-render");
        contentRendererRegistry.renderElement(renderElement);
        return undefined;
    }
    // 清空时移除元素
    renderElement.outerHTML = "<wbr>";
    return renderElement;
}

/** 处理通用渲染保存 */
function 处理通用渲染保存(
    renderElement: Element,
    value: string,
    types: string[],
    protyle: IProtyle
): void {
    renderElement.setAttribute("data-content", Lute.EscapeHTMLStr(value));
    renderElement.removeAttribute("data-render");

    if (!types.includes("NodeBlockQueryEmbed")) {
        contentRendererRegistry.renderElement(renderElement);
        return;
    }

    blockRender(protyle, renderElement);
    if (renderElement instanceof HTMLElement) {
        renderElement.style.height = "";
    }
}

/** 定位到行内节点后面 */
function 定位到行内节点后(node: Element, range: Range): void {
    range.setStartAfter(node);
    range.collapse(true);
    focusByRange(range);
}

/** 定位光标到 SPAN 元素 */
function 定位光标到Span(
    renderElement: Element,
    nodeElement: HTMLElement,
    inlineLastNode: Element | undefined,
    range?: Range
): void {
    if (!range) {
        return;
    }

    if (inlineLastNode?.parentElement) {
        定位到行内节点后(inlineLastNode, range);
        return;
    }

    if (inlineLastNode) {
        focusByWbr(nodeElement, range);
        return;
    }

    if (renderElement.parentElement) {
        定位到行内节点后(renderElement, range);
    }
}

/** 定位光标 */
function 定位光标(
    renderElement: Element,
    nodeElement: HTMLElement,
    inlineLastNode: Element | undefined,
    range?: Range
): void {
    const selection = getSelection();
    const 有选区 = selection && selection.rangeCount > 0;
    const 在工具区内 = 有选区 && hasClosestByClassName(
        selection.getRangeAt(0).startContainer,
        "protyle-util"
    );
    const 需要定位 = !有选区 || 在工具区内;

    if (!需要定位) {
        // 非定位场景：ctrl+M 后点击空白会留下 wbr
        const wbr = nodeElement.querySelector("wbr");
        wbr?.remove();
        return;
    }

    if (renderElement.tagName === "SPAN") {
        定位光标到Span(renderElement, nodeElement, inlineLastNode, range);
        return;
    }

    focusBlock(renderElement);
    renderElement.classList.add("protyle-wysiwyg--select");
}

/** 检查 HTML 块多 pre 警告 */
function 检查HTML块多pre警告(nodeElement: HTMLElement, protyle: IProtyle): void {
    const lute = protyle.lute;
    if (!lute) {
        return;
    }
    const tempElement = document.createElement("template");
    tempElement.innerHTML = lute.SpinBlockDOM(nodeElement.outerHTML);
    if (tempElement.content.childElementCount > 1) {
        showMessage(siyuanI18n.htmlBlockTip);
    }
}

/** 根据类型保存内容 */
function 保存内容(上下文: 渲染面板上下文): Element | undefined {
    const { renderElement, textElement, types, 是否行内备注, updateElements, protyle } = 上下文;
    const value = textElement.value;

    if (types.includes("NodeHTMLBlock")) {
        处理HTML块保存(renderElement, value);
        return undefined;
    }

    if (是否行内备注) {
        return 处理行内备注保存(renderElement, value, updateElements);
    }

    if (types.includes("inline-math")) {
        return 处理行内数学公式保存(renderElement, value);
    }

    处理通用渲染保存(renderElement, value, types, protyle);
    return undefined;
}

/**
 * 创建 subElement 关闭时的回调函数
 */
export function 创建关闭回调(
    上下文: 渲染面板上下文,
    旧文本值: string,
    range?: Range
): () => void {
    return () => {
        const {
            renderElement,
            nodeElement,
            textElement,
            types,
            protyle,
            html
        } = 上下文;

        // 检查是否需要保存（上游 #17082: 优化无变更时的提前返回逻辑）
        const 无变更 = !renderElement.parentElement || protyle.disabled ||
            (textElement.value && 旧文本值 === textElement.value);

        // 光标定位（上游 #17082: 无论是否变更都需要定位光标）
        if (无变更) {
            定位光标(renderElement, nodeElement, undefined, range);
            return;
        }

        // 保存内容
        const inlineLastNode = 保存内容(上下文);

        // 光标定位
        定位光标(renderElement, nodeElement, inlineLastNode, range);

        // 更新节点（上游 #17082: 仅在真正变更时才更新）
        if (nodeElement.outerHTML !== html) {
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, nodeElement, html);
        }
    };
}
