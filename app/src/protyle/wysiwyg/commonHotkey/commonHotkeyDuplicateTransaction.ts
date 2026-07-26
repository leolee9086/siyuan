import { fetchSyncPost } from "../../../util/network/fetch";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { clearBlockElement } from "../../util/clearSelect";
import {transaction} from "../transaction/submit";
import { focusBlock } from "../../util/selection";
import { scrollCenter } from "../../../util/DOM/highlightById";

/**
 * 更新插入点之后所有兄弟有序列表项的序号。
 *
 * 当在有序列表中间插入新项时，需要向后遍历后续的同级元素，直到遇到非有序列表项为止。
 * 对每个后续项，更新其 `data-marker` 和显示的序号，并生成对应的 `update` 事务操作以确保持久化和支持撤销。
 *
 * @param starIndex - 插入操作前的起始序号。
 * @param count - 插入的元素数量（序号偏移量）。
 * @param focusElement - 插入操作的最后一个新元素（遍历将从它的下一个兄弟节点开始）。
 * @param doOperations - 事务数组，追加后续节点的更新操作。
 * @param undoOperations - 撤销数组，追加后续节点的恢复操作。
 */
export const updateSubsequentMarkers = (
    starIndex: number,
    count: number,
    focusElement: Element,
    doOperations: IOperation[],
    undoOperations: IOperation[]
) => {
    if (typeof starIndex === "number" && focusElement) {
        let nextElement = focusElement.nextElementSibling;
        let currentStarIndex = starIndex + count;
        while (nextElement) {
            if (nextElement.getAttribute("data-subtype") !== "o") {
                break;
            }

            currentStarIndex++;
            const id = nextElement.getAttribute("data-node-id");

            // Construct undo operation with safe access
            const undoData = nextElement.outerHTML;
            undoOperations.push({
                action: "update",
                id: id || "",
                data: undoData,
            });

            nextElement.setAttribute("data-marker", currentStarIndex + ".");

            const orderElement = nextElement.querySelector(".protyle-action--order");
            if (orderElement) {
                orderElement.textContent = currentStarIndex + ".";
            }

            // Construct do operation
            doOperations.push({
                action: "update",
                data: nextElement.outerHTML,
                id: id || "",
            });

            nextElement = nextElement.nextElementSibling;
        }
    }
};

/**
 * 特殊处理折叠状态的标题块复制。
 *
 * 当复制一个已折叠的标题时，不仅要复制标题本身，还需要获取其隐藏的子块并生成对应的插入操作。
 * 函数会：
 * 1. 发起请求获取该标题下的所有子块 DOM。
 * 2. 逆序遍历子块（`reverse()`），为每个子块生成新 ID。
 * 3. 构建 `insert` 操作（正向操作）和 `delete` 操作（撤销操作），并将它们推入 `doOperations` 和 `undoOperations` 数组。
 *
 * 注意：此函数直接修改传入的 `foldHeadingIds`, `doOperations`, `undoOperations` 数组（副作用）。
 *
 * @param item - 原始标题元素。
 * @param newId - 新标题块的 ID。
 * @returns {Promise<{doOperations: IOperation[], undoOperations: IOperation[]}>} - 返回生成的事务操作和撤销操作。
 */
export const handleFoldedHeading = async (
    item: Element,
    newId: string
) => {
    const doOperations: IOperation[] = [];
    const undoOperations: IOperation[] = [];
    if (item.getAttribute("data-type") === "NodeHeading" && item.getAttribute("fold") === "1") {
        const oldId = item.getAttribute("data-node-id") || "";
        const responseHTML = await fetchSyncPost("/api/block/getHeadingChildrenDOM", { id: oldId });
        const foldElement = document.createElement("template");
        foldElement.innerHTML = responseHTML.data;
        const children = Array.from(foldElement.content.children).reverse();
        for (let childIndex = 0; childIndex < children.length; childIndex++) {
            if (childIndex === foldElement.content.children.length - 1) {
                continue;
            }
            const childItem = children[childIndex];
            if (!isHTMLElement(childItem)) {
                continue;
            }
            const subItems = childItem.querySelectorAll("[data-node-id]");
            for (const subItem of Array.from(subItems)) {
                subItem.setAttribute("data-node-id", Lute.NewNodeID());
                clearBlockElement(subItem);
            }
            const newChildId = Lute.NewNodeID();
            childItem.setAttribute("data-node-id", newChildId);
            clearBlockElement(childItem);
            doOperations.push({
                context: {
                    ignoreProcess: "true"
                },
                action: "insert",
                data: childItem.outerHTML,
                id: newChildId,
                previousID: newId,
            });
            undoOperations.push({
                action: "delete",
                id: newChildId,
            });
        }
    }
    return {
        doOperations,
        undoOperations
    };
};

/**
 * 完成块重复操作的收尾流程。
 *
 * 执行以下步骤：
 * 1. 清理界面辅助元素（如 `[parent-heading]`）。
 * 2. 如果涉及有序列表，更新插入点之后所有兄弟节点的序号。
 * 3. 提交事务（Transaction），应用所有修改操作。
 * 4. 聚焦并将视图滚动到新插入的块。
 *
 * @param protyle - 编辑器实例。
 * @param focusElement - 操作完成后需要聚焦的元素（即新插入的最后一个块）。
 * @param starIndex - 如果是连续复制有序列表，记录起始序号；否则为 undefined。
 * @param count - 此次操作新增的块数量，用于计算后续序号的偏移。
 * @param doOperations - 待提交的正向事务操作列表。
 * @param undoOperations - 待提交的反向撤销操作列表。
 */
export const finalizeDuplicateBlock = (
    protyle: IProtyle,
    focusElement: Element,
    starIndex: number | undefined,
    count: number,
    doOperations: IOperation[],
    undoOperations: IOperation[]
) => {
    if (protyle.wysiwyg) {
        const parentHeadings = protyle.wysiwyg.element.querySelectorAll("[parent-heading]");
        for (const item of Array.from(parentHeadings)) {
            item.remove();
        }
    }

    if (typeof starIndex === "number") {
        updateSubsequentMarkers(starIndex, count, focusElement, doOperations, undoOperations);
    }

    transaction(protyle, doOperations, undoOperations);
    focusBlock(focusElement);
    scrollCenter(protyle);
};
