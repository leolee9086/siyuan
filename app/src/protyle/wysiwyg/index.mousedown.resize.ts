import {updateTransaction} from "./transaction";
import {img3115} from "../../boot/compatibleVersion";
import * as dayjs from "dayjs";

/**
 * 处理超级块横向布局下的子块宽度拖拽。
 * @returns true 表示已处理（调用方应 return）
 */
export function handleSuperBlockResize(
    protyle: IProtyle,
    event: MouseEvent,
    target: HTMLElement,
    documentSelf: Document,
    setPreventClick: () => void,
): boolean {
    if (protyle.disabled || !target.classList.contains("sb__resize")) {
        return false;
    }
    const sbElement = target.parentElement;
    const previousElement = target.previousElementSibling as HTMLElement;
    if (!sbElement || !previousElement || !previousElement.hasAttribute("data-node-id") ||
        sbElement.getAttribute("data-sb-layout") !== "col") {
        return true;
    }
    const x = event.clientX;
    const sbWidth = sbElement.clientWidth;
    const oldWidth = previousElement.clientWidth;
    const oldHTML = previousElement.outerHTML;
    target.classList.add("sb__resize--drag");
    // @ts-ignore
    previousElement.style.webkitUserModify = "read-only";
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        let newWidth = oldWidth + (moveEvent.clientX - x);
        newWidth = Math.max(sbWidth * 0.1, Math.min(sbWidth * 0.9, newWidth));
        previousElement.style.width = newWidth + "px";
        previousElement.style.flex = "none";
    };

    documentSelf.onmouseup = () => {
        target.classList.remove("sb__resize--drag");
        // @ts-ignore
        previousElement.style.webkitUserModify = "";
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        const pct = Math.round(previousElement.clientWidth / sbWidth * 1000) / 10;
        previousElement.style.width = pct + "%";
        previousElement.style.flex = "none";
        previousElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
        updateTransaction(protyle, previousElement, oldHTML);
    };
    setPreventClick();
    event.preventDefault();
    return true;
}

/**
 * 处理图片、iframe、video、挂件缩放拖拽。
 * @returns true 表示已处理（调用方应 return）
 */
export function handleMediaResize(
    protyle: IProtyle,
    event: MouseEvent,
    target: HTMLElement,
    nodeElement: HTMLElement,
    mostRight: number,
    mostBottom: number,
    y: number,
    documentSelf: Document,
): boolean {
    if (protyle.disabled || !target.classList.contains("protyle-action__drag")) {
        return false;
    }
    if (!nodeElement) {
        return true;
    }
    let isCenter = true;
    if ("NodeVideo" === nodeElement.dataset.type) {
        nodeElement.classList.add("iframe--drag");
        if (["left", "right", ""].includes(nodeElement.style.textAlign)) {
            isCenter = false;
        }
    } else if (["NodeIFrame", "NodeWidget"].includes(nodeElement.dataset.type)) {
        nodeElement.classList.add("iframe--drag");
        if (!nodeElement.style.margin) {
            isCenter = false;
        }
    } else if (target.parentElement.parentElement.getAttribute("data-type") === "img") {
        target.parentElement.parentElement.classList.add("img--drag");
    }

    const html = nodeElement.outerHTML;
    const x = event.clientX;
    const dragElement = target.previousElementSibling as HTMLElement;
    const dragWidth = dragElement.clientWidth;
    const dragHeight = dragElement.clientHeight;

    const imgElement = dragElement.parentElement.parentElement;
    if (dragElement.tagName === "IMG") {
        img3115(imgElement);
    }
    // 3.4.1 以前历史数据兼容
    if (dragElement.tagName === "IFRAME") {
        dragElement.style.height = "";
        dragElement.style.width = "";
    }
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        if (dragElement.tagName === "IMG") {
            dragElement.style.height = "";
        }
        if (moveEvent.clientX > x - dragWidth + 8 && moveEvent.clientX < mostRight) {
            const multiple = ((dragElement.tagName === "IMG" && !imgElement.style.minWidth && nodeElement.style.textAlign !== "center") || !isCenter) ? 1 : 2;
            if (dragElement.tagName === "IMG") {
                dragElement.parentElement.style.width = Math.max(17, dragWidth + (moveEvent.clientX - x) * multiple) + "px";
            } else if (dragElement.tagName === "IFRAME") {
                nodeElement.style.width = Math.max(17, dragWidth + (moveEvent.clientX - x) * multiple) + "px";
            } else {
                dragElement.style.width = Math.max(17, dragWidth + (moveEvent.clientX - x) * multiple) + "px";
            }
        }
        if (dragElement.tagName !== "IMG") {
            if (moveEvent.clientY > y - dragHeight + 8 && moveEvent.clientY < mostBottom) {
                if (dragElement.tagName === "IFRAME") {
                    nodeElement.style.height = (dragHeight + (moveEvent.clientY - y)) + "px";
                } else {
                    dragElement.style.height = (dragHeight + (moveEvent.clientY - y)) + "px";
                }
            }
        }
    };

    documentSelf.onmouseup = () => {
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        if (target.classList.contains("protyle-action__drag") && nodeElement) {
            updateTransaction(protyle, nodeElement, html);
        }
        nodeElement.classList.remove("iframe--drag");
        target.parentElement.parentElement.classList.remove("img--drag");
    };
    return true;
}

/**
 * 处理表格列宽拖拽调整。
 * @returns true 表示已处理（调用方应 return）
 */
export function handleTableColResize(
    protyle: IProtyle,
    event: MouseEvent,
    target: HTMLElement,
    nodeElement: HTMLElement,
    documentSelf: Document,
): boolean {
    if (protyle.disabled || !target.classList.contains("table__resize")) {
        return false;
    }
    if (!nodeElement) {
        return true;
    }
    const html = nodeElement.outerHTML;
    // https://github.com/siyuan-note/siyuan/issues/4455
    if (getSelection().rangeCount > 0) {
        getSelection().getRangeAt(0).collapse(false);
    }
    // @ts-ignore
    nodeElement.firstElementChild.style.webkitUserModify = "read-only";
    nodeElement.style.cursor = "col-resize";
    target.removeAttribute("style");
    const x = event.clientX;
    const colIndex = parseInt(target.getAttribute("data-col-index"));
    const colElement = nodeElement.querySelectorAll("table col")[colIndex] as HTMLElement;
    // 清空初始化 table 时的最小宽度
    if (colElement.style.minWidth) {
        colElement.style.width = (nodeElement.querySelectorAll("table td, table th")[colIndex] as HTMLElement).offsetWidth + "px";
        colElement.style.minWidth = "";
    }
    // 移除 cell 上的宽度限制 https://github.com/siyuan-note/siyuan/issues/7795
    nodeElement.querySelectorAll("tr").forEach((trItem: HTMLTableRowElement) => {
        trItem.cells[colIndex].style.width = "";
    });
    const oldWidth = colElement.clientWidth;
    const hasScroll = nodeElement.firstElementChild.clientWidth < nodeElement.firstElementChild.scrollWidth;
    documentSelf.onmousemove = (moveEvent: MouseEvent) => {
        if (nodeElement.style.textAlign === "center" && !hasScroll) {
            colElement.style.width = (oldWidth + (moveEvent.clientX - x) * 2) + "px";
        } else {
            colElement.style.width = (oldWidth + (moveEvent.clientX - x)) + "px";
        }
    };

    documentSelf.onmouseup = () => {
        // @ts-ignore
        nodeElement.firstElementChild.style.webkitUserModify = "";
        nodeElement.style.cursor = "";
        documentSelf.onmousemove = null;
        documentSelf.onmouseup = null;
        documentSelf.ondragstart = null;
        documentSelf.onselectstart = null;
        documentSelf.onselect = null;
        if (nodeElement) {
            updateTransaction(protyle, nodeElement, html);
        }
    };
    return true;
}
