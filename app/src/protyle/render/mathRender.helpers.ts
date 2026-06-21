/**
 * mathRender.helpers.ts - 数学公式渲染的 DOM 操作辅助函数
 *
 * 包含块级/行内公式的 DOM 渲染、光标修复、溢出处理和导出缩放等辅助逻辑。
 * 从 mathRender.ts 拆分出来以控制文件行数。
 *
 * @module protyle/render/mathRender.helpers
 */

import {Constants} from "../../constants";
import {hasClosestBlock} from "../util/hasClosest";
import {genRenderFrame} from "./util";
import {isHTMLElement, isHTMLElementNode} from "./mathRender.guard";

const hasNextSibling = (element: Node) => {
    let nextSibling = element.nextSibling;
    while (nextSibling) {
        if (nextSibling.textContent === "" && nextSibling.nodeType === Node.TEXT_NODE) {
            nextSibling = nextSibling.nextSibling;
        } else {
            return nextSibling;
        }
    }
    return false;
};

const hasPreviousSibling = (element: Node) => {
    let previousSibling = element.previousSibling;
    while (previousSibling) {
        if (previousSibling.textContent === "" && previousSibling.nodeType === Node.TEXT_NODE) {
            previousSibling = previousSibling.previousSibling;
        } else {
            return previousSibling;
        }
    }
    return false;
};

/**
 * 渲染块级数学公式（DIV 元素）
 *
 * 作用：将 KaTeX 渲染结果注入块级数学公式的渲染框架中，
 *       并修复 flex 布局和换行显示问题
 * 意图：块级公式需要特殊的 DOM 结构（protyle 渲染框架），
 *       与行内公式的处理方式不同
 * 调用时机：renderSingleMathElement 中判断为块级公式时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 操作 DOM 结构 */
export function renderBlockMath(mathElement: HTMLElement, mathHTML: string) {
    genRenderFrame(mathElement);
    const renderContainer = mathElement.firstElementChild?.firstElementChild;
    // renderContainer 可能因 DOM 结构异常而不存在，此时跳过渲染
    if (!renderContainer || !isHTMLElement(renderContainer)) {
        return;
    }
    renderContainer.classList.remove("ft__error");
    renderContainer.setAttribute("contenteditable", "false");
    renderContainer.innerHTML = mathHTML;

    // 修复 KaTeX 多行公式末尾的 flex 布局对齐问题
    // REF: https://github.com/siyuan-note/siyuan/issues/3541
    const baseElements = mathElement.querySelectorAll(".base");
    const lastBase = baseElements.length > 0 ? baseElements[baseElements.length - 1] : undefined;
    // 存在 .base 元素时，在最后一个后面插入弹性占位，修复对齐
    if (lastBase) {
        lastBase.insertAdjacentHTML("afterend", "<span class='fn__flex-1'></span>");
    }

    // 修复含 \newline 命令的公式显示为 inline 的问题
    // REF: https://github.com/siyuan-note/siyuan/issues/4334
    const newlineElement = mathElement.querySelector(".katex-html > .newline");
    if (!newlineElement) {
        return;
    }
    const newlineParent = newlineElement.parentElement;
    // parentElement 为 HTMLElement 时才能设置 style 属性
    if (isHTMLElement(newlineParent)) {
        newlineParent.style.display = "block";
    }
}

/**
 * 处理行内公式的溢出样式
 *
 * 作用：当行内公式宽度超过所在块元素宽度时，添加滚动样式；否则清除样式
 * 意图：防止过长的行内公式撑破布局，同时不影响正常宽度的公式
 * 调用时机：行内公式渲染完成后调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 读取 DOM 尺寸并设置样式 */
function applyInlineOverflowStyle(
    mathElement: HTMLElement,
    blockElement: HTMLElement | false
) {
    // 公式宽度超过块元素宽度时，启用横向滚动以防止布局溢出
    if (blockElement && mathElement.getBoundingClientRect().width > blockElement.clientWidth) {
        mathElement.style.maxWidth = "100%";
        mathElement.style.overflowX = "auto";
        mathElement.style.overflowY = "hidden";
        mathElement.style.display = "inline-block";
        return;
    }
    mathElement.style.maxWidth = "";
    mathElement.style.overflowX = "";
    mathElement.style.overflowY = "";
    mathElement.style.display = "";
}

/**
 * 处理行内公式无后方兄弟节点的情况
 *
 * 作用：在公式后插入换行符或零宽空格，确保光标可达
 * 意图：表格单元格和普通段落需要不同的处理方式
 * 调用时机：fixInlineAfterSibling 中判断无后方兄弟时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function fixInlineNoNextSibling(mathElement: HTMLElement) {
    const parentTag = mathElement.parentElement?.tagName ?? "";
    // 表格单元格中使用零宽空格而非换行符，避免表格编辑问题
    // REF: https://ld246.com/article/1629191424824
    if (parentTag === "TH" || parentTag === "TD") {
        mathElement.insertAdjacentText("afterend", Constants.ZWSP);
        return;
    }
    // 普通段落中插入换行符，确保光标可移动到末尾
    // REF: https://github.com/siyuan-note/siyuan/issues/2112
    mathElement.insertAdjacentText("afterend", "\n");
}

/**
 * 处理行内公式后方为文本节点的兄弟情况
 *
 * 作用：在特定条件下插入零宽非断空格，修复删除和光标问题
 * 意图：避免公式后一个字符删除多余 br，同时不破坏已有换行
 * 调用时机：fixInlineAfterSibling 中后方兄弟为文本节点时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function fixInlineTextNextSibling(mathElement: HTMLElement, nextSibling: Node) {
    const text = nextSibling.textContent ?? "";
    // 后方文本不以换行开头且不是零宽空格时，插入 FEFF 防止删除异常
    // REF: https://ld246.com/article/1647157880974
    if (!text.startsWith("\n") && text !== Constants.ZWSP) {
        mathElement.insertAdjacentHTML("beforeend", "&#xFEFF;");
    }
}

/**
 * 修复行内公式后方兄弟节点的光标和编辑问题
 *
 * 作用：根据后方兄弟节点的类型，插入适当的零宽字符或换行符
 * 意图：浏览器对 contenteditable 中相邻行内元素的光标处理存在缺陷，
 *       需要在特定位置插入不可见字符作为光标锚点
 * 调用时机：行内公式渲染完成后调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 操作 DOM 兄弟节点 */
function fixInlineAfterSibling(mathElement: HTMLElement) {
    const nextSibling = hasNextSibling(mathElement);

    // 无后方兄弟节点时，需要插入字符确保光标可达公式末尾
    if (!nextSibling) {
        fixInlineNoNextSibling(mathElement);
        return;
    }

    // 后方兄弟不是 HTMLElement（如纯文本节点）时，按文本节点逻辑处理
    if (!isHTMLElementNode(nextSibling)) {
        fixInlineTextNextSibling(mathElement, nextSibling);
        return;
    }

    // 后方是非文本节点且为行内公式或图片时，插入零宽空格分隔，否则删除或光标移动异常
    const dataType = nextSibling.getAttribute("data-type") ?? "";
    // 非文本节点(nodeType!==3)且是行内公式或图片元素时，需要零宽空格隔开
    if (nextSibling.nodeType !== 3 &&
        (dataType.indexOf("inline-math") > -1 || nextSibling.classList.contains("img"))) {
        mathElement.after(document.createTextNode(Constants.ZWSP));
        return;
    }

    fixInlineTextNextSibling(mathElement, nextSibling);
}

/**
 * 修复行内公式前方兄弟节点的光标问题
 *
 * 作用：在公式前方插入零宽空格，确保光标可移动到段首或单元格起始位置
 * 意图：浏览器在 contenteditable 中无法将光标定位到行内元素之前
 * 调用时机：行内公式渲染完成后调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
function fixInlineBeforeSibling(mathElement: HTMLElement) {
    // 前方兄弟以换行结尾时，插入零宽空格确保光标可达段首
    // REF: https://ld246.com/article/1623551823742
    if (mathElement.previousSibling?.textContent?.endsWith("\n")) {
        mathElement.insertAdjacentText("beforebegin", Constants.ZWSP);
        return;
    }
    const parentTag = mathElement.parentElement?.tagName ?? "";
    // 单元格中只有数学公式时，在公式前插入零宽空格确保光标可达
    if (!hasPreviousSibling(mathElement) && (parentTag === "TH" || parentTag === "TD")) {
        mathElement.insertAdjacentText("afterbegin", Constants.ZWSP);
    }
}

/**
 * 渲染行内数学公式（SPAN 元素）
 *
 * 作用：将 KaTeX 渲染结果注入行内公式元素，处理溢出样式，
 *       并修复光标定位相关的 DOM 问题
 * 意图：行内公式嵌入在段落文本流中，需要处理与相邻文本/元素的交互问题
 * 调用时机：renderSingleMathElement 中判断为行内公式时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 操作 DOM 结构和样式 */
export function renderInlineMath(mathElement: HTMLElement, mathHTML: string) {
    mathElement.classList.remove("ft__error");
    mathElement.innerHTML = mathHTML;
    const blockElement = hasClosestBlock(mathElement);
    applyInlineOverflowStyle(mathElement, blockElement);
    fixInlineAfterSibling(mathElement);
    fixInlineBeforeSibling(mathElement);
}

/**
 * 缩放块级公式以适应 PDF 导出宽度
 *
 * 作用：检测 .katex-display 容器是否溢出，溢出时按比例缩小字体
 * 意图：PDF 导出不支持横向滚动，必须通过缩放确保公式完整可见
 * 调用时机：renderSingleMathElement 中 maxWidth=true 且为块级公式时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export function scaleBlockMathForExport(mathElement: HTMLElement) {
    const katexElement = mathElement.querySelector(".katex-display");
    // katexElement 不存在或不是 HTMLElement 时无法测量尺寸
    if (!isHTMLElement(katexElement)) {
        return;
    }
    // 内容滚动宽度未超过可见宽度时无需缩放
    if (katexElement.clientWidth >= katexElement.scrollWidth) {
        return;
    }
    const firstChild = katexElement.firstElementChild;
    // firstChild 必须是 HTMLElement 才能设置 style 属性
    if (isHTMLElement(firstChild)) {
        firstChild.setAttribute("style",
            `font-size:${katexElement.clientWidth * 100 / katexElement.scrollWidth}%`);
    }
}

/**
 * 缩放行内公式以适应 PDF 导出宽度
 *
 * 作用：检测行内公式是否超出块元素宽度，超出时按比例缩小字体
 * 意图：PDF 导出不支持横向滚动，必须通过缩放确保公式完整可见
 * 调用时机：renderSingleMathElement 中 maxWidth=true 且为行内公式时调用
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export function scaleInlineMathForExport(mathElement: HTMLElement) {
    const blockElement = hasClosestBlock(mathElement);
    // 行内公式宽度未超过块元素宽度时无需缩放
    if (!blockElement || mathElement.offsetWidth <= blockElement.clientWidth) {
        return;
    }
    const firstChild = mathElement.firstElementChild;
    // firstChild 必须是 HTMLElement 才能设置 style 属性
    if (isHTMLElement(firstChild)) {
        firstChild.setAttribute("style",
            `font-size:${blockElement.clientWidth * 100 / mathElement.offsetWidth}%`);
    }
}
