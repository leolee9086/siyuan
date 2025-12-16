import * as dayjs from "dayjs";
import { fetchPost, focusByRange, blockRender } from "../ai/imports";
import { Constants } from "../constants";
import { openFileById } from "../editor/utils.openFileById";
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
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig";
const createAnchorEditorItem = (refElement: HTMLSpanElement) => {
    return new MenuItem({
        id: "anchor",
        iconHTML: "",
        type: "readonly",
        label: `<input style="margin: 4px 0" class="b3-text-field fn__block" placeholder="${siyuanI18n.anchor}">`,
        bind(menuItemElement) {
            const refBlockId = refElement.getAttribute("data-id");
            if (!refBlockId) {
                throw new Error("引用目标id缺失");
            }
            const inputElement = menuItemElement.querySelector("input");
            if (inputElement) {
                inputElement.value = refElement.getAttribute("data-subtype") === "d" ? "" : refElement.textContent;
                inputElement.addEventListener("input", () => {
                    if (inputElement.value) {
                        // 不能使用 textContent，否则 < 会变为 &lt;
                        refElement.innerHTML = Lute.EscapeHTMLStr(inputElement.value).trim() || refBlockId;
                    } else {
                        fetchPost("/api/block/getRefText", { id: refBlockId }, (response) => {
                            refElement.innerHTML = response.data;
                        });
                    }
                    refElement.setAttribute("data-subtype", inputElement.value ? "s" : "d");
                });
                inputElement.addEventListener("keydown", (event) => {
                    if (event.isComposing) {
                        return;
                    }
                    if (event.key === "Enter" && !event.isComposing) {
                        getSiyuanGlobalMenus().menu.remove();
                    } else if (electronUndo(event)) {
                        return;
                    }
                });
            }
        }
    });
};
export const refMenu = (protyle: IProtyle, refElement: HTMLElement) => {
    const nodeElement = hasClosestBlock(refElement);
    if (!nodeElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);
    const refBlockId = refElement.getAttribute("data-id");
    const id = nodeElement.getAttribute("data-node-id");
    if (!refBlockId) {
        throw new Error("引用目标id缺失");
    }
    let oldHTML = nodeElement.outerHTML;
    getSiyuanGlobalMenus().menu.remove();
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_INLINE_REF);
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(createAnchorEditorItem(refElement).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({id: "separator_1",type: "separator"}).element);
    }
    /// #if !MOBILE
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "openBy",
        label: siyuanI18n.openBy,
        icon: "iconOpen",
        accelerator: getSiyuanConfig().keymap.editor.general.openBy.custom + "/" + siyuanI18n.click,
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
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "refTab",
        label: siyuanI18n.refTab,
        icon: "iconEyeoff",
        accelerator: getSiyuanConfig().keymap.editor.general.refTab.custom + "/" + updateHotkeyTip("⌘" + siyuanI18n.click),
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
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "insertRight",
        label: siyuanI18n.insertRight,
        icon: "iconLayoutRight",
        accelerator: getSiyuanConfig().keymap.editor.general.insertRight.custom + "/" + updateHotkeyTip("⌥" + siyuanI18n.click),
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
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "insertBottom",
        label: siyuanI18n.insertBottom,
        icon: "iconLayoutBottom",
        accelerator: getSiyuanConfig().keymap.editor.general.insertBottom.custom + (getSiyuanConfig().keymap.editor.general.insertBottom.custom ? "/" : "") + updateHotkeyTip("⇧" + siyuanI18n.click),
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
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "openByNewWindow",
        label: siyuanI18n.openByNewWindow,
        icon: "iconOpenWindow",
        click() {
            openNewWindowById(refBlockId);
        }
    }).element);
    /// #endif
    getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "backlinks",
        icon: "iconLink",
        label: siyuanI18n.backlinks,
        accelerator: getSiyuanConfig().keymap.editor.general.backlinks.custom,
        click: () => {
            openBacklink({
                app: protyle.app,
                blockId: refBlockId,
            });
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "graphView",
        icon: "iconGraph",
        label: siyuanI18n.graphView,
        accelerator: getSiyuanConfig().keymap.editor.general.graphView.custom,
        click: () => {
            openGraph({
                app: protyle.app,
                blockId: refBlockId,
            });
        }
    }).element);
    getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);
    /// #endif
    if (!protyle.disabled) {
        let submenu: IMenu[] = [];
        if (refElement.getAttribute("data-subtype") === "s") {
            submenu.push({
                id: "turnToDynamic",
                iconHTML: "",
                label: siyuanI18n.turnToDynamic,
                click() {
                    refElement.setAttribute("data-subtype", "d");
                    fetchPost("/api/block/getRefText", { id: refBlockId }, (response) => {
                        refElement.innerHTML = response.data;
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
                label: siyuanI18n.turnToStatic,
                click() {
                    refElement.setAttribute("data-subtype", "s");
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
            label: siyuanI18n.text,
            click() {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                removeInlineType(refElement, "block-ref", protyle.toolbar.range);
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "*",
            iconHTML: "",
            label: "*",
            click() {
                refElement.setAttribute("data-subtype", "s");
                refElement.textContent = "*";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByRange(protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "text*",
            iconHTML: "",
            label: siyuanI18n.text + " *",
            click() {
                refElement.insertAdjacentHTML("beforebegin", refElement.innerHTML + " ");
                refElement.setAttribute("data-subtype", "s");
                refElement.textContent = "*";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByRange(protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "link",
            label: siyuanI18n.link,
            iconHTML: "",
            click() {
                refElement.outerHTML = `<span data-type="a" data-href="siyuan://blocks/${refElement.getAttribute("data-id")}">${refElement.innerHTML}</span><wbr>`;
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByWbr(nodeElement, protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }]);
        if (refElement.parentElement.textContent.trim() === refElement.textContent.trim() && refElement.parentElement.tagName === "DIV") {
            submenu.push({
                id: "blockEmbed",
                iconHTML: "",
                label: siyuanI18n.blockEmbed,
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
            label: siyuanI18n.defBlock,
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
            label: siyuanI18n.defBlockChildren,
            click() {
                fetchPost("/api/block/swapBlockRef", {
                    refID: id,
                    defID: refBlockId,
                    includeChildren: true
                });
            }
        });
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "turnInto",
            label: siyuanI18n.turnInto,
            icon: "iconRefresh",
            submenu
        }).element);
    }
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            writeText(protyle.lute.BlockDOM2StdMd(refElement.outerHTML).trim());
        }
    }).element);
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "cut",
            label: siyuanI18n.cut,
            icon: "iconCut",
            click() {
                writeText(protyle.lute.BlockDOM2StdMd(refElement.outerHTML));

                refElement.insertAdjacentHTML("afterend", "<wbr>");
                refElement.remove();
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                focusByWbr(nodeElement, protyle.toolbar.range);
                oldHTML = nodeElement.outerHTML;
            }
        }).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "remove",
            label: siyuanI18n.remove,
            icon: "iconTrashcan",
            click() {
                refElement.insertAdjacentHTML("afterend", "<wbr>");
                refElement.remove();
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
                element: refElement,
            },
            separatorPosition: "top",
        });
    }

    /// #if MOBILE
    getSiyuanGlobalMenus().menu.fullscreen();
    /// #else
    const rect = refElement.getBoundingClientRect();
    getSiyuanGlobalMenus().menu.popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
    /// #endif
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenus().menu.data = refElement;
    getSiyuanGlobalMenus().menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.element.querySelector("input")?.select();
        getSiyuanGlobalMenus().menu.removeCB = () => {
            if (nodeElement.outerHTML !== oldHTML) {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            }
            const currentRange = getSelection().rangeCount === 0 ? undefined : getSelection().getRangeAt(0);
            if (currentRange && !protyle.element.contains(currentRange.startContainer)) {
                protyle.toolbar.range.selectNodeContents(refElement);
                protyle.toolbar.range.collapse(false);
                focusByRange(protyle.toolbar.range);
            }
        };
    }
};
