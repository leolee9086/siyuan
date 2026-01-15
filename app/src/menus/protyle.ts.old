import {
    hasClosestBlock,
    hasClosestByClassName,
    hasTopClosestByClassName,
    isInEmbedBlock
} from "../protyle/util/hasClosest";
import { MenuItem } from "./Menu.Item";
import { focusBlock, focusByRange, focusByWbr, } from "../protyle/util/selection";
import {
    deleteColumn,
    deleteRow,
    getColIndex,
    insertColumn,
    insertRow,
    insertRowAbove,
    moveColumnToLeft,
    moveColumnToRight,
    moveRowToDown,
    moveRowToUp,
    setTableAlign
} from "../protyle/util/table";
import { transaction, updateTransaction } from "../protyle/wysiwyg/transaction";
import { openMenu } from "./commonMenuItem.openMenu";
import { fetchPost, fetchSyncPost } from "../util/fetch";
import { Constants } from "../constants";
import { setStorageVal, writeText } from "../protyle/util/compatibility";
import { preventScroll } from "../protyle/scroll/preventScroll";
import { onGet } from "../protyle/util/onGet";
import { getAllModels } from "../layout/getAll";
/// #if !MOBILE
import { openFileById } from "../editor/utils.openFileById";
import { updateBacklinkGraph } from "../editor/util.updateBacklinkGraph";
import { openGlobalSearch } from "../search/util";
/// #endif
import { getSearch, isMobile } from "../util/functions";
import { removeFoldHeading } from "../protyle/util/heading";
import { lineNumberRender } from "../protyle/render/highlightRender";
import * as dayjs from "dayjs";
import { renameAsset } from "../editor/rename";
import { electronUndo } from "../protyle/undo";
import { pushBack } from "../mobile/util/MobileBackFoward";
import { exportAsset } from "./util";
import { removeInlineType } from "../protyle/toolbar/util";
import { renameTag } from "../util/noRelyPCFunction";
import { hideElements } from "../protyle/ui/hideElements";
import { emitOpenMenu } from "../plugin/EventBus";
import { openMobileFileById } from "../mobile/editor";
import { getFirstBlock } from "../protyle/wysiwyg/getBlock";
import { popSearch } from "../mobile/menu/search";
import { showMessage } from "../dialog/message";
import { img3115 } from "../boot/compatibleVersion";
import { hideTooltip } from "../dialog/tooltip";
import { clearSelect } from "../protyle/util/clearSelect";
import { scrollCenter } from "../util/highlightById";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../util/siyuanEnvironments/getMenu.environment";

export const enterBack = (protyle: IProtyle, id: string) => {
    if (!protyle.block.showAll) {
        const ids = protyle.path.split("/");
        if (ids.length > 2) {
            /// #if MOBILE
            openMobileFileById(protyle.app, ids[ids.length - 2], [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]);
            /// #else
            openFileById({
                app: protyle.app,
                id: ids[ids.length - 2],
                action: [Constants.CB_GET_FOCUS, Constants.CB_GET_SCROLL]
            });
            /// #endif
        }
    } else {
        zoomOut({ protyle, id: protyle.block.parent2ID, focusId: id });
    }
};

export const zoomOut = (options: {
    protyle: IProtyle,
    id: string,
    focusId?: string,
    isPushBack?: boolean,
    callback?: () => void,
    reload?: boolean
}) => {
    if (options.protyle.options.backlinkData) {
        return;
    }
    if (typeof options.isPushBack === "undefined") {
        options.isPushBack = true;
    }
    if (typeof options.reload === "undefined") {
        options.reload = false;
    }
    const blockPanelElement = hasClosestByClassName(options.protyle.element, "block__popover", true);
    if (blockPanelElement) {
        const pingElement = blockPanelElement.querySelector('[data-type="pin"]');
        if (pingElement && blockPanelElement.getAttribute("data-pin") !== "true") {
            pingElement.setAttribute("aria-label", siyuanI18n.unpin);
            pingElement.querySelector("use").setAttribute("xlink:href", "#iconUnpin");
            blockPanelElement.setAttribute("data-pin", "true");
        }
    }
    const breadcrumbHLElement = options.protyle.breadcrumb?.element.querySelector(".protyle-breadcrumb__item--active");
    if (!options.reload && breadcrumbHLElement && breadcrumbHLElement.getAttribute("data-node-id") === options.id) {
        if (options.id === options.protyle.block.rootID) {
            return;
        }
        const focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId || options.id}"]`);
        if (focusElement) {
            focusBlock(focusElement);
            focusElement.scrollIntoView();
            return;
        }
    }
    if (window.siyuan.mobile?.editor) {
        window.siyuan.storage[Constants.LOCAL_DOCINFO] = {
            id: options.id,
        };
        setStorageVal(Constants.LOCAL_DOCINFO, window.siyuan.storage[Constants.LOCAL_DOCINFO]);
        if (options.isPushBack) {
            pushBack();
        }
    }
    fetchPost("/api/filetree/getDoc", {
        id: options.id,
        size: options.id === options.protyle.block.rootID ? window.siyuan.config.editor.dynamicLoadBlocks : Constants.SIZE_GET_MAX,
    }, async (getResponse) => {
        if (options.isPushBack) {
            onGet({
                data: getResponse,
                protyle: options.protyle,
                action: options.id === options.protyle.block.rootID ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HTML] : [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS, Constants.CB_GET_HTML],
                afterCB: options.callback,
            });
        } else {
            onGet({
                data: getResponse,
                protyle: options.protyle,
                action: options.id === options.protyle.block.rootID ? [Constants.CB_GET_FOCUS, Constants.CB_GET_HTML, Constants.CB_GET_UNUNDO] : [Constants.CB_GET_ALL, Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO, Constants.CB_GET_HTML],
                afterCB: options.callback,
            });
        }
        // https://github.com/siyuan-note/siyuan/issues/4874
        if (options.focusId) {
            let focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId}"]`);
            if (!focusElement) {
                const unfoldResponse = await fetchSyncPost("/api/block/getUnfoldedParentID", { id: options.focusId });
                options.focusId = unfoldResponse.data.parentID;
                focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${unfoldResponse.data.parentID}"]`);
            }
            if (focusElement) {
                // 退出聚焦后块在折叠中 https://github.com/siyuan-note/siyuan/issues/10746
                let showElement = focusElement;
                while (showElement.getBoundingClientRect().height === 0) {
                    showElement = showElement.parentElement;
                }
                if (showElement.classList.contains("protyle-wysiwyg")) {
                    // 闪卡退出聚焦元素被隐藏 https://github.com/siyuan-note/siyuan/issues/10058#issuecomment-2029524211
                    showElement = focusElement.previousElementSibling || focusElement.nextElementSibling;
                } else {
                    showElement = getFirstBlock(showElement);
                }
                focusBlock(showElement);
                const resizeObserver = new ResizeObserver(() => {
                    scrollCenter(options.protyle, focusElement, "start");
                });
                resizeObserver.observe(options.protyle.wysiwyg.element);
                setTimeout(() => {
                    resizeObserver.disconnect();
                }, 1000 * 3);
            } else if (!options.focusId) {
                fetchPost("/api/filetree/getDoc", {
                    id: options.protyle.block.rootID,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getFocusResponse => {
                    onGet({
                        data: getFocusResponse,
                        protyle: options.protyle,
                        action: options.isPushBack ? [Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO],
                    });
                });
                return;
            } else if (options.id === options.protyle.block.rootID) { // 聚焦返回后，该块是动态加载的，但是没加载出来
                fetchPost("/api/filetree/getDoc", {
                    id: options.focusId,
                    mode: 3,
                    size: window.siyuan.config.editor.dynamicLoadBlocks,
                }, getFocusResponse => {
                    onGet({
                        data: getFocusResponse,
                        protyle: options.protyle,
                        action: options.isPushBack ? [Constants.CB_GET_FOCUS] : [Constants.CB_GET_FOCUS, Constants.CB_GET_UNUNDO],
                    });
                });
                return;
            }
        } else if (options.id !== options.protyle.block.rootID) {
            options.protyle.wysiwyg.element.classList.add("protyle-wysiwyg--animate");
            setTimeout(() => {
                options.protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--animate");
            }, 365);
        }
        /// #if !MOBILE
        if (options.protyle.model) {
            const allModels = getAllModels();
            allModels.outline.forEach(item => {
                if (item.blockId === options.protyle.block.rootID) {
                    item.setCurrent(options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId || options.id}"]`));
                }
            });
            updateBacklinkGraph(allModels, options.protyle);
        }
        /// #endif
    });
};

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
            /// #if !MOBILE
            openGlobalSearch(protyle.app, `#${tagElement.textContent}#`, false, { method: 0 });
            /// #else
            popSearch(protyle.app, {
                hasReplace: false,
                method: 0,
                hPath: "",
                idPath: [],
                k: `#${tagElement.textContent}#`,
                r: "",
                page: 1,
            });
            /// #endif
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

    /// #if MOBILE
    getSiyuanGlobalMenusMenu().fullscreen();
    /// #else
    const rect = tagElement.getBoundingClientRect();
    getSiyuanGlobalMenusMenu().popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
    /// #endif
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenusMenu().element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
    getSiyuanGlobalMenusMenu().element.querySelector("input").select();
};

export const inlineMathMenu = (protyle: IProtyle, element: Element) => {
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_INLINE_MATH);
    const nodeElement = hasClosestBlock(element);
    if (!nodeElement) {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    const html = nodeElement.outerHTML;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click() {
            const range = document.createRange();
            range.selectNode(element);
            focusByRange(range);
            document.execCommand("copy");
        }
    }).element);
    if (!protyle.disabled) {
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "cut",
            icon: "iconCut",
            label: siyuanI18n.cut,
            click() {
                const range = document.createRange();
                range.selectNode(element);
                focusByRange(range);
                document.execCommand("cut");
            }
        }).element);
        getSiyuanGlobalMenusMenu().append(new MenuItem({
            id: "remove",
            icon: "iconTrashcan",
            label: siyuanI18n.remove,
            click() {
                element.insertAdjacentHTML("afterend", "<wbr>");
                element.remove();
                nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                focusByWbr(nodeElement, protyle.toolbar.range);
            }
        }).element);
    }
    const rect = element.getBoundingClientRect();
    getSiyuanGlobalMenusMenu().popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
};

export const genImageWidthMenu = (label: string, imgElement: HTMLElement, protyle: IProtyle, id: string, nodeElement: HTMLElement, html: string) => {
    return {
        id: label === siyuanI18n.default ? "default" : "width_" + label,
        iconHTML: "",
        label,
        click() {
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            img3115(imgElement.parentElement.parentElement);
            imgElement.parentElement.style.width = label === siyuanI18n.default ? "" : `calc(${label} - 8px)`;
            imgElement.style.height = "";
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
            focusBlock(nodeElement);
        }
    };
};

export const genImageHeightMenu = (label: string, imgElement: HTMLElement, protyle: IProtyle, id: string, nodeElement: HTMLElement, html: string) => {
    return {
        id: label === siyuanI18n.default ? "default" : "width_" + label,
        iconHTML: "",
        label,
        click() {
            nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            imgElement.style.height = label === siyuanI18n.default ? "" : parseInt(label) + "vh";
            img3115(imgElement.parentElement.parentElement);
            imgElement.parentElement.style.width = "";
            updateTransaction(protyle, id, nodeElement.outerHTML, html);
            focusBlock(nodeElement);
        }
    };
};

export const iframeMenu = (protyle: IProtyle, nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const iframeElement = nodeElement.querySelector("iframe");
    let html = nodeElement.outerHTML;
    const subMenus: IMenu[] = [{
        id: "asset",
        iconHTML: "",
        type: "readonly",
        label: `<textarea spellcheck="false" rows="1" class="b3-text-field fn__block" placeholder="${siyuanI18n.link}" style="margin: 4px 0">${iframeElement.getAttribute("src") || ""}</textarea>`,
        bind(element) {
            element.style.maxWidth = "none";
            element.querySelector("textarea").addEventListener("change", (event) => {
                const value = (event.target as HTMLTextAreaElement).value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
                const biliMatch = value.match(/(?:www\.|\/\/)bilibili\.com\/video\/(\w+)/);
                if (value.indexOf("bilibili.com") > -1 && (value.indexOf("bvid=") > -1 || (biliMatch && biliMatch[1]))) {
                    const params: IObject = {
                        bvid: getSearch("bvid", value) || (biliMatch && biliMatch[1]),
                        page: "1",
                        high_quality: "1",
                        as_wide: "1",
                        allowfullscreen: "true",
                        autoplay: "0"
                    };
                    // `//player.bilibili.com/player.html?aid=895154192&bvid=BV1NP4y1M72N&cid=562898119&page=1`
                    // `https://www.bilibili.com/video/BV1ys411472E?t=3.4&p=4`
                    new URL(value.startsWith("http") ? value : "https:" + value).search.split("&").forEach((item, index) => {
                        if (!item) {
                            return;
                        }
                        if (index === 0) {
                            item = item.substr(1);
                        }
                        const keyValue = item.split("=");
                        params[keyValue[0]] = keyValue[1];
                    });
                    let src = "https://player.bilibili.com/player.html?";
                    const keys = Object.keys(params);
                    keys.forEach((key, index) => {
                        src += `${key}=${params[key]}`;
                        if (index < keys.length - 1) {
                            src += "&";
                        }
                    });
                    iframeElement.setAttribute("src", src);
                    iframeElement.setAttribute("sandbox", "allow-top-navigation-by-user-activation allow-same-origin allow-forms allow-scripts allow-popups");
                    if (!iframeElement.style.height) {
                        iframeElement.style.height = "360px";
                    }
                    if (!iframeElement.style.width) {
                        iframeElement.style.width = "640px";
                    }
                } else {
                    iframeElement.setAttribute("src", value);
                }

                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                html = nodeElement.outerHTML;
                event.stopPropagation();
            });
        }
    }];
    const iframeSrc = iframeElement.getAttribute("src");
    if (iframeSrc) {
        subMenus.push({
            type: "separator"
        });
        return subMenus.concat(openMenu(protyle.app, iframeSrc, true, false) as IMenu[]);
    }
    return subMenus;
};

export const videoMenu = (protyle: IProtyle, nodeElement: Element, type: string) => {
    const id = nodeElement.getAttribute("data-node-id");
    const videoElement = nodeElement.querySelector(type === "NodeVideo" ? "video" : "audio");
    let html = nodeElement.outerHTML;
    const subMenus: IMenu[] = [{
        id: "asset",
        iconHTML: "",
        type: "readonly",
        label: `<textarea spellcheck="false" rows="1" style="margin: 4px 0" class="b3-text-field fn__block" placeholder="${siyuanI18n.link}">${videoElement.getAttribute("src")}</textarea>`,
        bind(element) {
            element.style.maxWidth = "none";
            element.querySelector("textarea").addEventListener("change", (event) => {
                videoElement.setAttribute("src", (event.target as HTMLTextAreaElement).value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim());
                updateTransaction(protyle, id, nodeElement.outerHTML, html);
                html = nodeElement.outerHTML;
                event.stopPropagation();
            });
        }
    }];
    const src = videoElement.getAttribute("src");
    if (src && src.startsWith("assets/")) {
        subMenus.push({
            type: "separator"
        });
        subMenus.push({
            id: "rename",
            label: siyuanI18n.rename,
            icon: "iconEdit",
            click() {
                renameAsset(src);
            }
        });
    }
    if (src) {
        subMenus.push({
            id: "openBy",
            label: siyuanI18n.openBy,
            icon: "iconOpen",
            submenu: openMenu(protyle.app, src, true, false) as IMenu[]
        });
    }
    if (src && src.startsWith("assets/")) {
        subMenus.push(exportAsset(src));
    }
    return subMenus;
};

export const tableMenu = (protyle: IProtyle, nodeElement: Element, cellElement: HTMLTableCellElement, range: Range) => {
    const otherMenus: IMenu[] = [];
    const colIndex = getColIndex(cellElement);
    if (cellElement.rowSpan > 1 || cellElement.colSpan > 1) {
        otherMenus.push({
            id: "cancelMerged",
            label: siyuanI18n.cancelMerged,
            click: () => {
                const oldHTML = nodeElement.outerHTML;
                let rowSpan = cellElement.rowSpan;
                let currentRowElement: Element = cellElement.parentElement;
                const orgColSpan = cellElement.colSpan;
                while (rowSpan > 0 && currentRowElement) {
                    let currentCellElement = currentRowElement.children[colIndex] as HTMLTableCellElement;
                    let colSpan = orgColSpan;
                    while (colSpan > 0 && currentCellElement) {
                        currentCellElement.classList.remove("fn__none");
                        currentCellElement.colSpan = 1;
                        currentCellElement.rowSpan = 1;
                        currentCellElement = currentCellElement.nextElementSibling as HTMLTableCellElement;
                        colSpan--;
                    }
                    currentRowElement = currentRowElement.nextElementSibling;
                    rowSpan--;
                }
                cellElement.rowSpan = 1;
                cellElement.colSpan = 1;
                if (cellElement.tagName === "TH") {
                    let prueTrElement: HTMLElement;
                    Array.from(nodeElement.querySelectorAll("thead tr")).find((item: HTMLElement) => {
                        prueTrElement = item;
                        Array.from(item.children).forEach((cellElement: HTMLTableCellElement) => {
                            if (cellElement.rowSpan !== 1 || cellElement.classList.contains("fn__none")) {
                                prueTrElement = undefined;
                            }
                        });
                        if (prueTrElement) {
                            return true;
                        }
                    });
                    if (prueTrElement) {
                        const tbodyElement = nodeElement.querySelector("tbody");
                        const theadElement = nodeElement.querySelector("thead");
                        while (prueTrElement !== theadElement.lastElementChild) {
                            tbodyElement.insertAdjacentElement("afterbegin", theadElement.lastElementChild);
                        }
                    }
                }
                focusByRange(range);
                updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, oldHTML);
            }
        });
    }
    const thMatchElement = nodeElement.querySelectorAll("col")[colIndex];
    if (thMatchElement.style.width || thMatchElement.style.minWidth !== "60px") {
        otherMenus.push({
            id: "useDefaultWidth",
            label: siyuanI18n.useDefaultWidth,
            click: () => {
                const html = nodeElement.outerHTML;
                thMatchElement.style.width = "";
                thMatchElement.style.minWidth = "60px";
                updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, html);
            }
        });
    }
    const isPinHead = nodeElement.getAttribute("custom-pinthead");
    otherMenus.push({
        id: isPinHead ? "unpinTableHead" : "pinTableHead",
        icon: isPinHead ? "iconUnpin" : "iconPin",
        label: isPinHead ? siyuanI18n.unpinTableHead : siyuanI18n.pinTableHead,
        click: () => {
            const html = nodeElement.outerHTML;
            if (isPinHead) {
                nodeElement.removeAttribute("custom-pinthead");
            } else {
                nodeElement.setAttribute("custom-pinthead", "true");
            }
            updateTransaction(protyle, nodeElement.getAttribute("data-node-id"), nodeElement.outerHTML, html);
        }
    });
    otherMenus.push({ id: "separator_1", type: "separator" });
    otherMenus.push({
        id: "alignLeft",
        icon: "iconAlignLeft",
        accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
        label: siyuanI18n.alignLeft,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "left", range);
        }
    });
    otherMenus.push({
        id: "alignCenter",
        icon: "iconAlignCenter",
        label: siyuanI18n.alignCenter,
        accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "center", range);
        }
    });
    otherMenus.push({
        id: "alignRight",
        icon: "iconAlignRight",
        label: siyuanI18n.alignRight,
        accelerator: window.siyuan.config.keymap.editor.general.alignRight.custom,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "right", range);
        }
    });
    otherMenus.push({
        id: "useDefaultAlign",
        icon: "",
        label: siyuanI18n.useDefaultAlign,
        click: () => {
            setTableAlign(protyle, [cellElement], nodeElement, "", range);
        }
    });
    const menus: IMenu[] = [];
    menus.push(...otherMenus);
    menus.push({
        type: "separator"
    });
    const tableElement = nodeElement.querySelector("table");
    const hasNone = cellElement.parentElement.querySelector(".fn__none");
    let hasColSpan = false;
    let hasRowSpan = false;
    Array.from(cellElement.parentElement.children).forEach((item: HTMLTableCellElement) => {
        if (item.colSpan > 1) {
            hasColSpan = true;
        }
        if (item.rowSpan > 1) {
            hasRowSpan = true;
        }
    });
    let previousHasNone: false | Element = false;
    let previousHasColSpan = false;
    let previousHasRowSpan = false;
    let previousRowElement = cellElement.parentElement.previousElementSibling;
    if (!previousRowElement && cellElement.parentElement.parentElement.tagName === "TBODY") {
        previousRowElement = tableElement.querySelector("thead").lastElementChild;
    }
    if (previousRowElement) {
        previousHasNone = previousRowElement.querySelector(".fn__none");
        Array.from(previousRowElement.children).forEach((item: HTMLTableCellElement) => {
            if (item.colSpan > 1) {
                previousHasColSpan = true;
            }
            if (item.rowSpan > 1) {
                previousHasRowSpan = true;
            }
        });
    }
    let nextHasNone: false | Element = false;
    let nextHasColSpan = false;
    let nextHasRowSpan = false;
    let nextRowElement = cellElement.parentElement.nextElementSibling;
    if (!nextRowElement && cellElement.parentElement.parentElement.tagName === "THEAD") {
        nextRowElement = tableElement.querySelector("tbody")?.firstElementChild;
    }
    if (nextRowElement) {
        nextHasNone = nextRowElement.querySelector(".fn__none");
        Array.from(nextRowElement.children).forEach((item: HTMLTableCellElement) => {
            if (item.colSpan > 1) {
                nextHasColSpan = true;
            }
            if (item.rowSpan > 1) {
                nextHasRowSpan = true;
            }
        });
    }
    let colIsPure = true;
    Array.from(tableElement.rows).find(item => {
        const cellElement = item.cells[colIndex];
        if (cellElement.classList.contains("fn__none") || cellElement.colSpan > 1 || cellElement.rowSpan > 1) {
            colIsPure = false;
            return true;
        }
    });
    let nextColIsPure = true;
    Array.from(tableElement.rows).find(item => {
        const cellElement = item.cells[colIndex + 1];
        if (cellElement && (cellElement.classList.contains("fn__none") || cellElement.colSpan > 1 || cellElement.rowSpan > 1)) {
            nextColIsPure = false;
            return true;
        }
    });
    let previousColIsPure = true;
    Array.from(tableElement.rows).find(item => {
        const cellElement = item.cells[colIndex - 1];
        if (cellElement && (cellElement.classList.contains("fn__none") || cellElement.colSpan > 1 || cellElement.rowSpan > 1)) {
            previousColIsPure = false;
            return true;
        }
    });
    const insertMenus = [];
    insertMenus.push({
        id: "insertRowAbove",
        icon: "iconBefore",
        label: siyuanI18n.insertRowAbove,
        accelerator: window.siyuan.config.keymap.editor.table.insertRowAbove.custom,
        click: () => {
            insertRowAbove(protyle, range, cellElement, nodeElement);
        }
    });
    if (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan)) {
        insertMenus.push({
            id: "insertRowBelow",
            icon: "iconAfter",
            label: siyuanI18n.insertRowBelow,
            accelerator: window.siyuan.config.keymap.editor.table.insertRowBelow.custom,
            click: () => {
                insertRow(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure || previousColIsPure) {
        insertMenus.push({
            id: "insertColumnLeft",
            icon: "iconInsertLeft",
            label: siyuanI18n.insertColumnLeft,
            accelerator: window.siyuan.config.keymap.editor.table.insertColumnLeft.custom,
            click: () => {
                insertColumn(protyle, nodeElement, cellElement, "beforebegin", range);
            }
        });
    }
    if (colIsPure || nextColIsPure) {
        insertMenus.push({
            id: "insertColumnRight",
            icon: "iconInsertRight",
            label: siyuanI18n.insertColumnRight,
            accelerator: window.siyuan.config.keymap.editor.table.insertColumnRight.custom,
            click: () => {
                insertColumn(protyle, nodeElement, cellElement, "afterend", range);
            }
        });
    }
    menus.push(...insertMenus);
    const other2Menus: IMenu[] = [];
    if (((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
        (!previousHasNone || (previousHasNone && !previousHasRowSpan && previousHasColSpan))) ||
        ((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
            (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan))) ||
        (colIsPure && previousColIsPure) ||
        (colIsPure && nextColIsPure)
    ) {
        other2Menus.push({
            id: "separator_2",
            type: "separator"
        });
    }

    if ((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
        (!previousHasNone || (previousHasNone && !previousHasRowSpan && previousHasColSpan))) {
        other2Menus.push({
            id: "moveToUp",
            icon: "iconUp",
            label: siyuanI18n.moveToUp,
            accelerator: window.siyuan.config.keymap.editor.table.moveToUp.custom,
            click: () => {
                moveRowToUp(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if ((!hasNone || (hasNone && !hasRowSpan && hasColSpan)) &&
        (!nextHasNone || (nextHasNone && !nextHasRowSpan && nextHasColSpan))) {
        other2Menus.push({
            id: "moveToDown",
            icon: "iconDown",
            label: siyuanI18n.moveToDown,
            accelerator: window.siyuan.config.keymap.editor.table.moveToDown.custom,
            click: () => {
                moveRowToDown(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure && previousColIsPure) {
        other2Menus.push({
            id: "moveToLeft",
            icon: "iconLeft",
            label: siyuanI18n.moveToLeft,
            accelerator: window.siyuan.config.keymap.editor.table.moveToLeft.custom,
            click: () => {
                moveColumnToLeft(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure && nextColIsPure) {
        other2Menus.push({
            id: "moveToRight",
            icon: "iconRight",
            label: siyuanI18n.moveToRight,
            accelerator: window.siyuan.config.keymap.editor.table.moveToRight.custom,
            click: () => {
                moveColumnToRight(protyle, range, cellElement, nodeElement);
            }
        });
    }
    menus.push(...other2Menus);
    if ((cellElement.parentElement.parentElement.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) || colIsPure) {
        menus.push({
            type: "separator"
        });
    }
    const removeMenus = [];
    if (cellElement.parentElement.parentElement.tagName !== "THEAD" &&
        ((!hasNone && !hasRowSpan) || (hasNone && !hasRowSpan && hasColSpan))) {
        removeMenus.push({
            id: "deleteRow",
            icon: "iconDeleteRow",
            label: siyuanI18n["delete-row"],
            accelerator: window.siyuan.config.keymap.editor.table["delete-row"].custom,
            click: () => {
                deleteRow(protyle, range, cellElement, nodeElement);
            }
        });
    }
    if (colIsPure) {
        removeMenus.push({
            id: "deleteColumn",
            icon: "iconDeleteColumn",
            label: siyuanI18n["delete-column"],
            accelerator: window.siyuan.config.keymap.editor.table["delete-column"].custom,
            click: () => {
                deleteColumn(protyle, range, nodeElement, cellElement);
            }
        });
    }
    menus.push(...removeMenus);
    return { menus, removeMenus, insertMenus, otherMenus, other2Menus };
};

export const setFoldById = (data: {
    id: string,
    currentNodeID: string,
}, protyle: IProtyle) => {
    Array.from(protyle.wysiwyg.element.querySelectorAll(`[data-node-id="${data.id}"]`)).find((item: Element) => {
        if (!isInEmbedBlock(item)) {
            const operations = setFold(protyle, item, true, false, true, true);
            operations.doOperations[0].context = {
                focusId: data.currentNodeID,
            };
            transaction(protyle, operations.doOperations, operations.undoOperations);
            return true;
        }
    });
};

export const setFold = (protyle: IProtyle, nodeElement: Element, isOpen?: boolean,
    isRemove?: boolean, addLoading = true, getOperations = false) => {
    if (nodeElement.getAttribute("data-type") === "NodeListItem" && nodeElement.childElementCount < 4 &&
        // 该情况需要强制展开 https://github.com/siyuan-note/siyuan/issues/12327
        !isOpen) {
        // 没有子列表或多个块的列表项不进行折叠
        return { fold: -1 };
    }
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return { fold: -1 };
    }
    const hasFold = nodeElement.getAttribute("fold") === "1";
    if (hasFold) {
        if (typeof isOpen === "boolean" && !isOpen) {
            return { fold: -1 };
        }
        nodeElement.removeAttribute("fold");
        // https://github.com/siyuan-note/siyuan/issues/4411
        nodeElement.querySelectorAll(".protyle-linenumber__rows").forEach((item: HTMLElement) => {
            lineNumberRender(item.parentElement);
        });
    } else {
        if (typeof isOpen === "boolean" && isOpen) {
            return { fold: -1 };
        }
        nodeElement.setAttribute("fold", "1");
        // 光标在子列表中，再次 focus 段尾的时候不会变 https://ld246.com/article/1647099132461
        if (getSelection().rangeCount > 0) {
            const range = getSelection().getRangeAt(0);
            const blockElement = hasClosestBlock(range.startContainer);
            if (blockElement && blockElement.getBoundingClientRect().width === 0) {
                // https://github.com/siyuan-note/siyuan/issues/5833
                focusBlock(nodeElement, undefined, false);
            }
        }
        clearSelect(["img", "av"], nodeElement);
        scrollCenter(protyle, nodeElement);
    }
    const id = nodeElement.getAttribute("data-node-id");
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    if (nodeElement.getAttribute("data-type") === "NodeHeading") {
        if (hasFold) {
            if (addLoading) {
                nodeElement.insertAdjacentHTML("beforeend", '<div spin="1" style="text-align: center"><img width="24px" height="24px" src="/stage/loading-pure.svg"></div>');
            }
            doOperations.push({
                action: "unfoldHeading",
                id,
                data: isRemove ? "remove" : undefined,
            });
            undoOperations.push({
                action: "foldHeading",
                id
            });
        } else {
            doOperations.push({
                action: "foldHeading",
                id
            });
            undoOperations.push({
                action: "unfoldHeading",
                id
            });
            removeFoldHeading(nodeElement);
        }
    } else {
        doOperations.push({
            action: "setAttrs",
            id,
            data: JSON.stringify({ fold: hasFold ? "" : "1" })
        });
        undoOperations.push({
            action: "setAttrs",
            id,
            data: JSON.stringify({ fold: hasFold ? "1" : "" })
        });
    }
    if (!getOperations) {
        transaction(protyle, doOperations, undoOperations);
    }
    // 折叠后，防止滚动条滚动后调用 get 请求 https://github.com/siyuan-note/siyuan/issues/2248
    preventScroll(protyle);
    return { fold: !hasFold ? 1 : 0, undoOperations, doOperations };
};
