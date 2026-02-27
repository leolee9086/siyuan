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
import { isMobile } from "../../util/platform/functions";
import { dropEvent } from "../util/editorCommonEvent";
import { hideElements } from "../ui/hideElements";
import { keydown } from "./keydown";
import { isBrowserDesktop } from "../../platform";
import { getAllModels } from "../../layout/getAll";
import { stickyRow } from "../render/av/row";
import { clearSelect } from "../util/clearSelect";
import { renderCustomWithCtx } from "./utils/rendercustomWithCtx";
import { bindInputEvents } from "./index.input";
import { bindScrollEvent } from "./index.scroll";
import { handleCopy } from "./index.copy";
import { handleCut } from "./index.cut";
import { handleShiftSelect, handleCtrlSelect } from "./index.mousedown.select";
import { handleAvColResize, handleAvDragFill, handleAvCellSelect } from "./index.mousedown.av";
import { handleMediaResize, handleTableColResize } from "./index.mousedown.resize";
import { setupDragSelect } from "./index.mousedown.dragSelect";
import { handleContextmenu } from "./index.contextmenu";
import { handleClick } from "./index.click";

export class WYSIWYG {
    public lastHTMLs: { [key: string]: string } = {};
    public element: HTMLDivElement;
    public preventKeyup: boolean;

    private preventClick: boolean;

    constructor(protyle: IProtyle) {
        this.element = document.createElement("div");
        this.element.className = "protyle-wysiwyg";
        this.element.setAttribute("spellcheck", "false");
        if (isMobile()) {
            // iPhone，iPad 端输入 contenteditable 为 true 时会在块中间插入 span
            // Android 端空块输入法弹出会收起 https://ld246.com/article/1689713888289
            this.element.setAttribute("contenteditable", "false");
        } else {
            this.element.setAttribute("contenteditable", "true");
        }
        if (window.siyuan.config.editor.displayBookmarkIcon) {
            this.element.classList.add("protyle-wysiwyg--attr");
        }
        this.bindCommonEvent(protyle);
        this.bindEvent(protyle);
        if (protyle.options.action.includes(Constants.CB_GET_HISTORY)) {
            return;
        }
        keydown(protyle, this.element);
        dropEvent(protyle, this.element);
    }

    public renderCustom(ial: IObject) {
        renderCustomWithCtx({ ial, wysiwyg: this });
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
                getAllModels().outline.forEach(item => {
                    if (item.blockId === protyle.block.rootID) {
                        item.setCurrent(nodeElement);
                    }
                });
            }
        } else if (protyle.disabled) {
            protyle.toolbar.range = getEditorRange(nodeElement);
        }
    }

    private bindCommonEvent(protyle: IProtyle) {
        this.element.addEventListener("copy", (event: ClipboardEvent & { target: HTMLElement }) => {
            handleCopy(protyle, event);
        });

        this.element.addEventListener("mousedown", (event: MouseEvent) => {
            protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--hiderange");
            if (event.button === 2) {
                // 右键
                return;
            }
            const documentSelf = document;
            documentSelf.onmouseup = null;
            let target = event.target as HTMLElement;
            let nodeElement = hasClosestBlock(target) as HTMLElement;
            const hasSelectClassElement = this.element.querySelector(".protyle-wysiwyg--select");
            const galleryItemElement = hasClosestByClassName(target, "av__gallery-item");
            // shift+click 多选
            if (handleShiftSelect(protyle, event, nodeElement, hasSelectClassElement, galleryItemElement)) {
                return;
            }
            // ctrl+click 多选
            if (handleCtrlSelect(protyle, event, target, nodeElement, hasSelectClassElement, galleryItemElement, this.element)) {
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

            const protyleRect = protyle.element.getBoundingClientRect();
            const mostBottom = protyleRect.bottom;
            const y = event.clientY;
            const contentRect = protyle.contentElement.getBoundingClientRect();
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
            const targetCellElement = hasClosestByTag(target, "TH") || hasClosestByTag(target, "TD");
            if (targetCellElement) {
                target = targetCellElement;
            }
            if (target.tagName === "TH" || target.tagName === "TD" || target.firstElementChild?.tagName === "TABLE" ||
                target.classList.contains("table__resize") || target.classList.contains("table__select")) {
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
            if (handleTableColResize(protyle, event, target, nodeElement as HTMLElement, documentSelf)) {
                return;
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
                contentRect, wysiwygElement: this.element,
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

        this.element.addEventListener("focusout", () => {
            if (getSelection().rangeCount === 0) {
                return;
            }
            const range = getSelection().getRangeAt(0);
            if (this.element === range.startContainer || this.element.contains(range.startContainer)) {
                protyle.toolbar.range = range.cloneRange();
            }
        });

        this.element.addEventListener("cut", (event: ClipboardEvent & { target: HTMLElement }) => {
            handleCut(protyle, event);
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
        );

        const clickState = { mobileBlur: false };
        this.element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
            if (this.preventClick) {
                this.preventClick = false;
                return;
            }
            handleClick(protyle, event, this.element, this.setEmptyOutline.bind(this), clickState);
        });
    }
}
