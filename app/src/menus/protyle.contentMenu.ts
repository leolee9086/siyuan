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
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { get } from "http";
import { getSelection } from "../util/DOM/range";


export const contentMenu = (protyle: IProtyle, nodeElement: Element) => {
    const range = getEditorRange(nodeElement);
    getSiyuanGlobalMenus().menu.remove();
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_INLINE_CONTEXT);
    /// #if MOBILE
    getProtyleToolbar(protyle).showContent(protyle, range, nodeElement);
    /// #else
    const oldHTML = nodeElement.outerHTML;
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        throw new Error("块元素缺少id");
    }
    if (range.toString() !== "" || (range.cloneContents().childNodes[0] as HTMLElement)?.classList?.contains("emoji")) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "copy",
            icon: "iconCopy",
            accelerator: "⌘C",
            label: siyuanI18n.copy,
            click() {
                // range 需要重新计算 https://ld246.com/article/1644979219025
                focusByRange(getEditorRange(nodeElement));
                document.execCommand("copy");
            }
        }).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "copyPlainText",
            label: siyuanI18n.copyPlainText,
            accelerator: getSiyuanConfig().keymap.editor.general.copyPlainText.custom,
            click() {
                focusByRange(getEditorRange(nodeElement));
                copyPlainText(getSelection().getRangeAt(0).toString());
            }
        }).element);
        if (protyle.disabled) {
            return;
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "cut",
            icon: "iconCut",
            accelerator: "⌘X",
            label: siyuanI18n.cut,
            click() {
                focusByRange(getEditorRange(nodeElement));
                document.execCommand("cut");
            }
        }).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "delete",
            icon: "iconTrashcan",
            accelerator: "⌫",
            label: siyuanI18n.delete,
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
            const inlineTypes = getProtyleToolbar(protyle).getCurrentType(range);
            if (inlineTypes.includes("code") || inlineTypes.includes("kbd")) {
                getSiyuanGlobalMenus().menu.append(new MenuItem({
                    id: "copy",
                    label: siyuanI18n.copy,
                    icon: "iconCopy",
                    click() {
                        writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));
                    }
                }).element);
                getSiyuanGlobalMenus().menu.append(new MenuItem({
                    id: "copyPlainText",
                    label: siyuanI18n.copyPlainText,
                    click() {
                        copyPlainText(inlineElement.textContent);
                    }
                }).element);
                if (!protyle.disabled) {
                    const id = nodeElement.getAttribute("data-node-id");
                    if (!id) {
                        throw new Error("块元素缺少id");
                    }
                    getSiyuanGlobalMenus().menu.append(new MenuItem({
                        id: "cut",
                        icon: "iconCut",
                        label: siyuanI18n.cut,
                        click() {
                            writeText(getProtyleLute(protyle).BlockDOM2StdMd(inlineElement.outerHTML));

                            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
                            inlineElement.remove();
                            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                            focusByWbr(nodeElement, getProtyleToolbar(protyle).range);
                        }
                    }).element);
                    getSiyuanGlobalMenus().menu.append(new MenuItem({
                        id: "remove",
                        icon: "iconTrashcan",
                        label: siyuanI18n.remove,
                        click() {
                            inlineElement.insertAdjacentHTML("afterend", "<wbr>");
                            inlineElement.remove();
                            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                            focusByWbr(nodeElement, getProtyleToolbar(protyle).range);
                        }
                    }).element);
                }
                getSiyuanGlobalMenus().menu.append(new MenuItem({
                    type: "separator",
                }).element);
            }
        }
    }
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "paste",
            label: siyuanI18n.paste,
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
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "pasteAsPlainText",
            label: siyuanI18n.pasteAsPlainText,
            accelerator: "⇧⌘V",
            click() {
                focusByRange(getEditorRange(nodeElement));
                pasteAsPlainText(protyle);
            }
        }).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "pasteEscaped",
            label: siyuanI18n.pasteEscaped,
            click() {
                focusByRange(getEditorRange(nodeElement));
                pasteEscaped(protyle, nodeElement);
            }
        }).element);
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "selectAll",
        label: siyuanI18n.selectAll,
        icon: "iconSelect",
        accelerator: "⌘A",
        click() {
            selectAll(protyle, nodeElement, range);
        }
    }).element);
    if (nodeElement.classList.contains("table") && !protyle.disabled) {
        addTableMenus({ protyle, range, element: nodeElement });
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


const addTableMenus = (detail: {
    protyle: IProtyle,
    range: Range,
    element: Element
}) => {
    const { protyle, range, element: nodeElement } = detail;
    const cellElement = hasClosestByTag(range.startContainer, "TD") || hasClosestByTag(range.startContainer, "TH");
    if (cellElement) {
        const tableMenus = tableMenu(protyle, nodeElement, cellElement as HTMLTableCellElement, range);
        if (tableMenus.insertMenus.length > 0) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "separator_1",
                type: "separator",
            }).element);
            tableMenus.insertMenus.forEach((menuItem) => {
                getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
            });
        }
        if (tableMenus.removeMenus.length > 0) {
            getSiyuanGlobalMenus().menu.append(new MenuItem({
                id: "separator_2",
                type: "separator",
            }).element);
            tableMenus.removeMenus.forEach((menuItem) => {
                getSiyuanGlobalMenus().menu.append(new MenuItem(menuItem).element);
            });
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "separator_3",
            type: "separator",
        }).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "more",
            type: "submenu",
            icon: "iconMore",
            label: siyuanI18n.more,
            submenu: tableMenus.otherMenus.concat(tableMenus.other2Menus)
        }).element);
    }
};