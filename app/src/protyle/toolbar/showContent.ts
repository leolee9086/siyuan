/**
 * 移动端内容操作面板
 */
import { setPosition } from "../../util/setPosition";
import { Constants } from "../../constants";
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

/**
 * 生成内容操作按钮 HTML
 */
function 生成操作按钮HTML(hasCopy: boolean, disabled: boolean): string {
    let html = "";
    if (hasCopy) {
        html += '<button class="keyboard__action" data-action="copy"><svg><use xlink:href="#iconCopy"></use></svg></button>';
        if (!disabled) {
            html += `<button class="keyboard__action" data-action="cut"><svg><use xlink:href="#iconCut"></use></svg></button>
<button class="keyboard__action" data-action="delete"><svg><use xlink:href="#iconTrashcan"></use></svg></button>`;
        }
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
    const hasCopy = range.toString() !== "" || (range.cloneContents().childNodes[0] as HTMLElement)?.classList?.contains("emoji");
    const buttonHTML = 生成操作按钮HTML(hasCopy, protyle.disabled);

    subElement.innerHTML = `<div class="fn__flex">${buttonHTML}</div>`;

    const rangePosition = getSelectionPosition(nodeElement, range);

    subElement.lastElementChild?.addEventListener("click", async (event) => {
        const btnElement = hasClosestByClassName(event.target as HTMLElement, "keyboard__action");
        if (!btnElement) {
            return;
        }
        const action = btnElement.getAttribute("data-action");
        if (action === "copy") {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("copy");
            subElement.classList.add("fn__none");
        } else if (action === "cut") {
            focusByRange(getEditorRange(nodeElement));
            document.execCommand("cut");
            subElement.classList.add("fn__none");
        } else if (action === "delete") {
            const currentRange = getEditorRange(nodeElement);
            currentRange.insertNode(document.createElement("wbr"));
            const oldHTML = nodeElement.outerHTML;
            currentRange.extractContents();
            focusByWbr(nodeElement, currentRange);
            focusByRange(currentRange);
            updateTransaction(protyle, nodeElement.getAttribute("data-node-id") ?? "", nodeElement.outerHTML, oldHTML);
            subElement.classList.add("fn__none");
        } else if (action === "paste") {
            focusByRange(getEditorRange(nodeElement));
            if (document.queryCommandSupported("paste")) {
                document.execCommand("paste");
            } else {
                try {
                    const text = await readClipboard();
                    paste(protyle, Object.assign(text, { target: nodeElement as HTMLElement }));
                } catch (e) {
                    console.log(e);
                }
            }
            subElement.classList.add("fn__none");
        } else if (action === "select") {
            selectAll(protyle, nodeElement, range);
            subElement.classList.add("fn__none");
        } else if (action === "copyPlainText") {
            focusByRange(getEditorRange(nodeElement));
            const selection = getSelection();
            if (selection && selection.rangeCount > 0) {
                copyPlainText(selection.getRangeAt(0).toString());
            }
            subElement.classList.add("fn__none");
        } else if (action === "pasteAsPlainText") {
            focusByRange(getEditorRange(nodeElement));
            pasteAsPlainText(protyle);
            subElement.classList.add("fn__none");
        } else if (action === "pasteEscaped") {
            focusByRange(getEditorRange(nodeElement));
            pasteEscaped(protyle, nodeElement);
            subElement.classList.add("fn__none");
        } else if (action === "back") {
            if (subElement.lastElementChild) {
                subElement.lastElementChild.innerHTML = buttonHTML;
            }
        } else if (action === "more") {
            if (subElement.lastElementChild) {
                subElement.lastElementChild.innerHTML = 生成更多菜单HTML(hasCopy, protyle.disabled);
            }
            setPosition(subElement, rangePosition.left, rangePosition.top + 28, Constants.SIZE_TOOLBAR_HEIGHT);
        }
    });
    subElement.style.zIndex = (++window.siyuan.zIndex).toString();
    subElement.classList.remove("fn__none");
    toolbarElement.classList.add("fn__none");
    setPosition(subElement, rangePosition.left, rangePosition.top - 48, Constants.SIZE_TOOLBAR_HEIGHT);
}
