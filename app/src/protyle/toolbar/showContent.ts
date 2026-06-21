/**
 * 移动端内容操作面板
 */
import { setPosition } from "../../util/DOM/setPosition";
import {
    focusByRange,
    focusByWbr,
    getEditorRange,
    getSelectionPosition,
    selectAll
} from "../util/selection";
import { hasClosestByClassName } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import { updateTransaction } from "../wysiwyg/transaction";
import { copyPlainText, readClipboard } from "../util/compatibility";
import { paste, pasteAsPlainText, pasteEscaped } from "../util/paste";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { incrementSiyuanZIndex } from "../../util/siyuanEnvironments/siyuanDialogs.environment";
import type { 操作上下文 } from "./showContent.types";

const LINE_HEIGHT = 32;

/**
 * 生成内容操作按钮 HTML
 */
function 生成操作按钮HTML(hasCopy: boolean, disabled: boolean): string {
    let html = "";
    if (hasCopy) {
        html += '<button class="keyboard__action" data-action="copy"><svg><use xlink:href="#iconCopy"></use></svg></button>';
    }
    if (hasCopy && !disabled) {
        html += `<button class="keyboard__action" data-action="cut"><svg><use xlink:href="#iconCut"></use></svg></button>
<button class="keyboard__action" data-action="delete"><svg><use xlink:href="#iconTrashcan"></use></svg></button>`;
    }
    if (!disabled) {
        html += `<button class="keyboard__action" data-action="paste"><svg><use xlink:href="#iconPaste"></use></svg></button>
<button class="keyboard__action" data-action="select"><svg><use xlink:href="#iconSelect"></use></svg></button>`;
    }
    if (hasCopy || !disabled) {
        html += '<button class="keyboard__action" data-action="more"><svg><use xlink:href="#iconMore"></use></svg></button>';
    }
    return html;
}

/**
 * 生成更多菜单 HTML
 */
function 生成更多菜单HTML(hasCopy: boolean, disabled: boolean): string {
    return `<button class="keyboard__action${hasCopy ? "" : " fn__none"}" data-action="copyPlainText"><span>${siyuanI18n.copyPlainText}</span></button>
<div class="keyboard__split${hasCopy ? "" : " fn__none"}"></div>
<button class="keyboard__action${disabled ? " fn__none" : ""}" data-action="pasteAsPlainText"><span>${siyuanI18n.pasteAsPlainText}</span></button>
<div class="keyboard__split${disabled ? " fn__none" : ""}"></div>
<button class="keyboard__action${disabled ? " fn__none" : ""}" data-action="pasteEscaped"><span>${siyuanI18n.pasteEscaped}</span></button>
<div class="keyboard__split${disabled ? " fn__none" : ""}"></div>
<button class="keyboard__action" data-action="back"><svg><use xlink:href="#iconBack"></use></svg></button>`;
}

/** 处理复制操作 */
function 处理复制(ctx: 操作上下文): void {
    focusByRange(getEditorRange(ctx.nodeElement));
    document.execCommand("copy");
    ctx.subElement.classList.add("fn__none");
}

/** 处理剪切操作 */
function 处理剪切(ctx: 操作上下文): void {
    focusByRange(getEditorRange(ctx.nodeElement));
    document.execCommand("cut");
    ctx.subElement.classList.add("fn__none");
}

/** 处理删除操作 */
function 处理删除(ctx: 操作上下文): void {
    const currentRange = getEditorRange(ctx.nodeElement);
    currentRange.insertNode(document.createElement("wbr"));
    const oldHTML = ctx.nodeElement.outerHTML;
    currentRange.extractContents();
    focusByWbr(ctx.nodeElement, currentRange);
    focusByRange(currentRange);
    updateTransaction(ctx.protyle, ctx.nodeElement, oldHTML);
    ctx.subElement.classList.add("fn__none");
}

/** 处理粘贴操作 */
async function 处理粘贴(ctx: 操作上下文): Promise<void> {
    focusByRange(getEditorRange(ctx.nodeElement));
    // 卫语句：支持原生粘贴命令时直接执行并返回
    if (document.queryCommandSupported("paste")) {
        document.execCommand("paste");
        ctx.subElement.classList.add("fn__none");
        return;
    }
    // 后备方案：使用 readClipboard API
    try {
        const text = await readClipboard();
        const nodeElementAsHTMLElement = ctx.nodeElement instanceof HTMLElement ? ctx.nodeElement : null;
        if (nodeElementAsHTMLElement) {
            paste(ctx.protyle, Object.assign(text, { target: nodeElementAsHTMLElement }));
        }
    } catch (e) {
        console.log(e);
    }
    ctx.subElement.classList.add("fn__none");
}

/** 处理全选操作 */
function 处理全选(ctx: 操作上下文): void {
    selectAll(ctx.protyle, ctx.nodeElement, ctx.range);
    ctx.subElement.classList.add("fn__none");
}

/** 处理复制纯文本操作 */
function 处理复制纯文本(ctx: 操作上下文): void {
    focusByRange(getEditorRange(ctx.nodeElement));
    const selection = getSelection();
    if (selection && selection.rangeCount > 0) {
        copyPlainText(selection.getRangeAt(0).toString());
    }
    ctx.subElement.classList.add("fn__none");
}

/** 处理粘贴为纯文本操作 */
function 处理粘贴为纯文本(ctx: 操作上下文): void {
    focusByRange(getEditorRange(ctx.nodeElement));
    pasteAsPlainText(ctx.protyle);
    ctx.subElement.classList.add("fn__none");
}

/** 处理转义粘贴操作 */
function 处理转义粘贴(ctx: 操作上下文): void {
    focusByRange(getEditorRange(ctx.nodeElement));
    pasteEscaped(ctx.protyle, ctx.nodeElement);
    ctx.subElement.classList.add("fn__none");
}

/** 处理返回操作 */
function 处理返回(ctx: 操作上下文): void {
    if (ctx.subElement.lastElementChild) {
        ctx.subElement.lastElementChild.innerHTML = ctx.buttonHTML;
    }
}

/** 处理更多菜单操作 */
function 处理更多菜单(ctx: 操作上下文): void {
    if (ctx.subElement.lastElementChild) {
        ctx.subElement.lastElementChild.innerHTML = 生成更多菜单HTML(ctx.hasCopy, ctx.protyle.disabled);
    }
    setPosition(ctx.subElement, ctx.rangePosition.left, ctx.rangePosition.top + 28, LINE_HEIGHT);
}

/** 操作处理器映射表 */
const 操作处理器: Record<string, (ctx: 操作上下文) => void | Promise<void>> = {
    copy: 处理复制,
    cut: 处理剪切,
    delete: 处理删除,
    paste: 处理粘贴,
    select: 处理全选,
    copyPlainText: 处理复制纯文本,
    pasteAsPlainText: 处理粘贴为纯文本,
    pasteEscaped: 处理转义粘贴,
    back: 处理返回,
    more: 处理更多菜单,
};

/** 处理各种操作（分发器） */
async function 处理操作(action: string | null, ctx: 操作上下文): Promise<void> {
    if (!action) {
        return;
    }
    const 处理器 = 操作处理器[action];
    if (处理器) {
        await 处理器(ctx);
    }
}

/**
 * 显示内容操作面板
 */
export function 显示内容操作(
    protyle: IProtyle,
    range: Range,
    nodeElement: Element,
    subElement: HTMLElement,
    toolbarElement: HTMLElement,
    setRange: (range: Range) => void
): void {
    setRange(range);
    hideElements(["hint"], protyle);

    subElement.style.width = "auto";
    subElement.style.padding = "0 8px";
    const firstChildNode = range.cloneContents().childNodes[0];
    const hasCopy = range.toString() !== "" || (firstChildNode instanceof HTMLElement && firstChildNode.classList?.contains("emoji"));
    const buttonHTML = 生成操作按钮HTML(hasCopy, protyle.disabled);

    subElement.innerHTML = `<div class="fn__flex">${buttonHTML}</div>`;

    const rangePosition = getSelectionPosition(nodeElement, range);

    // @内联回调
    subElement.lastElementChild?.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const btnElement = hasClosestByClassName(target, "keyboard__action");
        if (!btnElement) {
            return;
        }
        const action = btnElement.getAttribute("data-action");
        const ctx: 操作上下文 = { protyle, nodeElement, subElement, buttonHTML, hasCopy, rangePosition, range };
        await 处理操作(action, ctx);
    });
    subElement.style.zIndex = incrementSiyuanZIndex().toString();
    subElement.classList.remove("fn__none");
    toolbarElement.classList.add("fn__none");
    setPosition(subElement, rangePosition.left, rangePosition.top - 48, LINE_HEIGHT);
}

