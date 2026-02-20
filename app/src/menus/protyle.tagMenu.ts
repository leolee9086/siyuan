import * as dayjs from "dayjs";
import { focusByRange } from "../ai/imports";
import { Constants } from "../constants";
import { isMobile } from "../platform";
import { popSearch } from "../mobile/menu/search";
import { emitOpenMenu } from "../plugin/EventBus";
import { hideElements } from "../protyle/ui/hideElements";
import { electronUndo } from "../protyle/undo";
import { hasClosestBlock, hasTopClosestByClassName } from "../protyle/util/hasClosest";
import { focusByWbr } from "../protyle/util/selection";
import { updateTransaction } from "../protyle/wysiwyg/transaction";
import { openGlobalSearch } from "../search/util";
import { renameTag } from "../util/noRelyPCFunction";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "./Menu.Item";


export const tagMenu = (protyle: IProtyle, tagElement: HTMLElement) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_TAG);
    const nodeElement = hasClosestBlock(tagElement);
    if (!nodeElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);
    const id = nodeElement.getAttribute("data-node-id");
    let html = nodeElement.outerHTML;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "tag",
        iconHTML: "",
        type: "readonly",
        label: `<input class="b3-text-field fn__block" style="margin: 4px 0" placeholder="${siyuanI18n.tag}">`,
        bind(element) {
            const inputElement = element.querySelector("input");
            inputElement.value = tagElement.textContent.replace(Constants.ZWSP, "");
            inputElement.addEventListener("change", () => {
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                html = nodeElement.outerHTML;
            });
            inputElement.addEventListener("compositionend", () => {
                tagElement.innerHTML = Constants.ZWSP + Lute.EscapeHTMLStr(inputElement.value || "");
            });
            inputElement.addEventListener("input", (event: KeyboardEvent) => {
                if (!event.isComposing) {
                    // https://github.com/siyuan-note/siyuan/issues/4511
                    tagElement.innerHTML = Constants.ZWSP + Lute.EscapeHTMLStr(inputElement.value || "");
                }
            });
            inputElement.addEventListener("keydown", (event) => {
                if ((event.key === "Enter" || event.key === "Escape") && !event.isComposing) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!inputElement.value) {
                        const oldHTML = nodeElement.outerHTML;
                        tagElement.insertAdjacentHTML("afterend", "<wbr>");
                        tagElement.remove();
                        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                        updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                        focusByWbr(nodeElement, protyle.toolbar.range);
                    } else {
                        protyle.toolbar.range.selectNodeContents(tagElement);
                        protyle.toolbar.range.collapse(false);
                        focusByRange(protyle.toolbar.range);
                    }
                    getSiyuanGlobalMenusMenu().remove();
                } else if (electronUndo(event)) {
                    return;
                }
            });
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);

    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "search",
        label: siyuanI18n.search,
        accelerator: siyuanI18n.click,
        icon: "iconSearch",
        click() {
            if (!isMobile) {
                openGlobalSearch(protyle.app, `#${tagElement.textContent}#`, false, { method: 0 });
            }
            if (isMobile) {
                popSearch(protyle.app, {
                    hasReplace: false,
                    method: 0,
                    hPath: "",
                    idPath: [],
                    k: `#${tagElement.textContent}#`,
                    r: "",
                    page: 1,
                });
            }
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        click() {
            renameTag(tagElement.textContent.replace(Constants.ZWSP, ""));
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "turnIntoText",
        label: `${siyuanI18n.turnInto} <b>${siyuanI18n.text}</b>`,
        icon: "iconRefresh",
        click() {
            protyle.toolbar.range.setStart(tagElement.firstChild, 0);
            protyle.toolbar.range.setEnd(tagElement.lastChild, tagElement.lastChild.textContent.length);
            protyle.toolbar.setInlineMark(protyle, "tag", "range");
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            const range = document.createRange();
            range.selectNode(tagElement);
            focusByRange(range);
            document.execCommand("copy");
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "cut",
        label: siyuanI18n.cut,
        icon: "iconCut",
        click() {
            const range = document.createRange();
            range.selectNode(tagElement);
            focusByRange(range);
            document.execCommand("cut");
        }
    }).element);
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click() {
            const oldHTML = nodeElement.outerHTML;
            tagElement.insertAdjacentHTML("afterend", "<wbr>");
            tagElement.remove();
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            focusByWbr(nodeElement, protyle.toolbar.range);
        }
    }).element);

    if (protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-tag",
            detail: {
                protyle,
                element: tagElement,
            },
            separatorPosition: "top",
        });
    }

    if (isMobile) {
        getSiyuanGlobalMenusMenu().fullscreen();
    }
    if (!isMobile) {
        const rect = tagElement.getBoundingClientRect();
        getSiyuanGlobalMenusMenu().popup({
            x: rect.left,
            y: rect.top + 26,
            h: 26
        });
    }
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    getSiyuanGlobalMenusMenu().element.querySelector("input").select();
};
