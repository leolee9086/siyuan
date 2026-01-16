import * as dayjs from "dayjs";
import { focusByRange } from "../../ai/imports";
import { Constants } from "../../constants";
import { showMessage } from "../../dialog/message";
import { hideTooltip } from "../../dialog/tooltip";
import { renameAsset } from "../../editor/rename";
import { emitOpenMenu } from "../../plugin/EventBus";
import { removeInlineType } from "../../protyle/toolbar/util";
import { hideElements } from "../../protyle/ui/hideElements";
import { electronUndo } from "../../protyle/undo";
import { writeText } from "../../protyle/util/compatibility";
import { hasClosestBlock, hasTopClosestByClassName } from "../../protyle/util/hasClosest";
import { focusByWbr } from "../../protyle/util/selection";
import { updateTransaction } from "../../protyle/wysiwyg/transaction";
import { isMobile } from "../../util/functions";
import { getSiyuanGlobalMenusMenu } from "../../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { openMenu } from "../commonMenuItem.openMenu";
import { MenuItem } from "../Menu.Item";
import { exportAsset } from "../util";


export const linkMenu = (protyle: IProtyle, linkElement: HTMLElement, focusText = false) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_A);
    const nodeElement = hasClosestBlock(linkElement);
    if (!nodeElement) {
        return;
    }
    hideTooltip();
    hideElements(["util", "toolbar", "hint"], protyle);
    const id = nodeElement.getAttribute("data-node-id");
    let html = nodeElement.outerHTML;
    const linkAddress = linkElement.getAttribute("data-href");
    let inputElements: NodeListOf<HTMLTextAreaElement>;
    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "linkAndAnchorAndTitle",
            iconHTML: "",
            type: "readonly",
            label: `<div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.link}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea spellcheck="false" rows="1" 
style="margin:4px 0;width: ${isMobile() ? "100%" : "360px"}" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.anchor}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="width: ${isMobile() ? "100%" : "360px"};margin: 4px 0;" rows="1" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.title}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="width: ${isMobile() ? "100%" : "360px"};margin: 4px 0;" rows="1" class="b3-text-field"></textarea>`,
            bind(element) {
                element.style.maxWidth = "none";
                inputElements = element.querySelectorAll("textarea");
                inputElements[0].value = Lute.UnEscapeHTMLStr(linkAddress) || "";
                inputElements[0].addEventListener("keydown", (event) => {
                    if ((event.key === "Enter" || event.key === "Escape") && !event.isComposing) {
                        event.preventDefault();
                        event.stopPropagation();
                        getSiyuanGlobalMenusMenu().remove();
                    } else if (event.key === "Tab" && !event.isComposing) {
                        event.preventDefault();
                        event.stopPropagation();
                        inputElements[1].focus();
                    } else if (electronUndo(event)) {
                        return;
                    }
                });

                // https://github.com/siyuan-note/siyuan/issues/6798
                let anchor = linkElement.textContent.replace(Constants.ZWSP, "");
                if (!anchor && linkAddress) {
                    anchor = decodeURIComponent(linkAddress.replace("https://", "").replace("http://", ""));
                    if (anchor.length > Constants.SIZE_LINK_TEXT_MAX) {
                        anchor = anchor.substring(0, Constants.SIZE_LINK_TEXT_MAX) + "...";
                    }
                    linkElement.innerHTML = Lute.EscapeHTMLStr(anchor);
                }
                inputElements[1].value = anchor;
                inputElements[1].addEventListener("compositionend", () => {
                    linkElement.innerHTML = Lute.EscapeHTMLStr(inputElements[1].value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim() || "*");
                });
                inputElements[1].addEventListener("input", (event: KeyboardEvent) => {
                    if (!event.isComposing) {
                        // https://github.com/siyuan-note/siyuan/issues/4511
                        linkElement.innerHTML = Lute.EscapeHTMLStr(inputElements[1].value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim()) || "*";
                    }
                });
                inputElements[1].addEventListener("keydown", (event) => {
                    if ((event.key === "Enter" || event.key === "Escape") && !event.isComposing) {
                        event.preventDefault();
                        event.stopPropagation();
                        getSiyuanGlobalMenusMenu().remove();
                    } else if (event.key === "Tab" && !event.isComposing) {
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.shiftKey) {
                            inputElements[0].focus();
                        } else {
                            inputElements[2].focus();
                        }
                    } else if (electronUndo(event)) {
                        return;
                    }
                });

                inputElements[2].value = Lute.UnEscapeHTMLStr(linkElement.getAttribute("data-title") || "");
                inputElements[2].addEventListener("keydown", (event) => {
                    if ((event.key === "Enter" || event.key === "Escape") && !event.isComposing) {
                        event.preventDefault();
                        event.stopPropagation();
                        getSiyuanGlobalMenusMenu().remove();
                    } else if (event.key === "Tab" && event.shiftKey && !event.isComposing) {
                        event.preventDefault();
                        event.stopPropagation();
                        inputElements[1].focus();
                    } else if (electronUndo(event)) {
                        return;
                    }
                });

                element.addEventListener("click", (event) => {
                    let target = event.target as HTMLElement;
                    while (target) {
                        if (target.dataset.action === "copy") {
                            writeText((target.parentElement.nextElementSibling as HTMLTextAreaElement).value);
                            showMessage(siyuanI18n.copied);
                            break;
                        }
                        target = target.parentElement;
                    }
                });
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            const range = document.createRange();
            range.selectNode(linkElement);
            focusByRange(range);
            document.execCommand("copy");
        }
    }).element);
    if (protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "copyAHref",
            label: siyuanI18n.copyAHref,
            icon: "iconLink",
            click() {
                writeText(linkAddress);
            }
        }).element);
    }
    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "cut",
            icon: "iconCut",
            label: siyuanI18n.cut,
            click() {
                const range = document.createRange();
                range.selectNode(linkElement);
                focusByRange(range);
                document.execCommand("cut");
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "remove",
            icon: "iconTrashcan",
            label: siyuanI18n.remove,
            click() {
                linkElement.insertAdjacentHTML("afterend", "<wbr>");
                linkElement.remove();
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                focusByWbr(nodeElement, protyle.toolbar.range);
                html = nodeElement.outerHTML;
            }
        }).element);
        if (linkAddress?.startsWith("assets/")) {
            getSiyuanGlobalMenusMenu().append(new MenuItem({
                id: "rename",
                label: siyuanI18n.rename,
                icon: "iconEdit",
                click() {
                    renameAsset(linkAddress);
                }
            }).element);
        }
        if (linkAddress?.startsWith("siyuan://blocks/")) {
            getSiyuanGlobalMenusMenu().append(new MenuItem({
                id: "turnIntoRef",
                label: `${siyuanI18n.turnInto} <b>${siyuanI18n.ref}</b>`,
                icon: "iconRef",
                click() {
                    linkElement.setAttribute("data-subtype", "s");
                    const types = linkElement.getAttribute("data-type").split(" ");
                    types.push("block-ref");
                    types.splice(types.indexOf("a"), 1);
                    linkElement.setAttribute("data-type", types.join(" "));
                    linkElement.setAttribute("data-id", inputElements[0].value.replace("siyuan://blocks/", ""));
                    inputElements[0].value = "";
                    inputElements[2].value = "";
                    linkElement.removeAttribute("data-href");
                    linkElement.removeAttribute("data-title");
                    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                    updateTransaction(protyle, id, nodeElement.outerHTML, html);
                    protyle.toolbar.range.selectNode(linkElement);
                    protyle.toolbar.range.collapse(false);
                    focusByRange(protyle.toolbar.range);
                    html = nodeElement.outerHTML;
                }
            }).element);
        }
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "turnIntoText",
            label: `${siyuanI18n.turnInto} <b>${siyuanI18n.text}</b>`,
            icon: "iconRefresh",
            click() {
                inputElements[0].value = "";
                inputElements[2].value = "";
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                removeInlineType(linkElement, "a", protyle.toolbar.range);
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                html = nodeElement.outerHTML;
            }
        }).element);
    }

    if (linkAddress) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
        openMenu(protyle.app, linkAddress, false, true);
        if (linkAddress?.startsWith("assets/")) {
            getSiyuanGlobalMenusMenu().append(new MenuItem(exportAsset(linkAddress)).element);
        }
    }

    if (!protyle.disabled && protyle?.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-link",
            detail: {
                protyle,
                element: linkElement,
            },
            separatorPosition: "top",
        });
    }
    /// #if MOBILE
    getSiyuanGlobalMenusMenu().fullscreen();
    /// #else
    const rect = linkElement.getBoundingClientRect();
    getSiyuanGlobalMenusMenu().popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
    /// #endif
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    if (protyle.disabled) {
        return;
    }
    if (focusText || protyle.lute.GetLinkDest(linkAddress) || linkAddress?.startsWith("assets/")) {
        inputElements[1].select();
    } else {
        inputElements[0].select();
    }
    getSiyuanGlobalMenusMenu().removeCB = () => {
        if (inputElements[2].value) {
            linkElement.setAttribute("data-title", Lute.EscapeHTMLStr(inputElements[2].value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "")));
        } else {
            linkElement.removeAttribute("data-title");
        }
        if (linkElement.getAttribute("data-type").indexOf("a") > -1) {
            linkElement.setAttribute("data-href", Lute.EscapeHTMLStr(inputElements[0].value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "")));
        } else {
            linkElement.removeAttribute("data-href");
        }
        if (!inputElements[1].value && (inputElements[0].value || inputElements[2].value)) {
            linkElement.textContent = "*";
        }
        const currentRange = getSelection().rangeCount === 0 ? undefined : getSelection().getRangeAt(0);
        if (currentRange && !protyle.element.contains(currentRange.startContainer)) {
            protyle.toolbar.range.selectNodeContents(linkElement);
            protyle.toolbar.range.collapse(false);
            focusByRange(protyle.toolbar.range);
        }
        if (!inputElements[1].value && !inputElements[0].value && !inputElements[2].value) {
            linkElement.remove();
        }
        if (html !== nodeElement.outerHTML) {
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
        }
    };
};
