import {
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByTag,
} from "../util/hasClosest";
import {
    getEditorRange,
} from "../util/selection";
import { Constants } from "../../constants";
import { isIPhone, isMobile } from "../../util/platform/functions";
import { dropEvent } from "../util/editorCommonEvent";
import { hideElements } from "../ui/hideElements";
import { keydown } from "./keydown";
import { isBrowserDesktop } from "../../platform";
import { setProtyleOutlineCurrent } from "../runtime/layout.port";
import { stickyRow } from "../render/av/row";
import { clearSelect } from "../util/clearSelect";
import { renderCustomWithCtx } from "./utils/rendercustomWithCtx";
import { bindInputEvents } from "./index.input";
import { PendingInputScheduler } from "./index.input.scheduler";
import { bindScrollEvent } from "./index.scroll";
import { handleCopy } from "./index.copy";
import { handleCut } from "./index.cut";
import { handleShiftSelect } from "./index.mousedown.select.shift";
import { handleCtrlSelect } from "./index.mousedown.select.ctrl";
import { handleAvColResize, handleAvDragFill, handleAvCellSelect } from "./index.mousedown.av";
import { handleMediaResize, handleSuperBlockResize, handleTableColResize } from "./index.mousedown.resize";
import { setupDragSelect } from "./index.mousedown.dragSelect";
import { handleContextmenu } from "./index.contextmenu";
import { handleClick } from "./index.click";
import { previewDocImage } from "../preview/image";
import { getDiagramBlock, previewDiagram } from "../preview/diagram";
import {transaction} from "./transaction/submit";
import { countSelectWord } from "../runtime/status.port";
import {wysiwygBrand} from "./domain/wysiwyg.types";
// 上游移植：数据库模板交互元素守卫（https://github.com/siyuan-note/siyuan/issues/12012）
import { getAVTemplateInteractiveElement } from "../render/av/attributeValue";
// 上游移植：双击列宽拖拽手柄自动适配列宽（https://github.com/siyuan-note/siyuan/issues/12952）
import {autoFitAVColumns} from "../render/av/col/width";
// 上游移植：数据库表格控件与大型列表虚拟化的类级接线
import { TableControl } from "../util/tableControl";
import { LargeListVirtualizer } from "./listVirtualization";

export class WYSIWYG {
    public get [wysiwygBrand]() {
        return "WYSIWYG" as const;
    }

    public lastHTMLs: { [key: string]: string } = {};
    public element: HTMLDivElement;
    public preventKeyup: boolean;
    public tableControl?: TableControl;

    private preventClick: boolean;
    private preventInput = false;
    private readonly inputScheduler = new PendingInputScheduler();
    private copyAsRichText = false;
    private largeListVirtualizer?: LargeListVirtualizer;

    constructor(protyle: IProtyle) {
        this.element = document.createElement("div");
        this.element.className = "protyle-wysiwyg";
        this.element.setAttribute("spellcheck", "false");
        // iPhone 根编辑宿主会绕过区块结构生成富文本 DOM，具体内容节点仍保持可编辑。
        this.element.setAttribute("contenteditable", isIPhone() ? "false" : "true");
        if (window.siyuan.config.editor.displayBookmarkIcon) {
            this.element.classList.add("protyle-wysiwyg--attr");
        }
        if (!isMobile()) {
            this.tableControl = new TableControl(protyle, this.element);
        }
        this.bindCommonEvent(protyle);
        this.bindEvent(protyle);
        if (protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
            return;
        }
        if (!isMobile() && !protyle.options.backlinkData && !protyle.lite) {
            this.largeListVirtualizer = new LargeListVirtualizer(protyle.element, this.element, protyle.id);
        }
        keydown(protyle, this.element);
        dropEvent(protyle, this.element);
    }

    public destroy() {
        this.largeListVirtualizer?.destroy();
    }

    public prepareLargeListVirtualization(contentElement: Element, replace: boolean) {
        this.largeListVirtualizer?.prepare(contentElement, replace);
    }

    public renderCustom(ial: Record<string, string>) {
        renderCustomWithCtx({ial, element: this.element});
    }

    public flushPendingInput() {
        this.inputScheduler.flush();
    }

    public copyRichText() {
        this.copyAsRichText = true;
        try {
            document.execCommand("copy");
        } finally {
            this.copyAsRichText = false;
        }
    }

    public withInputSuppressed<T>(callback: () => T) {
        const wasSuppressed = this.preventInput;
        this.preventInput = true;
        try {
            return callback();
        } finally {
            this.preventInput = wasSuppressed;
        }
    }


    private setEmptyOutline(protyle: IProtyle, element: HTMLElement) {
        let nodeElement = element;
        if (!element.getAttribute("data-node-id")) {
            const tempElement = hasClosestBlock(element);
            if (!tempElement) {
                return;
            }
            nodeElement = tempElement;
        }
        if (!isMobile()) {
            if (protyle.model) {
                setProtyleOutlineCurrent(protyle, nodeElement);
            }
        } else if (protyle.disabled) {
            protyle.toolbar.range = getEditorRange(nodeElement);
        }
    }

    private bindCommonEvent(protyle: IProtyle) {
        this.element.addEventListener("copy", async (event) => {
            const target = event.target;
            const clipboardData = event.clipboardData;
            if (!(target instanceof HTMLElement) || !clipboardData) {
                return;
            }
            await handleCopy(protyle, {
                target,
                clipboardData,
                preventDefault: () => event.preventDefault(),
                stopPropagation: () => event.stopPropagation(),
            });
        });

        this.element.addEventListener("mousedown", (event: MouseEvent) => {
            // 常规划选时排除属性占位，三击时恢复以保留浏览器的整段选择行为
            this.element.classList.toggle("protyle-wysiwyg--select-attr", event.button === 0 && event.detail > 2);
            if (protyle.toolbar.isMultiSelectMode()) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
            if (event.button === 2) {
                // 右键
                return;
            }
            if (getAVTemplateInteractiveElement(event.target)) {
                event.stopPropagation();
                return;
            }
            const documentSelf = document;
            documentSelf.onmouseup = null;
            let target = event.target as HTMLElement;
            const customElement = hasClosestByClassName(target, "protyle-custom");
            let nodeElement = hasClosestBlock(target) as HTMLElement;
            const hasSelectClassElement = this.element.querySelector(".protyle-wysiwyg--select");
            const galleryItemElement = hasClosestByClassName(target, "av__gallery-item");
            // shift+click 多选
            if (handleShiftSelect(protyle, {event, nodeElement, hasSelectClassElement, galleryItemElement})) {
                return;
            }
            // ctrl+click 多选
            if (handleCtrlSelect(protyle, {event, target, nodeElement, hasSelectClassElement, galleryItemElement, wysiwygElement: this.element})) {
                return;
            }

            // https://github.com/siyuan-note/siyuan/issues/15100
            if (galleryItemElement && !hasClosestByAttribute(target, "data-type", "av-gallery-more")) {
                documentSelf.onmouseup = () => {
                    documentSelf.onmousemove = null;
                    documentSelf.onmouseup = null;
                    documentSelf.ondragstart = null;
                    documentSelf.onselectstart = null;
                    documentSelf.onselect = null;
                    clearSelect(["galleryItem"], protyle.wysiwyg.element);
                    return false;
                };
                return;
            }
            const avDragFillElement = hasClosestByClassName(target, "av__drag-fill");
            // https://github.com/siyuan-note/siyuan/issues/3026
            hideElements(["select"], protyle);
            if (hasClosestByAttribute(target, "data-type", "av-gallery-more")) {
                clearSelect(["img", "row", "cell"], protyle.wysiwyg.element);
            } else if (!hasClosestByClassName(target, "av__firstcol") && !avDragFillElement) {
                clearSelect(["img", "av"], protyle.wysiwyg.element);
            }

            if ((hasClosestByClassName(target, "protyle-action") && !hasClosestByClassName(target, "code-block")) ||
                (hasClosestByClassName(target, "av__cell--header") && !hasClosestByClassName(target, "av__widthdrag"))) {
                return;
            }
            const wysiwygRect = protyle.wysiwyg.element.getBoundingClientRect();
            const wysiwygStyle = window.getComputedStyle(protyle.wysiwyg.element);
            const mostLeft = wysiwygRect.left + (parseInt(wysiwygStyle.paddingLeft) || 24) + 1;
            const mostRight = wysiwygRect.right - (parseInt(wysiwygStyle.paddingRight) || 16) - 2;
            const startsFromPadding = event.clientX < mostLeft - 1 || event.clientX > mostRight + 2 ||
                event.clientY < wysiwygRect.top + (parseFloat(wysiwygStyle.paddingTop) || 0) ||
                event.clientY > wysiwygRect.bottom - (parseFloat(wysiwygStyle.paddingBottom) || 0);
            const isBottomBacklink = !!protyle.element.closest(".sy__backlink--bottom");

            const protyleRect = protyle.element.getBoundingClientRect();
            const mostBottom = protyleRect.bottom;
            const y = event.clientY;
            const contentRect = protyle.contentElement.getBoundingClientRect();
            if (handleSuperBlockResize(protyle, event, target, documentSelf, () => {
                this.preventClick = true;
            })) {
                return;
            }
            // av col resize
            if (handleAvColResize(protyle, event, target, nodeElement as HTMLElement, contentRect, documentSelf, () => {
                this.preventClick = true;
            })) {
                return;
            }
            // av drag fill
            if (handleAvDragFill(protyle, event, avDragFillElement, nodeElement as HTMLElement, documentSelf, () => {
                this.preventClick = true;
            })) {
                return false;
            }
            // av cell select
            if (handleAvCellSelect(protyle, event, target, nodeElement as HTMLElement, contentRect, documentSelf, () => {
                this.preventClick = true;
            })) {
                return false;
            }
            // 图片、iframe、video、挂件缩放
            if (handleMediaResize(protyle, event, target, nodeElement as HTMLElement, mostRight, mostBottom, y, documentSelf)) {
                return;
            }
            // table cell select
            let tableBlockElement: HTMLElement | false;
            const targetCellElement = !customElement &&
                (hasClosestByTag(target, "TH") || hasClosestByTag(target, "TD"));
            if (targetCellElement) {
                target = targetCellElement;
            }
            if (!customElement &&
                (target.tagName === "TH" || target.tagName === "TD" || target.firstElementChild?.tagName === "TABLE" ||
                    target.classList.contains("table__resize") || target.classList.contains("table__select"))) {
                tableBlockElement = nodeElement;
                if (tableBlockElement) {
                    tableBlockElement.querySelector(".table__select").removeAttribute("style");
                    window.siyuan.menus.menu.remove();
                    hideElements(["toolbar"], protyle);
                    if (target.classList.contains("table__select")) {
                        target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement;
                        nodeElement = hasClosestBlock(target) as HTMLElement;
                    }
                    event.stopPropagation();
                }
                // 后续拖拽操作写在多选节点中
            }
            // table col resize
            if (!customElement && handleTableColResize(protyle, event, target, nodeElement as HTMLElement, documentSelf)) {
                return;
            }

            // 编辑器底部反链仅用于浏览和编辑，不参与块、数据库或表格框选
            if (isBottomBacklink && (startsFromPadding || tableBlockElement)) {
                return;
            }

            // Content-area drags use the browser range. Block selection is reserved for padding and table cells.
            if (!startsFromPadding && !tableBlockElement) {
                documentSelf.onmouseup = () => {
                    documentSelf.onmouseup = null;
                    setTimeout(() => {
                        const selection = getSelection();
                        if (selection.rangeCount === 0) {
                            return;
                        }
                        const range = selection.getRangeAt(0);
                        if (range.toString().replace(Constants.ZWSP, "") !== "") {
                            protyle.toolbar.render(protyle, range);
                            countSelectWord(range, protyle.block.rootID);
                        }
                    });
                };
                return;
            }
            if (startsFromPadding) {
                protyle.wysiwyg.element.classList.add("protyle-wysiwyg--hiderange");
            }

            // 多选节点
            let clentX = event.clientX;
            if (event.clientX > mostRight) {
                clentX = mostRight;
            } else if (event.clientX < mostLeft) {
                clentX = mostLeft;
            }
            const mostTop = protyleRect.top + (protyle.options.render.breadcrumb ? protyle.breadcrumb.element.parentElement.clientHeight : 0);

            setupDragSelect({
                protyle, event, target, nodeElement, tableBlockElement,
                documentSelf, clentX, mostTop, mostRight, mostLeft, mostBottom, y,
                contentRect, wysiwygElement: this.element, startsFromPadding, wysiwygRect, protyleRect,
            });
        });
    }

    private bindEvent(protyle: IProtyle) {
        // 删除块时，av 头尾需重新计算位置
        protyle.observer = new ResizeObserver(() => {
            const contentRect = protyle.contentElement.getBoundingClientRect();
            protyle.wysiwyg.element.querySelectorAll(".av").forEach((item: HTMLElement) => {
                if (item.querySelector(".av__scroll")) {
                    stickyRow(item, contentRect, "all");
                }
            });
        });

        this.element.addEventListener("focusout", (event) => {
            if (getAVTemplateInteractiveElement(event.target)) {
                event.stopPropagation();
                return;
            }
            if (getSelection().rangeCount === 0) {
                return;
            }
            const range = getSelection().getRangeAt(0);
            if (this.element === range.startContainer || this.element.contains(range.startContainer)) {
                protyle.toolbar.range = range.cloneRange();
            }
        });

        this.element.addEventListener("cut", (event) => {
            if (getAVTemplateInteractiveElement(event.target)) {
                event.stopPropagation();
                return;
            }
            const target = event.target;
            const clipboardData = event.clipboardData;
            if (!(target instanceof HTMLElement) || !clipboardData) {
                return;
            }
            void handleCut(protyle, {
                target,
                clipboardData,
                preventDefault: () => event.preventDefault(),
                stopPropagation: () => event.stopPropagation(),
            });
        });

        let beforeContextmenuRange: Range;
        this.element.addEventListener("contextmenu", (event: MouseEvent & { detail: any }) => {
            handleContextmenu(protyle, event, beforeContextmenuRange);
        });

        this.element.addEventListener("pointerdown", () => {
            if (getSelection().rangeCount > 0) {
                beforeContextmenuRange = getSelection().getRangeAt(0);
            } else {
                beforeContextmenuRange = undefined;
            }
            if (isBrowserDesktop && protyle.breadcrumb) {
                const indentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="indent"]');
                if (indentElement && getSelection().rangeCount > 0) {
                    setTimeout(() => {
                        const newRange = getSelection().getRangeAt(0);
                        const blockElement = hasClosestBlock(newRange.startContainer);
                        if (!blockElement) {
                            return;
                        }
                        const outdentElement = protyle.breadcrumb.element.parentElement.querySelector('[data-type="outdent"]');
                        if (blockElement.parentElement.classList.contains("li")) {
                            indentElement.removeAttribute("disabled");
                            outdentElement.removeAttribute("disabled");
                        } else {
                            indentElement.setAttribute("disabled", "true");
                            outdentElement.setAttribute("disabled", "true");
                        }
                    }, 520);
                }
            }
        });

        bindScrollEvent(protyle, this.element);

        bindInputEvents(
            protyle, this.element,
            () => this.preventKeyup,
            (v) => {
                this.preventKeyup = v;
            },
            this.setEmptyOutline.bind(this),
            () => this.preventInput,
            this.inputScheduler,
        );

        const clickState = { mobileBlur: false };
        this.element.addEventListener("dblclick", (event: MouseEvent) => {
            if (protyle.toolbar.isMultiSelectMode()) {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            if (getAVTemplateInteractiveElement(event.target)) {
                event.stopPropagation();
                return;
            }
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            // 双击数据库列宽拖拽手柄时自动适配该列宽度
            if (!protyle.disabled && target.classList.contains("av__widthdrag")) {
                const blockElement = hasClosestBlock(target) as HTMLElement;
                const columnID = target.parentElement?.getAttribute("data-col-id");
                if (blockElement && columnID) {
                    autoFitAVColumns(protyle, blockElement, [columnID]);
                }
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            // 双击超级块拖拽手柄，均分所有列宽。
            if (target.classList.contains("sb__resize")) {
                const parentElement = target.parentElement;
                if (!parentElement) {
                    return;
                }
                const doOperations: IOperation[] = [];
                const undoOperations: IOperation[] = [];
                for (const item of Array.from(parentElement.children)) {
                    if (!(item instanceof HTMLElement)) {
                        continue;
                    }
                    if (!item.style.width && !item.style.flex) {
                        continue;
                    }
                    const oldHTML = item.outerHTML;
                    item.style.width = "";
                    item.style.flex = "";
                    const id = item.getAttribute("data-node-id");
                    doOperations.push({ action: "update", id, data: item.outerHTML });
                    undoOperations.push({ action: "update", id, data: oldHTML });
                }

                if (doOperations.length > 0) {
                    transaction(protyle, doOperations, undoOperations);
                }
                event.stopPropagation();
                event.preventDefault();
                return;
            }
            if (target.tagName === "IMG" && !target.classList.contains("emoji")) {
                previewDocImage(target.getAttribute("src"), protyle.block.rootID);
                return;
            }
            // https://github.com/siyuan-note/siyuan/issues/12691
            const blockElement = hasClosestBlock(target);
            const diagramElement = blockElement instanceof HTMLElement ? getDiagramBlock(blockElement) : undefined;
            if (diagramElement) {
                previewDiagram(diagramElement);
                event.stopPropagation();
                event.preventDefault();
            }
        });
        this.element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
            if (this.preventClick) {
                this.preventClick = false;
                return;
            }
            handleClick(protyle, event, this.element, this.setEmptyOutline.bind(this), clickState);
        });
    }
}
