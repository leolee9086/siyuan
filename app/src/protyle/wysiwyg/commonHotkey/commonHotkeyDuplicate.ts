import { Constants } from "../../../constants";
import { fetchSyncPost } from "../../../util/network/fetch";
import { hasTopClosestByClassName } from "../../util/hasClosest";
import { removeEmbed } from "../removeEmbed";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { clearBlockElement } from "../../util/clearSelect";

/**
 * 计算执行 "复制块" (Duplicate) 操作时的初始状态。
 *
 * 分析待复制的节点列表，确定插入位置的参考元素（`lastElement`），并识别列表项的序号逻辑。
 * 如果是一组列表项，会检查它们是否属于同一个层级的列表（`isSameLi`），以便决定是逐项复制还是作为整个列表块处理。
 *
 * @param nodeElements - 用户选中的、需要进行复制操作的 DOM 元素数组。
 * @returns 一个包含状态信息的对象：
 *          - `starIndex`: 如果参考元素是有序列表项，返回其当前的序号数值（data-marker）；否则为 undefined。
 *          - `lastElement`: 用于决定新块插入位置的参考元素。通常是选中范围的最后一个元素，或者是其所在的父级列表容器。
 *          - `isSameLi`: 布尔值，指示所有选中的元素是否都是列表项且属于同一种列表类型（subtype）。
 */
export const getInitialCloneState = (nodeElements: Element[]) => {
    let lastElement = nodeElements.length > 0 ? nodeElements[nodeElements.length - 1] : undefined;

    if (!lastElement || !lastElement.classList.contains("li")) {
        return { starIndex: undefined, lastElement, isSameLi: true };
    }

    const referenceElement = lastElement;
    let starIndex: number | undefined;
    if (lastElement.getAttribute("data-subtype") === "o") {
        starIndex = parseInt(lastElement.getAttribute("data-marker") || "0", 10);
    }
    const isSameLi = nodeElements.every(item =>
        item.classList.contains("li") &&
        referenceElement.getAttribute("data-subtype") === item.getAttribute("data-subtype")
    );
    if (!isSameLi) {
        lastElement = hasTopClosestByClassName(lastElement, "list") || lastElement;
    }
    return { starIndex, lastElement, isSameLi };
};

/**
 * 创建用于插入的临时 DOM 元素。
 *
 * 针对不同类型的块进行克隆处理：
 * 1. 对于普通块，直接执行浅拷贝或深拷贝。
 * 2. 对于 "数据库查询嵌入" (NodeBlockQueryEmbed) 或 "折叠的标题" (NodeHeading folded=1)，
 *    由于本地 DOM 可能不完整（折叠状态下子节点未渲染），该函数会请求后端接口 `/api/block/getBlockDOM` 获取完整的 DOM 树。
 *
 * @param item - 原始块的 DOM 元素。
 * @returns {Promise<HTMLElement | Element>} - 返回准备好用于插入的新 DOM 元素（可能是从服务器获取的完整结构）。
 */
export const createTempElement = async (item: Element) => {
    const clone = item.cloneNode(true);
    let tempElement = isHTMLElement(clone) ? clone : document.createElement("div");
    if (item.getAttribute("data-type") === "NodeBlockQueryEmbed" ||
        !item.querySelector('[data-type="NodeHeading"][fold="1"]')) {
        return tempElement;
    }
    const response = await fetchSyncPost("/api/block/getBlockDOM", {
        id: item.getAttribute("data-node-id"),
    });
    const foldTempElement = document.createElement("template");
    foldTempElement.innerHTML = response.data.dom;
    const firstChild = foldTempElement.content.firstElementChild;
    if (firstChild && isHTMLElement(firstChild)) {
        tempElement = firstChild;
    }
    return tempElement;
};

/**
 * 处理列表项复制过程中的容器包装逻辑。
 *
 * 当复制一组列表项时，如果当前项是这组项的开头，或者是不同类型的列表项（例如从无序变为有序），
 * 需要创建一个新的列表容器 (`<div class="list" ...>`) 来包裹后续的列表项 HTML。
 *
 * @param item - 当前正在处理的原始 DOM 元素。
 * @param nodeElements - 所有待处理元素的数组。
 * @param index - 当前元素在 `nodeElements` 中的索引。
 * @param listHTML - 当前累积的、待包裹的列表项 HTML 字符串。
 * @returns 一个控制对象：
 *          - `shouldContinue`: 是否应该跳过当前迭代的后续逻辑（即已经处理了容器创建，等待下一次累积）。
 *          - `listHTML`: 更新后的 HTML 字符串累积值。如果创建了新容器，累积值会被重置。
 *          - `tempElement`: 如果创建了新的列表容器，返回该容器元素；否则为 null。
 */
export const processListWrapper = (item: Element, nodeElements: Element[], index: number, listHTML: string) => {
    if (!listHTML) {
        listHTML = `<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div></div>`;
    }
    listHTML = removeEmbed(item) + listHTML;

    const prevNode = nodeElements[index - 1];
    const isStartOfList = index === 0 || (
        !!prevNode && (
            prevNode.getAttribute("data-type") !== "NodeListItem" ||
            prevNode.getAttribute("data-subtype") !== item.getAttribute("data-subtype")
        )
    );

    if (isStartOfList) {
        const foldTempElement = document.createElement("template");
        foldTempElement.innerHTML = `<div data-subtype="${item.getAttribute("data-subtype")}" data-node-id="${Lute.NewNodeID()}" data-type="NodeList" class="list">${listHTML}`;
        const firstChild = foldTempElement.content.firstElementChild;
        const tempElement = (firstChild && isHTMLElement(firstChild)) ? firstChild : document.createElement("div");
        return { shouldContinue: false, listHTML: "", tempElement };
    }
    return { shouldContinue: true, listHTML, tempElement: null };
};

/**
 * 封装列表项包装逻辑，避免嵌套 If。
 * 
 * 如果当前项是列表项且不是同一列表的一部分，则调用 processListWrapper 进行处理。
 * 
 * @param item - 当前 DOM 元素。
 * @param isSameLi - 是否属于同一列表。
 * @param nodeElements - 节点数组。
 * @param index - 当前索引。
 * @param listHTML - 当前累积的列表 HTML。
 */
export const handleListWrapperLogic = (
    item: Element,
    isSameLi: boolean,
    nodeElements: Element[],
    index: number,
    listHTML: string
) => {
    if (item.getAttribute("data-type") === "NodeListItem" && !isSameLi) {
        return processListWrapper(item, nodeElements, index, listHTML);
    }
    return { shouldContinue: false, listHTML, tempElement: null };
};

/**
 * 更新新创建的块及其子块的 ID 和属性。
 *
 * 新复制的块不能与原块共享 ID。该函数会：
 * 1. 为 `tempElement` 赋予一个新的 Block ID。
 * 2. 设置 `updated` 属性以标记更新时间/版本。
 * 3. 递归地查找并更新所有子孙节点（通过 `querySelectorAll("[data-node-id]")`）的 ID，确保整个子树的 ID 唯一性。
 * 4. 清除选中状态和临时样式，使新块处于“干净”状态。
 *
 * @param tempElement - 已经克隆好的、准备插入的 DOM 元素树。
 * @param newId - 为顶层元素预生成的新 Block ID。
 */
export const updateNewBlockAttributes = (tempElement: HTMLElement, newId: string) => {
    tempElement.setAttribute("data-node-id", newId);
    tempElement.setAttribute("updated", newId.split("-")[0] || "");
    clearBlockElement(tempElement);
    tempElement.classList.add("protyle-wysiwyg--select");
    const childItems = tempElement.querySelectorAll("[data-node-id]");
    for (const childItem of Array.from(childItems)) {
        const subNewId = Lute.NewNodeID();
        childItem.setAttribute("data-node-id", subNewId);
        childItem.setAttribute("updated", subNewId.split("-")[0] || "");
        clearBlockElement(childItem);
    }
};

/**
 * 更新有序列表项的序号标记。
 *
 * 用于在复制有序列表项时，根据其在复制序列中的相对位置，计算并设置正确的序号（如 "1.", "2."）。
 * 此函数同时更新 `data-marker` 属性和界面上显示的序号元素 (`.protyle-action--order`)。
 *
 * @param tempElement - 列表项的 DOM 元素。
 * @param starIndex - 列表的起始序号基数（来自参考元素）。
 * @param index - 当前项在复制序列中的偏移量。
 */
export const updateOrderedMarker = (tempElement: HTMLElement, starIndex: number, index: number) => {
    const orderIndex = starIndex + index + 1;
    tempElement.setAttribute("data-marker", (orderIndex) + ".");
    const orderElement = tempElement.querySelector(".protyle-action--order");
    if (orderElement) {
        orderElement.textContent = (orderIndex) + ".";
    }
};

/**
 * 将复制生成的临时元素插入到 DOM 中，并记录事务。
 *
 * 将 `tempElement` 插入到 `lastElement` 之后。同时生成：
 * 1. `insert` 操作：包含新元素的 HTML 和位置信息（previousID）。
 * 2. `delete` 操作：用于撤销时删除该元素。
 *
 * @param tempElement - 准备好插入的新 DOM 元素（已更新 ID 和属性）。
 * @param lastElement - 参考元素，新元素将插入到此元素之后。
 * @param newId - 新元素的 Block ID。
 * @param doOperations - 追加事务操作。
 * @param undoOperations - 追加撤销操作。
 */
export const insertDuplicateItem = (
    tempElement: HTMLElement,
    lastElement: Element,
    newId: string,
    doOperations: IOperation[],
    undoOperations: IOperation[]
) => {
    lastElement.after(tempElement);
    doOperations.push({
        action: "insert",
        data: tempElement.outerHTML,
        id: newId,
        previousID: lastElement.getAttribute("data-node-id") || undefined,
    });
    undoOperations.push({
        action: "delete",
        id: newId,
    });
};
