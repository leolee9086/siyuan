import {transaction, updateTransaction} from "./transaction";
import {img3115} from "../../boot/compatibleVersion";
import * as dayjs from "dayjs";

interface ISuperBlockResizeTip {
    child: HTMLElement;
    el: HTMLElement;
    position: string;
}

interface ISuperBlockResizeContext {
    finalLeft: number;
    finalRight: number;
    gapHalve: number;
    leftIdx: number;
    nextElement: HTMLElement;
    oldHTMLs: {
        next: string;
        prev: string;
    };
    oldLeftWidth: number;
    oldRightWidth: number;
    previousElement: HTMLElement;
    rightIdx: number;
    sbWidth: number;
    shares: number[];
    tips: ISuperBlockResizeTip[];
    x: number;
}

/**
 * 查找拖拽手柄右侧的真实块元素，跳过手柄等装饰节点。
 */
function findNextSuperBlockChild(target: HTMLElement) {
    let nextElement = target.nextElementSibling;
    while (nextElement) {
        if (nextElement instanceof HTMLElement && nextElement.hasAttribute("data-node-id")) {
            return nextElement;
        }
        nextElement = nextElement.nextElementSibling;
    }
}

/**
 * 创建右上角百分比提示，同时记录原始 position，拖拽结束后恢复。
 */
function createSuperBlockResizeTips(sbChildren: HTMLElement[]) {
    const tips: ISuperBlockResizeTip[] = [];
    for (const child of sbChildren) {
        const tip = document.createElement("span");
        tip.className = "sb__resize-tip protyle-icon protyle-icon--first protyle-icon--last";
        tips.push({child, el: tip, position: child.style.position});
        child.style.position = "relative";
        child.appendChild(tip);
    }
    return tips;
}

/**
 * 根据现有 calc 百分比或实测宽度创建总和为 100 的份额池。
 */
function createSuperBlockResizeShares(sbChildren: HTMLElement[], sbWidth: number) {
    const rawPcts: number[] = [];
    for (const child of sbChildren) {
        const match = child.style.width.match(/^calc\(([\d.]+)%/);
        rawPcts.push(match ? parseFloat(match[1]) : child.getBoundingClientRect().width / sbWidth * 100);
    }
    const totalRaw = rawPcts.reduce((sum, pct) => sum + pct, 0) || 1;
    const normalized = rawPcts.map(pct => pct / totalRaw * 100);
    const shares = normalized.map(pct => Math.floor(pct));
    const deficit = 100 - shares.reduce((sum, pct) => sum + pct, 0);
    const remainders = normalized
        .map((pct, index) => ({index, frac: pct - Math.floor(pct)}))
        .sort((a, b) => b.frac - a.frac);
    for (let index = 0; index < deficit && index < remainders.length; index++) {
        const remainder = remainders[index];
        shares[remainder.index]++;
    }
    return shares;
}

/**
 * 刷新所有提示上的列宽份额文本。
 */
function updateSuperBlockResizeTips(tips: ISuperBlockResizeTip[], shares: number[]) {
    for (let index = 0; index < tips.length; index++) {
        const tip = tips[index];
        tip.el.textContent = `${shares[index]}%`;
    }
}

/**
 * 构造超级块列宽拖拽上下文，失败时返回空值并由调用方吞掉事件。
 */
function createSuperBlockResizeContext(target: HTMLElement, x: number) {
    const sbElement = target.parentElement;
    const previousElement = target.previousElementSibling;
    const nextElement = findNextSuperBlockChild(target);
    if (!(sbElement instanceof HTMLElement) || !(previousElement instanceof HTMLElement) ||
        !previousElement.hasAttribute("data-node-id") || !nextElement ||
        sbElement.getAttribute("data-sb-layout") !== "col") {
        return;
    }
    const sbWidth = sbElement.clientWidth;
    const handleStyle = getComputedStyle(target);
    const gapPx = target.offsetWidth + parseFloat(handleStyle.marginLeft) + parseFloat(handleStyle.marginRight);
    const sbChildren = Array.from(sbElement.querySelectorAll<HTMLElement>(":scope > [data-node-id]"));
    const leftIdx = sbChildren.indexOf(previousElement);
    const rightIdx = sbChildren.indexOf(nextElement);
    if (leftIdx < 0 || rightIdx < 0) {
        return;
    }
    const tips = createSuperBlockResizeTips(sbChildren);
    const shares = createSuperBlockResizeShares(sbChildren, sbWidth);
    const oldLeftWidth = previousElement.getBoundingClientRect().width;
    const oldRightWidth = nextElement.getBoundingClientRect().width;
    return {
        finalLeft: oldLeftWidth,
        finalRight: oldRightWidth,
        gapHalve: gapPx / 2 + 1,
        leftIdx,
        nextElement,
        oldHTMLs: {
            next: nextElement.outerHTML,
            prev: previousElement.outerHTML,
        },
        oldLeftWidth,
        oldRightWidth,
        previousElement,
        rightIdx,
        sbWidth,
        shares,
        tips,
        x,
    };
}

/**
 * 拖拽过程中左右相邻块等量交换宽度，并同步更新提示份额。
 */
function updateSuperBlockResizeWidth(context: ISuperBlockResizeContext, clientX: number) {
    const minWidth = 20;
    const delta = clientX - context.x;
    let newLeftWidth = context.oldLeftWidth + delta;
    let newRightWidth = context.oldRightWidth - delta;
    if (newLeftWidth < minWidth) {
        newLeftWidth = minWidth;
        newRightWidth = context.oldLeftWidth + context.oldRightWidth - minWidth;
    }
    if (newRightWidth < minWidth) {
        newRightWidth = minWidth;
        newLeftWidth = context.oldLeftWidth + context.oldRightWidth - minWidth;
    }
    context.finalLeft = newLeftWidth;
    context.finalRight = newRightWidth;
    context.previousElement.style.width = newLeftWidth + "px";
    context.previousElement.style.flex = "none";
    context.nextElement.style.width = newRightWidth + "px";
    context.nextElement.style.flex = "none";
    const newLeftShare = Math.max(1, Math.round(newLeftWidth / context.sbWidth * 100));
    const othersSum = context.shares.reduce((sum, pct, index) => {
        return index === context.leftIdx || index === context.rightIdx ? sum : sum + pct;
    }, 0);
    context.shares[context.leftIdx] = newLeftShare;
    context.shares[context.rightIdx] = Math.max(1, 100 - othersSum - newLeftShare);
    updateSuperBlockResizeTips(context.tips, context.shares);
}

/**
 * 清理拖拽提示并恢复拖拽期间改动的 DOM 状态。
 */
function cleanupSuperBlockResize(context: ISuperBlockResizeContext, documentSelf: Document) {
    for (const tip of context.tips) {
        tip.el.remove();
        tip.child.style.position = tip.position;
    }
    // @ts-ignore
    context.previousElement.style.webkitUserModify = "";
    // @ts-ignore
    context.nextElement.style.webkitUserModify = "";
    documentSelf.onmousemove = null;
    documentSelf.onmouseup = null;
    documentSelf.ondragstart = null;
    documentSelf.onselectstart = null;
    documentSelf.onselect = null;
}

/**
 * 将左右相邻块的新宽度写回 DOM，并用单个事务保证撤销时两侧同步恢复。
 */
function commitSuperBlockResize(protyle: IProtyle, context: ISuperBlockResizeContext) {
    let leftPct = Math.round((context.finalLeft + context.gapHalve) / context.sbWidth * 1000) / 10;
    let rightPct = Math.round((context.finalRight + context.gapHalve) / context.sbWidth * 1000) / 10;
    const sumPct = leftPct + rightPct;
    if (sumPct > 99.5) {
        const scale = 99 / sumPct;
        leftPct = Math.round(leftPct * scale * 10) / 10;
        rightPct = Math.round(rightPct * scale * 10) / 10;
    }
    const updated = dayjs().format("YYYYMMDDHHmmss");
    context.previousElement.style.width = `calc(${leftPct}% - ${context.gapHalve}px)`;
    context.nextElement.style.width = `calc(${rightPct}% - ${context.gapHalve}px)`;
    context.previousElement.setAttribute("updated", updated);
    context.nextElement.setAttribute("updated", updated);
    transaction(protyle, [
        {
            action: "update",
            data: context.previousElement.outerHTML,
            id: context.previousElement.getAttribute("data-node-id"),
        },
        {action: "update", data: context.nextElement.outerHTML, id: context.nextElement.getAttribute("data-node-id")},
    ], [
        {action: "update", data: context.oldHTMLs.prev, id: context.previousElement.getAttribute("data-node-id")},
        {action: "update", data: context.oldHTMLs.next, id: context.nextElement.getAttribute("data-node-id")},
    ]);
}

/**
 * 完成超级块列宽拖拽；仅点击未移动时不产生事务。
 */
function finishSuperBlockResize(
    protyle: IProtyle,
    context: ISuperBlockResizeContext,
    documentSelf: Document,
    mouseupClientX: number,
) {
    cleanupSuperBlockResize(context, documentSelf);
    if (Math.abs(context.x - mouseupClientX) <= 0) {
        return;
    }
    commitSuperBlockResize(protyle, context);
}

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
    const context = createSuperBlockResizeContext(target, event.clientX);
    if (!context) {
        return true;
    }
    // @ts-ignore
    context.previousElement.style.webkitUserModify = "read-only";
    // @ts-ignore
    context.nextElement.style.webkitUserModify = "read-only";
    updateSuperBlockResizeTips(context.tips, context.shares);
    documentSelf.onmousemove = (moveEvent: MouseEvent) => updateSuperBlockResizeWidth(context, moveEvent.clientX);
    documentSelf.onmouseup = (mouseupEvent: MouseEvent) => {
        finishSuperBlockResize(protyle, context, documentSelf, mouseupEvent.clientX);
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
