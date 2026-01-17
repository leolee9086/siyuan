import * as dayjs from "dayjs";
import { focusByRange } from "../../ai/imports";
import { Constants } from "../../constants";
import { emitOpenMenu } from "../../plugin/EventBus";
import { removeInlineType } from "../../protyle/toolbar/util";
import { hideElements } from "../../protyle/ui/hideElements";
import { electronUndo } from "../../protyle/undo";
import { hasClosestBlock, hasTopClosestByClassName } from "../../protyle/util/hasClosest";
import { focusByWbr } from "../../protyle/util/selection";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { isMobile } from "../../util/functions";
import { MenuItem } from "../Menu.Item";
import { getSiyuanGlobalMenus } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { isComposing } from "../../util/events/eventGurds";
import { requireRange } from "../../protyle/util/protyleCheckers";
import { asLuteNodeID, LuteNodeID } from "../../util/noteDatas/id";
import { Menu } from "../Menu";


export const fileAnnotationRefMenu = (protyle: IProtyle, refElement: HTMLElement, menu: Menu) => {
    const nodeElement = hasClosestBlock(refElement);
    if (!nodeElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);
    const id = nodeElement.getAttribute("data-node-id") || "";
    if (!asLuteNodeID(id)) {
        throw ("元素id不是合法ID");
    }
    let oldHTML = nodeElement.outerHTML;
    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_INLINE_FILE_ANNOTATION_REF);
    let anchorElement: HTMLInputElement;
    menu.append(new MenuItem({
        id: "idAndAnchor",
        iconHTML: "",
        type: "readonly",
        label: `<div>ID</div><textarea spellcheck="false" rows="1" style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" class="b3-text-field" readonly>${refElement.getAttribute("data-id") || ""}</textarea><div class="fn__hr"></div><div>${siyuanI18n.anchor}</div><textarea rows="1" style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" class="b3-text-field"></textarea>`,
        bind(menuItemElement) {
            menuItemElement.style.maxWidth = "none";
            anchorElement = menuItemElement.querySelectorAll(".b3-text-field")[1] as HTMLInputElement;
            anchorElement.value = refElement.textContent;
            const inputEvent = () => {
                if (anchorElement.value) {
                    refElement.innerHTML = Lute.EscapeHTMLStr(anchorElement.value);
                } else {
                    refElement.innerHTML = "*";
                }
            };
            anchorElement.addEventListener("input", (event: Event) => {
                if (isComposing(event)) {
                    return;
                }
                inputEvent();
                event.stopPropagation();
            });
            anchorElement.addEventListener("compositionend", (event: Event) => {
                if (isComposing(event)) {
                    return;
                }
                inputEvent();
                event.stopPropagation();
            });
            anchorElement.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.isComposing) {
                    return;
                }
                if (event.key === "Enter" && !event.isComposing) {
                    menu.remove();
                } else if (electronUndo(event)) {
                    return;
                }
            });
            anchorElement.select();
        }
    }).element);
    menu.append(new MenuItem({ type: "separator" }).element);
    menu.append(new MenuItem({
        id: "turnInto",
        label: siyuanI18n.turnInto,
        icon: "iconRefresh",
        submenu: [{
            id: "text",
            iconHTML: "",
            label: siyuanI18n.text,
            click() {
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                removeInlineType(refElement, "file-annotation-ref", requireRange(protyle));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                oldHTML = nodeElement.outerHTML;
            }
        }, {
            id: "text*",
            iconHTML: "",
            label: siyuanI18n.text + " *",
            click() {
                refElement.insertAdjacentHTML("beforebegin", refElement.innerHTML + " ");
                refElement.textContent = "*";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
                oldHTML = nodeElement.outerHTML;
            }
        }]
    }).element);
    menu.append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click() {
            refElement.insertAdjacentHTML("afterend", "<wbr>");
            refElement.remove();
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
            focusByWbr(nodeElement, requireRange(protyle));
            oldHTML = nodeElement.outerHTML;
        }
    }).element);
    //打开插件菜单
    if (protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-fileannotationref",
            detail: {
                protyle,
                element: refElement,
            },
            separatorPosition: "top",
        });
    }
    /// #if MOBILE
    menu.fullscreen();
    /// #else
    const rect = refElement.getBoundingClientRect();
    getSiyuanGlobalMenus().menu.popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
    /// #endif
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    menu.removeCB = () => handleMenuRemoveCleanup(protyle, id, nodeElement, oldHTML, refElement);
};
const handleMenuRemoveCleanup = (
    protyle: IProtyle,
    id: LuteNodeID,
    nodeElement: HTMLElement,
    oldHTML: string,
    refElement: HTMLElement
) => {
    if (nodeElement.outerHTML !== oldHTML) {
        nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, id, nodeElement.outerHTML, oldHTML);
    }
    const currentSelection = getSelection();
    const currentRange = currentSelection && (currentSelection.rangeCount === 0 ? undefined : currentSelection.getRangeAt(0));
    if (currentRange && !protyle.element.contains(currentRange.startContainer)) {
        requireRange(protyle).selectNodeContents(refElement);
        requireRange(protyle).collapse(false);
        focusByRange(requireRange(protyle));
    }
};