import * as dayjs from "dayjs";
import { focusByRange } from "../ai/imports";
import { Constants } from "../constants";
import { emitOpenMenu } from "../plugin/EventBus";
import { copyPlainText, writeText, readClipboard } from "../protyle/util/compatibility";
import { hasClosestByTag } from "../protyle/util/hasClosest";
import { paste, pasteAsPlainText, pasteEscaped } from "../protyle/util/paste";
import { getEditorRange, focusByWbr, selectAll } from "../protyle/util/selection";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { MenuItem } from "./Menu.Item";
import { tableMenu } from "./protyle";


export const contentMenu = (protyle: IProtyle, nodeElement: Element) => {
    const range = getEditorRange(nodeElement);
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_INLINE_CONTEXT);
    /// #if MOBILE
    protyle.toolbar.showContent(protyle, range, nodeElement);
    /// #else
    const oldHTML = nodeElement.outerHTML;
    const id = nodeElement.getAttribute("data-node-id");
    if (range.toString() !== "" || (range.cloneContents().childNodes[0] as HTMLElement)?.classList?.contains("emoji")) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "copy",
            icon: "iconCopy",
            accelerator: "⌘C",
            label: window.siyuan.languages.copy,
            click() {
                // range 需要重新计算 https://ld246.com/article/1644979219025
                focusByRange(getEditorRange(nodeElement));
                document.execCommand("copy");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "copyPlainText",
            label: window.siyuan.languages.copyPlainText,
            accelerator: window.siyuan.config.keymap.editor.general.copyPlainText.custom,
            click() {
                focusByRange(getEditorRange(nodeElement));
                copyPlainText(getSelection().getRangeAt(0).toString());
            }
        }).element);
        if (protyle.disabled) {
            return;
        }
        window.siyuan.menus.menu.append(new MenuItem({
            id: "cut",
            icon: "iconCut",
            accelerator: "⌘X",
            label: window.siyuan.languages.cut,
            click() {
                focusByRange(getEditorRange(nodeElement));
                document.execCommand("cut");
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "delete",
            icon: "iconTrashcan",
            accelerator: "⌫",
            label: window.siyuan.languages.delete,
            click() {
                const currentRange = getEditorRange(nodeElement);
                currentRange.insertNode(document.createElement("wbr"));
                currentRange.extractContents();
                focusByWbr(nodeElement, currentRange);
                focusByRange(currentRange);
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            }
        }).element);
    } else {
        // https://github.com/siyuan-note/siyuan/issues/9630
        const inlineElement = hasClosestByTag(range.startContainer, "SPAN");
        if (inlineElement) {
            const inlineTypes = protyle.toolbar.getCurrentType(range);
            if (inlineTypes.includes("code") || inlineTypes.includes("kbd")) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "copy",
                    label: window.siyuan.languages.copy,
                    icon: "iconCopy",
                    click() {
                        writeText(protyle.lute.BlockDOM2StdMd(inlineElement.outerHTML));
                    }
                }).element);
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "copyPlainText",
                    label: window.siyuan.languages.copyPlainText,
                    click() {
                        copyPlainText(inlineElement.textContent);
                    }
                }).element);
                if (!protyle.disabled) {
                    const id = nodeElement.getAttribute("data-node-id");
                    window.siyuan.menus.menu.append(new MenuItem({
                        id: "cut",
                        icon: "iconCut",
                        label: window.siyuan.languages.cut,
                        click() {
                            writeText(protyle.lute.BlockDOM2StdMd(inlineElement.outerHTML));

                            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
                            inlineElement.remove();
                            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                            focusByWbr(nodeElement, protyle.toolbar.range);
                        }
                    }).element);
                    window.siyuan.menus.menu.append(new MenuItem({
                        id: "remove",
                        icon: "iconTrashcan",
                        label: window.siyuan.languages.remove,
                        click() {
                            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
                            inlineElement.remove();
                            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                            focusByWbr(nodeElement, protyle.toolbar.range);
                        }
                    }).element);
                }
                window.siyuan.menus.menu.append(new MenuItem({
                    type: "separator",
                }).element);
            }
        }
    }
    if (!protyle.disabled) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "paste",
            label: window.siyuan.languages.paste,
            icon: "iconPaste",
            accelerator: "⌘V",
            async click() {
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
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "pasteAsPlainText",
            label: window.siyuan.languages.pasteAsPlainText,
            accelerator: "⇧⌘V",
            click() {
                focusByRange(getEditorRange(nodeElement));
                pasteAsPlainText(protyle);
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "pasteEscaped",
            label: window.siyuan.languages.pasteEscaped,
            click() {
                focusByRange(getEditorRange(nodeElement));
                pasteEscaped(protyle, nodeElement);
            }
        }).element);
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "selectAll",
        label: window.siyuan.languages.selectAll,
        icon: "iconSelect",
        accelerator: "⌘A",
        click() {
            selectAll(protyle, nodeElement, range);
        }
    }).element);
    if (nodeElement.classList.contains("table") && !protyle.disabled) {
        const cellElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
        if (cellElement) {
            const tableMenus = tableMenu(protyle, nodeElement, cellElement as HTMLTableCellElement, range);
            if (tableMenus.insertMenus.length > 0) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "separator_1",
                    type: "separator",
                }).element);
                tableMenus.insertMenus.forEach((menuItem) => {
                    window.siyuan.menus.menu.append(new MenuItem(menuItem).element);
                });
            }
            if (tableMenus.removeMenus.length > 0) {
                window.siyuan.menus.menu.append(new MenuItem({
                    id: "separator_2",
                    type: "separator",
                }).element);
                tableMenus.removeMenus.forEach((menuItem) => {
                    window.siyuan.menus.menu.append(new MenuItem(menuItem).element);
                });
            }
            window.siyuan.menus.menu.append(new MenuItem({
                id: "separator_3",
                type: "separator",
            }).element);
            window.siyuan.menus.menu.append(new MenuItem({
                id: "more",
                type: "submenu",
                icon: "iconMore",
                label: window.siyuan.languages.more,
                submenu: tableMenus.otherMenus.concat(tableMenus.other2Menus)
            }).element);
        }
    }
    /// #endif
    if (protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-content",
            detail: {
                protyle,
                range,
                element: nodeElement,
            },
            separatorPosition: "top",
        });
    }
};
