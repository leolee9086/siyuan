import {Tree} from "../../util/file/tree/Tree";
import {fetchPost} from "../../util/network/fetch";
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
import {Constants} from "../../constants";
import {getPreviousBlock} from "../../protyle/wysiwyg/getBlock";
import type {AppFacade} from "../../app/AppFacade.types";
import {checkFold} from "../../block/fold/checkFold";
import {openMobileFileById} from "../editor";
import {Model} from "../../layout/Model";
import {genUUID} from "../../util/platform/genID";
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import {showContextMenu} from "./MobileOutline.contextMenu";
import {setFilter, showExpandLevelMenu, handleOutlineTransaction, bindKeepCurrentExpandEvent} from "./MobileOutline.expand";
import {getDocDisplayName} from "../../util/file/pathName";
import {isEncryptedBox} from "../../util/file/notebook/store";
import {escapeHtml} from "../../util/DOM/escape";
import {unicode2Emoji} from "../../emoji";
import {bindOutlineSort} from "./MobileOutline.sort";
import {transactionsMayChangeRootHeadingNumberSetting} from "../../protyle/util/headingNumberCore";
import {dragOverScroll, stopScrollAnimation} from "../../boot/globalEvent/dragover";
import {bindMousePointerTouchBridge, isMousePointerTouchEvent} from "../util/mousePointerTouchBridge";
import {transaction} from "../../protyle/wysiwyg/transaction/submit";

export class MobileOutline extends Model<AppFacade> {
    public tree: Tree;
    public element: HTMLElement;
    public blockId: string;
    public isPreview: boolean;
    public preFilterExpandIds: string[] | null = null;
    private reloadId = 0;
    private touchDragState: {
        selectedElement: HTMLElement;
        startX: number;
        startY: number;
        isDragging: boolean;
        ghostElement: HTMLElement | null;
        startTime: number;
        selectItem: HTMLElement | null;
    } | null = null;

    constructor(options: {
        app: AppFacade,
        blockId: string,
        isPreview: boolean,
        element?: HTMLElement
    }) {
        super({app: options.app});
        this.connect({
            id: genUUID(),
            type: "outline",
            msgCallback: this.handleMsgCallback.bind(this)
        });

        this.isPreview = options.isPreview;
        this.blockId = options.blockId;
        const fallbackElement = document.querySelector<HTMLElement>('#sidebar [data-type="sidebar-outline"]');
        const targetElement = options.element ?? fallbackElement;
        if (!targetElement) {
            throw new Error("MobileOutline: sidebar-outline element not found");
        }
        this.element = targetElement;
        const keepCurrentExpand = window.siyuan?.storage?.[Constants.LOCAL_OUTLINE]?.keepCurrentExpand;
        this.element.innerHTML = `<div class="toolbar toolbar--border toolbar--dark">
    <div class="fn__space"></div>
    <div class="toolbar__text">
        ${siyuanI18n.outline}
    </div>
    <div class="fn__flex-1 fn__space"></div>
    <input class="b3-text-field search__label fn__none fn__size200" placeholder="${siyuanI18n.filterKeywordEnter}" />
    <svg data-type="search" class="toolbar__icon"><use xlink:href='#iconFilter'></use></svg>
    <svg data-type="keepCurrentExpand" class="toolbar__icon${keepCurrentExpand ? " toolbar__icon--active" : ""}"><use xlink:href="#iconFocus"></use></svg>
    <svg data-type="expandLevel" class="toolbar__icon"><use xlink:href="#iconList"></use></svg>
    <svg data-type="expand" class="toolbar__icon"><use xlink:href="#iconExpand"></use></svg>
    <svg data-type="collapse" class="toolbar__icon"><use xlink:href="#iconContract"></use></svg>
</div>
<div class="b3-list-item fn__none" data-type="doc-title"></div>
<div class="fn__flex-1" style="padding: 3px 0 8px"></div>`;
        const inputElement = this.element.querySelector<HTMLInputElement>("input.b3-text-field.search__label");
        if (!inputElement) {
            throw new Error("MobileOutline: search input not found");
        }
        inputElement.addEventListener("blur", () => {
            inputElement.classList.add("fn__none");
            const filterIconElement = inputElement.nextElementSibling as HTMLElement | null;
            if (!filterIconElement) {
                return;
            }
            const value = inputElement.value;
            if (value) {
                filterIconElement.classList.add("toolbar__icon--active");
            } else {
                filterIconElement.classList.remove("toolbar__icon--active");
            }
        });
        inputElement.addEventListener("input", (event: Event) => {
            const inputEvent = event as InputEvent;
            if (!inputEvent.isComposing) {
                setFilter(this);
            }
        });
        inputElement.addEventListener("compositionend", () => setFilter(this));
        const treeContainer = this.element.lastElementChild as HTMLElement | null;
        if (!treeContainer) {
            throw new Error("MobileOutline: tree container not found");
        }
        this.tree = new Tree({
            element: treeContainer,
            data: null,
            click: (element: HTMLElement, event) => {
                if (event) {
                    const actionElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item__action");
                    if (actionElement) {
                        showContextMenu(this, element);
                        return;
                    }
                }
                const id = element.getAttribute("data-node-id");
                if (!id) {
                    return;
                }
                if (this.isPreview) {
                    const headElement = document.getElementById(id);
                    if (headElement) {
                        headElement.scrollIntoView();
                    } else {
                        openMobileFileById(options.app, this.blockId);
                    }
                } else {
                    checkFold(id, (zoomIn) => {
                        openMobileFileById(options.app, id, zoomIn ? [Constants.CB_GET_HL, Constants.CB_GET_ALL, Constants.CB_GET_HTML, Constants.CB_GET_OUTLINE] :
                                [Constants.CB_GET_HL, Constants.CB_GET_OUTLINE, Constants.CB_GET_SETID, Constants.CB_GET_CONTEXT, Constants.CB_GET_HTML],
                            "start");
                    });
                }
            },
            toggleClick: (liElement) => {
                if (!liElement.nextElementSibling) {
                    return;
                }
                const firstChild = liElement.firstElementChild;
                if (!firstChild) {
                    return;
                }
                const svgElement = firstChild.firstElementChild as Element | null;
                if (!svgElement) {
                    return;
                }
                if (svgElement.classList.contains("b3-list-item__arrow--open")) {
                    svgElement.classList.remove("b3-list-item__arrow--open");
                    liElement.nextElementSibling.classList.add("fn__none");
                    if (liElement.nextElementSibling.nextElementSibling && liElement.nextElementSibling.nextElementSibling.tagName === "UL") {
                        (liElement.nextElementSibling.nextElementSibling as HTMLElement).classList.add("fn__none");
                    }
                } else {
                    svgElement.classList.add("b3-list-item__arrow--open");
                    liElement.nextElementSibling.classList.remove("fn__none");
                    if (liElement.nextElementSibling.nextElementSibling && liElement.nextElementSibling.nextElementSibling.tagName === "UL") {
                        (liElement.nextElementSibling.nextElementSibling as HTMLElement).classList.remove("fn__none");
                    }
                }
                this.saveExpendIds();
            },
            blockExtHTML: window.siyuan?.config?.readonly ? undefined : '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
            topExtHTML: window.siyuan?.config?.readonly ? undefined : '<span class="b3-list-item__action"><svg><use xlink:href="#iconMore"></use></svg></span>',
        });
        // 为了快捷键的 dispatch
        this.element.querySelector('[data-type="collapse"]')?.addEventListener("click", () => {
            this.tree.collapseAll();
            this.saveExpendIds();
        });

        // 普通的全部展开按钮
        this.element.querySelector('[data-type="expand"]')?.addEventListener("click", () => {
            this.tree.expandAll();
            this.saveExpendIds();
        });

        // 保持当前标题展开功能
        bindKeepCurrentExpandEvent(this);
        this.element.addEventListener("click", (event: MouseEvent) => {
            let target = event.target as HTMLElement | null;
            if (!target) {
                return;
            }
            if (target.tagName === "INPUT") {
                return;
            }
            while (target && !target.isEqualNode(this.element)) {
                if (target.classList.contains("toolbar__icon")) {
                    const type = target.getAttribute("data-type");
                    switch (type) {
                        case "search":
                            inputElement.classList.remove("fn__none");
                            inputElement.select();
                            break;
                        case "expandLevel":
                            showExpandLevelMenu(this);
                            event.preventDefault();
                            event.stopPropagation();
                            break;
                    }
                    break;
                }
                target = target.parentElement;
            }
        });

        bindOutlineSort(this);
        this.element.querySelector('[data-type="doc-title"]')?.addEventListener("click", () => {
            openMobileFileById(this.app, this.blockId);
        });
        this.reload();
        this.bindTouchDrag();
    }

    private handleMsgCallback(data: IWebSocketData) {
        if (data) {
            switch (data.cmd) {
                case "savedoc":
                    this.onTransaction(data);
                    break;
                case "transactions":
                    if (transactionsMayChangeRootHeadingNumberSetting(data.data, this.blockId)) {
                        this.reload();
                    }
                    break;
                case "rename":
                    if (this.blockId === data.data.id) {
                        this.updateDocTitle({
                            title: data.data.title,
                            icon: Constants.ZWSP,
                            [Constants.CUSTOM_SY_TITLE_EMPTY]: data.data.empty ? "true" : "false",
                        }, -1);
                    }
                    break;
            }
        }
    }

    public setCurrent(nodeElement: HTMLElement) {
        if (!nodeElement) {
            return;
        }
        if (nodeElement.getAttribute("data-type") === "NodeHeading" &&
            !hasClosestByClassName(nodeElement, "bq") &&
            !hasClosestByClassName(nodeElement, "callout-content")) {
            const nodeId = nodeElement.getAttribute("data-node-id");
            if (!nodeId) {
                return;
            }
            this.setCurrentById(nodeId);
        } else {
            let previousElement: Element | false | null | undefined = getPreviousBlock(nodeElement);
            while (previousElement) {
                if ((previousElement as Element).getAttribute("data-type") === "NodeHeading") {
                    break;
                } else {
                    previousElement = getPreviousBlock(previousElement as Element);
                }
            }
            if (previousElement) {
                const prevId = (previousElement as Element).getAttribute("data-node-id");
                if (prevId) {
                    this.setCurrentById(prevId);
                }
            } else {
                const nodeId = nodeElement.getAttribute("data-node-id");
                if (!nodeId) {
                    return;
                }
                const breadcrumbParam: Record<string, unknown> = {
                    id: nodeId,
                    excludeTypes: [] as string[],
                };
                const mobileProtyle = window.siyuan?.mobile?.editor?.protyle;
                if (mobileProtyle && mobileProtyle.block.rootID === this.blockId && mobileProtyle.notebookId && isEncryptedBox(mobileProtyle.notebookId)) {
                    breadcrumbParam.notebook = mobileProtyle.notebookId;
                }
                fetchPost("/api/block/getBlockBreadcrumb", breadcrumbParam, (response) => {
                    response.data.reverse().find((item: IBreadcrumb) => {
                        if (item.type === "NodeHeading") {
                            this.setCurrentById(item.id);
                            return true;
                        }
                        return false;
                    });
                });
            }
        }
    }

    public setCurrentByPreview(nodeElement: Element) {
        if (!nodeElement) {
            return;
        }
        let previousElement: Element | null = nodeElement;
        while (previousElement && !previousElement.classList.contains("b3-typography")) {
            if (["H1", "H2", "H3", "H4", "H5", "H6"].includes(previousElement.tagName)) {
                break;
            } else {
                previousElement = previousElement.previousElementSibling || previousElement.parentElement;
            }
        }
        if (previousElement && previousElement.id) {
            this.setCurrentById(previousElement.id);
        }
    }

    public setCurrentById(id: string) {
        this.element.querySelectorAll(".b3-list-item.b3-list-item--focus").forEach(item => {
            item.classList.remove("b3-list-item--focus");
        });
        let currentElement = this.element.querySelector<HTMLElement>(`.b3-list-item[data-node-id="${id}"]`);
        if (!currentElement) {
            return;
        }
        if (window.siyuan?.storage?.[Constants.LOCAL_OUTLINE]?.keepCurrentExpand) {
            let ulElement: HTMLElement | null = currentElement.parentElement;
            while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
                ulElement.classList.remove("fn__none");
                const prevSibling = ulElement.previousElementSibling as HTMLElement | null;
                const arrow = prevSibling?.querySelector(".b3-list-item__arrow");
                arrow?.classList.add("b3-list-item__arrow--open");
                ulElement = ulElement.parentElement;
            }
            this.saveExpendIds();
        } else {
            while (currentElement && currentElement.clientHeight === 0) {
                const parent = currentElement.parentElement;
                if (!parent) {
                    break;
                }
                const prev = parent.previousElementSibling as HTMLElement | null;
                if (!prev) {
                    break;
                }
                currentElement = prev;
            }
        }
        if (currentElement) {
            currentElement.classList.add("b3-list-item--focus");
            const elementRect = this.tree.element.getBoundingClientRect();
            this.tree.element.scrollTop += currentElement.getBoundingClientRect().top -
                (elementRect.top + elementRect.height / 2);
        }
    }

    public reload(callback?: () => void) {
        const protyle = window.siyuan?.mobile?.editor?.protyle;
        const blockId = protyle?.block.rootID || this.blockId;
        if (!blockId) {
            return;
        }
        const isPreview = protyle ? !protyle.preview.element.classList.contains("fn__none") : this.isPreview;
        if (blockId !== this.blockId) {
            this.tree.updateData(null);
            this.updateDocTitle();
            this.tree.element.scrollTop = 0;
        }
        this.blockId = blockId;
        this.isPreview = isPreview;
        const reloadId = ++this.reloadId;
        const outlineParam: IObject = {id: blockId, preview: isPreview};
        if (protyle?.notebookId && isEncryptedBox(protyle.notebookId)) {
            outlineParam.notebook = protyle.notebookId;
        }
        fetchPost("/api/outline/getDocOutline", outlineParam, (response) => {
            const currentProtyle = window.siyuan?.mobile?.editor?.protyle;
            if (reloadId !== this.reloadId || (currentProtyle && currentProtyle.block.rootID !== blockId)) {
                return;
            }
            this.update(response);
            this.updateDocTitle(protyle?.background?.ial as Record<string, string> | undefined, response.data?.length || 0);
            callback?.();
        });
    }

    public update(data: IWebSocketData) {
        let currentElement = this.element.querySelector(".b3-list-item--focus");
        let currentId: string | null | undefined;
        if (currentElement) {
            currentId = currentElement.getAttribute("data-node-id");
        }
        const scrollTop = this.tree.element.scrollTop;
        this.tree.updateData(data.data);

        if (this.isPreview) {
            this.tree.element.querySelectorAll(".popover__block").forEach(item => {
                (item as HTMLElement).classList.remove("popover__block");
            });
            this.tree.element.scrollTop = scrollTop;
        } else if (this.blockId) {
            const filterInput = this.element.querySelector<HTMLInputElement>("input.b3-text-field.search__label");
            if (filterInput?.value) {
                setFilter(this);
            }
            this.tree.element.scrollTop = scrollTop;
        }
        if (currentId) {
            currentElement = this.element.querySelector(`[data-node-id="${currentId}"]`);
            if (currentElement) {
                currentElement.classList.add("b3-list-item--focus");
            }
        }
        this.element.removeAttribute("data-loading");
    }

    public updateDocTitle(ial?: Record<string, string>, count?: number) {
        const docTitleElement = this.element.querySelector<HTMLElement>('[data-type="doc-title"]');
        if (!docTitleElement) {
            return;
        }
        if (this.isPreview || !ial) {
            docTitleElement.classList.add("fn__none");
            return;
        }
        let iconHTML = unicode2Emoji(
            ial.icon || window.siyuan?.storage?.[Constants.LOCAL_IMAGES]?.file || "",
            "b3-list-item__graphic",
            true
        );
        if (ial.icon === Constants.ZWSP && docTitleElement.firstElementChild) {
            iconHTML = (docTitleElement.firstElementChild as HTMLElement).outerHTML;
        }
        const title = getDocDisplayName(ial.title ?? "", ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true");
        const counterHTML = docTitleElement.querySelector(".counter")?.outerHTML || "";
        docTitleElement.innerHTML = `${iconHTML}<span class="b3-list-item__text">${escapeHtml(title)}</span>${counterHTML}`;
        docTitleElement.title = title;
        docTitleElement.classList.remove("fn__none");
        if (typeof count !== "number" || count === -1) {
            return;
        }
        const counterElement = docTitleElement.querySelector<HTMLElement>(".counter");
        if (count > 0) {
            if (counterElement) {
                counterElement.textContent = count.toString();
            } else {
                docTitleElement.insertAdjacentHTML("beforeend", `<span class="counter">${count}</span>`);
            }
        } else {
            counterElement?.remove();
        }
    }

    public saveExpendIds() {
        if (window.siyuan?.config?.readonly || window.siyuan?.isPublish) {
            return;
        }

        if (!this.isPreview) {
            fetchPost("/api/storage/setOutlineStorage", {
                docID: this.blockId,
                val: {
                    expandIds: this.tree.getExpandIds()
                }
            });
        }
    }

    private onTransaction(data: IWebSocketData) {
        handleOutlineTransaction(this, data);
    }

    private bindTouchDrag() {
        const scrollElement = this.element.lastElementChild as HTMLElement | null;
        if (!scrollElement) {
            return;
        }
        const contentRect = () => scrollElement.getBoundingClientRect();
        this.element.addEventListener("touchstart", (event: TouchEvent) => {
            if (this.element.getAttribute("data-loading") === "true") return;
            if (event.touches.length !== 1) return;
            const editor = window.siyuan?.mobile?.editor?.protyle;
            if (!editor || editor.disabled || editor.block.rootID !== this.blockId) return;
            const touch = event.touches[0];
            if (!touch) {
                return;
            }
            const liElement = hasClosestByClassName(touch.target as HTMLElement, "b3-list-item") as HTMLElement | null;
            if (!liElement || liElement.tagName !== "LI") return;
            this.touchDragState = {
                selectedElement: liElement,
                startX: touch.clientX,
                startY: touch.clientY,
                isDragging: false,
                ghostElement: null,
                startTime: Date.now() - (isMousePointerTouchEvent(event) ? Constants.TIMEOUT_LONGPRESS : 0),
                selectItem: null,
            };
            if (!isMousePointerTouchEvent(event)) {
                const state = this.touchDragState;
                if (!state) {
                    return;
                }
                window.setTimeout(() => {
                    if (this.touchDragState !== state) {
                        return;
                    }
                    this.startTouchDrag(state, state.startX, state.startY, true);
                }, Constants.TIMEOUT_LONGPRESS);
            }
        }, {passive: false});
        this.element.addEventListener("touchmove", (event: TouchEvent) => {
            const state = this.touchDragState;
            if (!state) return;
            const touch = event.touches[0];
            if (!touch) {
                return;
            }
            if (!state.isDragging) {
                if (Date.now() - state.startTime < Constants.TIMEOUT_LONGPRESS &&
                    (Math.abs(touch.clientX - state.startX) > Constants.SIZE_DRAG_THRESHOLD ||
                        Math.abs(touch.clientY - state.startY) > Constants.SIZE_DRAG_THRESHOLD)) {
                    this.touchDragState = null;
                    return;
                }
                if (Math.abs(touch.clientX - state.startX) < Constants.SIZE_DRAG_THRESHOLD &&
                    Math.abs(touch.clientY - state.startY) < Constants.SIZE_DRAG_THRESHOLD) return;
                this.startTouchDrag(state, touch.clientX, touch.clientY, !isMousePointerTouchEvent(event));
            }
            event.preventDefault();
            event.stopPropagation();
            if (!state.ghostElement) {
                return;
            }
            state.ghostElement.style.top = touch.clientY + "px";
            state.ghostElement.style.left = touch.clientX + "px";
            dragOverScroll({clientY: touch.clientY} as MouseEvent, contentRect(), scrollElement);
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const selectItem = target?.closest(".b3-list-item") as HTMLElement | null;
            if (!selectItem || selectItem.tagName !== "LI" || !scrollElement.contains(selectItem)) {
                this.clearDragIndicators();
                state.selectItem = null;
                return;
            }
            this.clearDragIndicators();
            if (selectItem === state.selectedElement) {
                selectItem.classList.add("dragover__current");
                return;
            }
            const selectRect = selectItem.getBoundingClientRect();
            const dragHeight = selectRect.height * .2;
            if (touch.clientY > selectRect.bottom - dragHeight) {
                selectItem.classList.add("dragover__bottom");
            } else if (touch.clientY < selectRect.top + dragHeight) {
                selectItem.classList.add("dragover__top");
            } else {
                selectItem.classList.add("dragover");
            }
            state.selectItem = selectItem;
        }, {passive: false});
        this.element.addEventListener("touchend", () => {
            const state = this.touchDragState;
            if (!state) return;
            stopScrollAnimation();
            state.selectedElement.style.opacity = "";
            const item = state.selectedElement;
            if (state.isDragging) {
                state.ghostElement?.remove();
                let selectItem = state.selectItem;
                if (!selectItem) {
                    selectItem = this.element.querySelector<HTMLElement>(".dragover__top, .dragover__bottom, .dragover");
                }
                const editor = window.siyuan?.mobile?.editor?.protyle;
                let hasChange = true;
                if (selectItem && editor &&
                    (selectItem.classList.contains("dragover__top") || selectItem.classList.contains("dragover__bottom") || selectItem.classList.contains("dragover"))) {
                    let previousID: string | undefined;
                    let parentID: string | undefined;
                    const undoPreviousID = (item.previousElementSibling && item.previousElementSibling.tagName === "UL") ? (item.previousElementSibling.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id") ?? undefined : (item.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id") ?? undefined;
                    const undoParentID = (item.parentElement?.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id") ?? undefined;
                    if (selectItem.classList.contains("dragover")) {
                        parentID = selectItem.getAttribute("data-node-id") ?? undefined;
                        if (selectItem.nextElementSibling && selectItem.nextElementSibling.tagName === "UL") {
                            (selectItem.nextElementSibling as HTMLElement).insertAdjacentElement("afterbegin", item);
                        } else {
                            selectItem.insertAdjacentHTML("afterend", `<ul>${item.outerHTML}</ul>`);
                            item.remove();
                        }
                    } else if (selectItem.classList.contains("dragover__top")) {
                        parentID = (selectItem.parentElement?.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id") ?? undefined;
                        if (selectItem.previousElementSibling && selectItem.previousElementSibling.tagName === "UL") {
                            previousID = (selectItem.previousElementSibling.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id") ?? undefined;
                        } else {
                            previousID = (selectItem.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id") ?? undefined;
                        }
                        if (previousID === item.dataset.nodeId || parentID === item.dataset.nodeId) {
                            hasChange = false;
                        } else {
                            selectItem.before(item);
                        }
                    } else if (selectItem.classList.contains("dragover__bottom")) {
                        previousID = selectItem.getAttribute("data-node-id") ?? undefined;
                        if (previousID === (item.previousElementSibling as HTMLElement | null)?.getAttribute("data-node-id")) {
                            hasChange = false;
                        } else {
                            selectItem.after(item);
                        }
                    }
                    if (hasChange) {
                        const itemId = item.dataset.nodeId;
                        if (!itemId) {
                            hasChange = false;
                        } else {
                            this.element.setAttribute("data-loading", "true");
                            transaction(editor, [{
                                action: "moveOutlineHeading",
                                id: itemId,
                                previousID,
                                parentID,
                            }], [{
                                action: "moveOutlineHeading",
                                id: itemId,
                                previousID: undoPreviousID,
                                parentID: undoParentID,
                            }]);
                            editor.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"] [contenteditable="true"][spellcheck]').forEach((headingItem: Element) => {
                                (headingItem as HTMLElement).setAttribute("contenteditable", "false");
                            });
                        }
                    }
                }
                this.clearDragIndicators();
            }
            this.touchDragState = null;
        });
        const cancelTouchDrag = () => {
            stopScrollAnimation();
            if (this.touchDragState?.ghostElement) {
                this.touchDragState.ghostElement.remove();
            }
            if (this.touchDragState?.selectedElement) {
                this.touchDragState.selectedElement.style.opacity = "";
            }
            this.clearDragIndicators();
            this.touchDragState = null;
        };
        this.element.addEventListener("touchcancel", cancelTouchDrag);
        this.element.addEventListener("pointercancel", cancelTouchDrag);
        window.addEventListener("blur", cancelTouchDrag);
        bindMousePointerTouchBridge(this.element);
    }

    private startTouchDrag(state: NonNullable<MobileOutline["touchDragState"]>, clientX: number, clientY: number, vibrate = false) {
        if (!state) {
            return;
        }
        if (state.isDragging) {
            return;
        }
        state.isDragging = true;
        state.selectedElement.style.opacity = "0.38";
        const ghostElement = state.selectedElement.cloneNode(true) as HTMLElement;
        ghostElement.setAttribute("id", "dragGhost");
        const firstChild = ghostElement.firstElementChild as HTMLElement | null;
        firstChild?.setAttribute("style", "padding-left:4px");
        ghostElement.setAttribute("style", `border-radius: var(--b3-border-radius);background-color: var(--b3-list-hover);pointer-events:none;position: fixed; top: ${clientY}px; left: ${clientX}px; z-index:999997;`);
        document.body.append(ghostElement);
        state.ghostElement = ghostElement;
        if (vibrate) {
            if (window.webkit?.messageHandlers.vibrate) {
                window.webkit.messageHandlers.vibrate.postMessage("");
            } else if (navigator.vibrate) {
                navigator.vibrate(Constants.TIMEOUT_VIBRATION_DURATION);
            }
        }
    }

    private clearDragIndicators = () => {
        this.element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current").forEach(item => {
            (item as HTMLElement).classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
        });
    };
}
