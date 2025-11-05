import * as dayjs from "dayjs";
import { fetchPost, focusByRange, blockRender } from "../ai/imports";
import { Constants } from "../constants";
import { openFileById } from "../editor/util";
import { openBacklink, openGraph } from "../layout/dock/util";
import { emitOpenMenu } from "../plugin/EventBus";
import { removeInlineType } from "../protyle/toolbar/util";
import { hideElements } from "../protyle/ui/hideElements";
import { electronUndo } from "../protyle/undo";
import { updateHotkeyTip, writeText } from "../protyle/util/compatibility";
import { hasClosestBlock, hasTopClosestByClassName } from "../protyle/util/hasClosest";
import { focusByWbr } from "../protyle/util/selection";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { checkFold } from "../util/noRelyPCFunction";
import { openNewWindowById } from "../window/openNewWindow";
import { MenuItem } from "./Menu.Item";


export const refMenu = (protyle: IProtyle, element: HTMLElement) => {
    const nodeElement = hasClosestBlock(element);
    if (!nodeElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);
    const refBlockId = element.getAttribute("data-id");
    const id = nodeElement.getAttribute("data-node-id");
    let oldHTML = nodeElement.outerHTML;
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_INLINE_REF);
    if (!protyle.disabled) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "anchor",
            iconHTML: "",
            type: "readonly",
            label: `<input style="margin: 4px 0" class="b3-text-field fn__block" placeholder="${window.siyuan.languages.anchor}">`,
            bind(menuItemElement) {
                const inputElement = menuItemElement.querySelector("input");
                inputElement.value = element.getAttribute("data-subtype") === "d" ? "" : element.textContent;
                inputElement.addEventListener("input", () => {
                    if (inputElement.value) {
                        // 不能使用 textContent，否则 < 会变为 &lt;
                        element.innerHTML = Lute.EscapeHTMLStr(inputElement.value).trim() || refBlockId;
                    } else {
                        fetchPost("/api/block/getRefText", { id: refBlockId }, (response) => {
                            element.innerHTML = response.data;
                        });
                    }
                    element.setAttribute("data-subtype", inputElement.value ? "s" : "d");
                });
                inputElement.addEventListener("keydown", (event) => {
                    if (event.isComposing) {
                        return;
                    }
                    if (event.key === "Enter" && !event.isComposing) {
                        window.siyuan.menus.menu.remove();
                    } else if (electronUndo(event)) {
                        return;
                    }
                });
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "separator_1",
            type: "separator"
        }).element);
    }
    /// #if !MOBILE
    window.siyuan.menus.menu.append(new MenuItem({
        id: "openBy",
        label: window.siyuan.languages.openBy,
        icon: "iconOpen",
        accelerator: window.siyuan.config.keymap.editor.general.openBy.custom + "/" + window.siyuan.languages.click,
        click() {
            checkFold(refBlockId, (zoomIn, action, isRoot) => {
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                openFileById({
                    app: protyle.app,
                    id: refBlockId,
                    action,
                    zoomIn
                });
            });
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "refTab",
        label: window.siyuan.languages.refTab,
        icon: "iconEyeoff",
        accelerator: window.siyuan.config.keymap.editor.general.refTab.custom + "/" + updateHotkeyTip("⌘" + window.siyuan.languages.click),
        click() {
            checkFold(refBlockId, (zoomIn) => {
                openFileById({
                    app: protyle.app,
                    id: refBlockId,
                    action: zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL] : [Constants.CB_GET_HL, Constants.CB_GET_CONTEXT, Constants.CB_GET_ROOTSCROLL],
                    keepCursor: true,
                    zoomIn
                });
            });
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "insertRight",
        label: window.siyuan.languages.insertRight,
        icon: "iconLayoutRight",
        accelerator: window.siyuan.config.keymap.editor.general.insertRight.custom + "/" + updateHotkeyTip("⌥" + window.siyuan.languages.click),
        click() {
            checkFold(refBlockId, (zoomIn, action, isRoot) => {
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                openFileById({
                    app: protyle.app,
                    id: refBlockId,
                    position: "right",
                    action,
                    zoomIn
                });
            });
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "insertBottom",
        label: window.siyuan.languages.insertBottom,
        icon: "iconLayoutBottom",
        accelerator: window.siyuan.config.keymap.editor.general.insertBottom.custom + (window.siyuan.config.keymap.editor.general.insertBottom.custom ? "/" : "") + updateHotkeyTip("⇧" + window.siyuan.languages.click),
        click() {
            checkFold(refBlockId, (zoomIn, action, isRoot) => {
                if (!isRoot) {
                    action.push(Constants.CB_GET_HL);
                }
                openFileById({
                    app: protyle.app,
                    id: refBlockId,
                    position: "bottom",
                    action,
                    zoomIn
                });
            });
        }
    }).element);
    /// #if !BROWSER
    window.siyuan.menus.menu.append(new MenuItem({
        id: "openByNewWindow",
        label: window.siyuan.languages.openByNewWindow,
        icon: "iconOpenWindow",
        click() {
            openNewWindowById(refBlockId);
        }
    }).element);
    /// #endif
    window.siyuan.menus.menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "backlinks",
        icon: "iconLink",
        label: window.siyuan.languages.backlinks,
        accelerator: window.siyuan.config.keymap.editor.general.backlinks.custom,
        click: () => {
            openBacklink({
                app: protyle.app,
                blockId: refBlockId,
            });
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        id: "graphView",
        icon: "iconGraph",
        label: window.siyuan.languages.graphView,
        accelerator: window.siyuan.config.keymap.editor.general.graphView.custom,
        click: () => {
            openGraph({
                app: protyle.app,
                blockId: refBlockId,
            });
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);
    /// #endif
    if (!protyle.disabled) {
        let submenu: IMenu[] = [];
        if (element.getAttribute("data-subtype") === "s") {
            submenu.push({
                id: "turnToDynamic",
                iconHTML: "",
                label: window.siyuan.languages.turnToDynamic,
                click() {
                    element.setAttribute("data-subtype", "d");
                    fetchPost("/api/block/getRefText", { id: refBlockId }, (response) => {
                        element.innerHTML = response.data;
                        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                        oldHTML = nodeElement.outerHTML;
                    });
                    focusByRange(protyle.toolbar.range);
                }
            });
        } else {
            submenu.push({
                id: "turnToStatic",
                iconHTML: "",
                label: window.siyuan.languages.turnToStatic,
                click() {
                    element.setAttribute("data-subtype", "s");
                    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                    updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                    focusByRange(protyle.toolbar.range);
                    oldHTML = nodeElement.outerHTML;
                }
            });
        }
        submenu = submenu.concat([{
            id: "text",
            iconHTML: "",
            label: window.siyuan.languages.text,
            click() {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                removeInlineType(element, "block-ref", protyle.toolbar.range);
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "*",
            iconHTML: "",
            label: "*",
            click() {
                element.setAttribute("data-subtype", "s");
                element.textContent = "*";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByRange(protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "text*",
            iconHTML: "",
            label: window.siyuan.languages.text + " *",
            click() {
                element.insertAdjacentHTML("beforebegin", element.innerHTML + " ");
                element.setAttribute("data-subtype", "s");
                element.textContent = "*";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByRange(protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "link",
            label: window.siyuan.languages.link,
            iconHTML: "",
            click() {
                element.outerHTML = `<span data-type="a" data-href="siyuan://blocks/${element.getAttribute("data-id")}">${element.innerHTML}</span><wbr>`;
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByWbr(nodeElement, protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }]);
        if (element.parentElement.textContent.trim() === element.textContent.trim() && element.parentElement.tagName === "DIV") {
            submenu.push({
                id: "blockEmbed",
                iconHTML: "",
                label: window.siyuan.languages.blockEmbed,
                click() {
                    const html = `<div data-content="select * from blocks where id='${refBlockId}'" data-node-id="${id}" data-type="NodeBlockQueryEmbed" class="render-node" updated="${dayjs().format("YYYYMMDDHHmmss")}">${nodeElement.querySelector(".protyle-attr").outerHTML}</div>`;
                    nodeElement.outerHTML = html;
                    updateTransaction(protyle, id, html, oldHTML);
                    blockRender(protyle, protyle.wysiwyg.element);
                    oldHTML = nodeElement.outerHTML;
                }
            });
        }
        submenu.push({
            id: "defBlock",
            iconHTML: "",
            label: window.siyuan.languages.defBlock,
            click() {
                fetchPost("/api/block/swapBlockRef", {
                    refID: id,
                    defID: refBlockId,
                    includeChildren: false
                });
            }
        });
        submenu.push({
            id: "defBlockChildren",
            iconHTML: "",
            label: window.siyuan.languages.defBlockChildren,
            click() {
                fetchPost("/api/block/swapBlockRef", {
                    refID: id,
                    defID: refBlockId,
                    includeChildren: true
                });
            }
        });
        window.siyuan.menus.menu.append(new MenuItem({
            id: "turnInto",
            label: window.siyuan.languages.turnInto,
            icon: "iconRefresh",
            submenu
        }).element);
    }
    window.siyuan.menus.menu.append(new MenuItem({
        id: "copy",
        label: window.siyuan.languages.copy,
        icon: "iconCopy",
        click() {
            writeText(protyle.lute.BlockDOM2StdMd(element.outerHTML).trim());
        }
    }).element);
    if (!protyle.disabled) {
        window.siyuan.menus.menu.append(new MenuItem({
            id: "cut",
            label: window.siyuan.languages.cut,
            icon: "iconCut",
            click() {
                writeText(protyle.lute.BlockDOM2StdMd(element.outerHTML));

                element.insertAdjacentHTML("afterend", "<wbr>");
                element.remove();
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByWbr(nodeElement, protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }).element);
        window.siyuan.menus.menu.append(new MenuItem({
            id: "remove",
            label: window.siyuan.languages.remove,
            icon: "iconTrashcan",
            click() {
                element.insertAdjacentHTML("afterend", "<wbr>");
                element.remove();
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByWbr(nodeElement, protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }).element);
    }
    if (protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-blockref",
            detail: {
                protyle,
                element: element,
            },
            separatorPosition: "top",
        });
    }

    /// #if MOBILE
    window.siyuan.menus.menu.fullscreen();
    /// #else
    const rect = element.getBoundingClientRect();
    window.siyuan.menus.menu.popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
    /// #endif
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    window.siyuan.menus.menu.data = element;
    window.siyuan.menus.menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    if (!protyle.disabled) {
        window.siyuan.menus.menu.element.querySelector("input").select();
        window.siyuan.menus.menu.removeCB = () => {
            if (nodeElement.outerHTML !== oldHTML) {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            }
            const currentRange = getSelection().rangeCount === 0 ? undefined : getSelection().getRangeAt(0);
            if (currentRange && !protyle.element.contains(currentRange.startContainer)) {
                protyle.toolbar.range.selectNodeContents(element);
                protyle.toolbar.range.collapse(false);
                focusByRange(protyle.toolbar.range);
            }
        };
    }
};
