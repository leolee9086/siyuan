/**
 * Outline 拖拽排序功能
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { getAllModels } from "../../getAll";
import { transaction } from "../../../protyle/wysiwyg/transaction";
import { dragOverScroll, stopScrollAnimation } from "../../../boot/globalEvent/dragover";
import type { Outline } from "./Outline";

/**
 * 绑定拖拽排序事件
 */
export function bindSort(this: Outline) {
    this.element.addEventListener("mousedown", (event: MouseEvent) => {
        const item = hasClosestByClassName(event.target as HTMLElement, "b3-list-item");
        if (!item || item.tagName !== "LI" || this.element.getAttribute("data-loading") === "true") {
            return;
        }
        const documentSelf = document;
        documentSelf.ondragstart = () => false;
        let ghostElement: HTMLElement;
        let selectItem: HTMLElement;
        let editor: IProtyle;
        getAllModels().editor.find(editItem => {
            if (editItem.editor.protyle.block.rootID === this.blockId) {
                editor = editItem.editor.protyle;
                return true;
            }
        });
        const contentRect = this.element.getBoundingClientRect();
        documentSelf.onmousemove = (moveEvent: MouseEvent) => {
            if (!editor || editor.disabled || Math.abs(moveEvent.clientY - event.clientY) < 3 &&
                Math.abs(moveEvent.clientX - event.clientX) < 3) {
                return;
            }
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            if (!ghostElement) {
                item.style.opacity = "0.38";
                ghostElement = item.cloneNode(true) as HTMLElement;
                this.element.append(ghostElement);
                ghostElement.setAttribute("id", "dragGhost");
                ghostElement.firstElementChild.setAttribute("style", "padding-left:4px");
                ghostElement.setAttribute("style", `border-radius: var(--b3-border-radius);background-color: var(--b3-list-hover);position: fixed; top: ${event.clientY}px; left: ${event.clientX}px; z-index:999997;`);
            }
            ghostElement.style.top = moveEvent.clientY + "px";
            ghostElement.style.left = moveEvent.clientX + "px";
            dragOverScroll(moveEvent, contentRect, this.element);
            if (!this.element.contains(moveEvent.target as Element)) {
                this.element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current").forEach(item => {
                    item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
                });
                return;
            }
            selectItem = hasClosestByClassName(moveEvent.target as HTMLElement, "b3-list-item") as HTMLElement;
            if (!selectItem || selectItem.tagName !== "LI" || selectItem.style.position === "fixed") {
                return;
            }
            this.element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current").forEach(item => {
                item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
            });
            if (selectItem === item) {
                selectItem.classList.add("dragover__current");
                return;
            }
            const selectRect = selectItem.getBoundingClientRect();
            const dragHeight = selectRect.height * .2;
            if (moveEvent.clientY > selectRect.bottom - dragHeight) {
                selectItem.classList.add("dragover__bottom");
            } else if (moveEvent.clientY < selectRect.top + dragHeight) {
                selectItem.classList.add("dragover__top");
            } else {
                selectItem.classList.add("dragover");
            }
        };

        documentSelf.onmouseup = () => {
            documentSelf.onmousemove = null;
            documentSelf.onmouseup = null;
            documentSelf.ondragstart = null;
            documentSelf.onselectstart = null;
            documentSelf.onselect = null;
            ghostElement?.remove();
            item.style.opacity = "";
            // 清理滚动动画
            stopScrollAnimation();
            if (!selectItem) {
                selectItem = this.element.querySelector(".dragover__top, .dragover__bottom, .dragover");
            }
            let hasChange = true;
            if (selectItem && editor &&
                (selectItem.classList.contains("dragover__top") || selectItem.classList.contains("dragover__bottom") || selectItem.classList.contains("dragover"))) {
                let previousID;
                let parentID;
                const undoPreviousID = (item.previousElementSibling && item.previousElementSibling.tagName === "UL") ? item.previousElementSibling.previousElementSibling.getAttribute("data-node-id") : item.previousElementSibling?.getAttribute("data-node-id");
                const undoParentID = item.parentElement.previousElementSibling?.getAttribute("data-node-id");
                if (selectItem.classList.contains("dragover")) {
                    parentID = selectItem.getAttribute("data-node-id");
                    if (selectItem.nextElementSibling && selectItem.nextElementSibling.tagName === "UL") {
                        selectItem.nextElementSibling.insertAdjacentElement("afterbegin", item);
                    } else {
                        selectItem.insertAdjacentHTML("afterend", `<ul>${item.outerHTML}</ul>`);
                        item.remove();
                    }
                } else if (selectItem.classList.contains("dragover__top")) {
                    parentID = selectItem.parentElement.previousElementSibling?.getAttribute("data-node-id");
                    if (selectItem.previousElementSibling && selectItem.previousElementSibling.tagName === "UL") {
                        previousID = selectItem.previousElementSibling.previousElementSibling.getAttribute("data-node-id");
                    } else {
                        previousID = selectItem.previousElementSibling?.getAttribute("data-node-id");
                    }
                    if (previousID === item.dataset.nodeId || parentID === item.dataset.nodeId) {
                        hasChange = false;
                    } else {
                        selectItem.before(item);
                    }
                } else if (selectItem.classList.contains("dragover__bottom")) {
                    previousID = selectItem.getAttribute("data-node-id");
                    if (previousID === item.previousElementSibling?.getAttribute("data-node-id")) {
                        hasChange = false;
                    } else {
                        selectItem.after(item);
                    }
                }
                if (hasChange) {
                    this.element.setAttribute("data-loading", "true");

                    transaction(editor, [{
                        action: "moveOutlineHeading",
                        id: item.dataset.nodeId,
                        previousID,
                        parentID,
                    }], [{
                        action: "moveOutlineHeading",
                        id: item.dataset.nodeId,
                        previousID: undoPreviousID,
                        parentID: undoParentID,
                    }]);

                    // https://github.com/siyuan-note/siyuan/issues/10828#issuecomment-2044099675
                    editor.wysiwyg.element.querySelectorAll('[data-type="NodeHeading"] [contenteditable="true"][spellcheck]').forEach(item => {
                        item.setAttribute("contenteditable", "false");
                    });
                    return true;
                }
            }
            this.element.querySelectorAll(".dragover__top, .dragover__bottom, .dragover, .dragover__current").forEach(item => {
                item.classList.remove("dragover__top", "dragover__bottom", "dragover", "dragover__current");
            });
        };
    });
}
