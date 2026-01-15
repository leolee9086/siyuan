import { Constants } from "../../../constants";
import { fetchSyncPost } from "../../../util/fetch";
import { hasClosestByTag, hasTopClosestByClassName } from "../../util/hasClosest";
import { getContenteditableElement, getNextBlock } from "../getBlock";
import { getSelectionOffset, focusBlock, setFirstNodeRange, setLastNodeRange } from "../../util/selection";
import { isMac } from "../../util/compatibility";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { removeEmbed } from "../removeEmbed";
import { processClonePHElement } from "../../render/util";
import { clearBlockElement } from "../../util/clearSelect";

import { scrollCenter } from "../../../util/highlightById";
import { transaction } from "../transaction";
import { matchHotKey } from "../../util/hotKey";
import { onGet } from "../../util/onGet";
import { copyTextByType } from "../../toolbar/util";
import { isHTMLElement } from "../../../util/DOM/element.guard";

/**
 * 处理复制相关的快捷键操作。
 *
 * 该函数负责拦截键盘事件，检测是否匹配复制快捷键。如果匹配，则根据当前选区或鼠标悬停位置
 * 获取对应的块 ID，并按照指定的类型（如 markdown 协议链接、纯 ID、块嵌入代码等）调用复制功能。
 *
 * @param protyle - 当前的 Protyle 编辑器实例，提供上下文信息。
 * @param event - 触发的键盘事件对象，用于检测快捷键。
 * @param nodeElement - 当前鼠标悬停或光标所在的元素。如果未提供，则默认操作整个文档根节点。
 * @param hotkey - 预定义的快捷键组合字符串（如 "⌘C"）。
 * @param type - 复制的目标格式类型：
 *               - "protocolMd": 完整的 Markdown 链接 `[锚文本](siyuan://blocks/...)`。
 *               - "id": 仅复制块 ID。
 *               - "protocol": 仅复制协议链接 `siyuan://blocks/...`。
 *               - "blockEmbed": 复制为块嵌入形式 `{{...}}`。
 * @returns {boolean} - 如果快捷键匹配并处理了复制逻辑，返回 `true`；否则返回 `false`。
 */
export const handleCopyHotKey = (
    protyle: IProtyle,
    event: KeyboardEvent,
    nodeElement: HTMLElement | undefined,
    hotkey: string,
    type: "protocolMd" | "id" | "protocol" | "blockEmbed"
): boolean => {
    if (!matchHotKey(hotkey, event)) {
        return false;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!nodeElement) {
        copyTextByType([protyle.block.rootID || ""], type);
        return true;
    }

    if (!protyle.wysiwyg) {
        return true;
    }

    const selectElements = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
    if (selectElements.length === 0) {
        selectElements.push(nodeElement);
    }
    const ids: string[] = [];
    for (const item of selectElements) {
        const id = item.getAttribute("data-node-id");
        if (id) {
            ids.push(id);
        }
    }
    copyTextByType(ids, type);
    return true;
};

/**
 * 处理插件注册的自定义快捷键。
 *
 * 遍历应用中所有启用的插件，查找是否有插件定义的快捷键（`customHotkey`）与当前事件匹配。
 * 如果找到匹配项，则执行该插件命令定义的 `editorCallback`。
 *
 * @param protyle - 当前编辑器实例，将作为参数传递给插件的回调函数。
 * @param event - 键盘事件，用于匹配快捷键。
 * @returns {boolean} - 如果成功匹配并执行了任意插件的命令，则返回 `true`。
 */
export const handlePluginHotKey = (protyle: IProtyle, event: KeyboardEvent): boolean => {
    for (const plugin of protyle.app.plugins) {
        const command = plugin.commands.find(command => {
            return command.editorCallback && matchHotKey(command.customHotkey, event);
        });
        if (command && command.editorCallback) {
            command.editorCallback(protyle);
            return true;
        }
    }
    return false;
};

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
    lastElement.after(processClonePHElement(tempElement));
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

/**
 * 处理 `goEnd` 操作中 `fetchPost` 请求的回调。
 *
 * 当请求文档末尾数据成功后，调用 `onGet` 处理返回数据，并聚焦到文档末尾。
 *
 * @param protyle - 编辑器实例。
 * @param getResponse - `fetchPost` 返回的响应数据。
 */
export const handleGoEndResponse = (protyle: IProtyle, getResponse: IWebSocketData) => {
    onGet({
        data: getResponse,
        protyle,
        action: [Constants.CB_GET_FOCUS],
        afterCB() {
            if (protyle.wysiwyg && protyle.wysiwyg.element.lastElementChild) {
                focusBlock(protyle.wysiwyg.element.lastElementChild, undefined, false);
            }
        }
    });
};

/**
 * 处理向上选中时光标在开头的逻辑。
 * 
 * 避免嵌套 If。
 */
export const handleSelectUpStart = (
    range: Range,
    nodeEditableElement: HTMLElement,
    innerText: string,
    startIndex: number,
    event: KeyboardEvent
) => {
    // 选中上一个节点的处理在 toolbar/index.ts 中 `shift+方向键或三击选中`
    if (innerText.substr(0, startIndex).indexOf("\n") === -1 &&
        // 当第一行太长自然换行的情况
        range.getBoundingClientRect().top - nodeEditableElement.getBoundingClientRect().top - parseInt(getComputedStyle(nodeEditableElement).paddingTop) < 14) {
        setFirstNodeRange(nodeEditableElement, range);
        event.preventDefault();
    }
};


/**
 * 处理向上选中的空白情况逻辑
 * 避免嵌套 If
 */
export const handleSelectUpEmpty = (options: {
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    event: KeyboardEvent,
}) => {
    const tdElement = hasClosestByTag(options.range.startContainer, "TD") || hasClosestByTag(options.range.startContainer, "TH");
    const nodeEditableElement = tdElement || getContenteditableElement(options.nodeElement) || options.nodeElement;
    if (!isHTMLElement(nodeEditableElement)) {
        return false;
    }
    const startIndex = getSelectionOffset(nodeEditableElement, options.editorElement, options.range).start;
    const innerText = nodeEditableElement.innerText;
    const isExpandUp = matchHotKey(getSiyuanConfig().keymap.editor.general.expandUp.custom, options.event);
    // Windows 中 ⌥⇧↑ 默认无选中功能会导致 https://ld246.com/article/1716635371149
    if (!(!isMac() && isExpandUp) && startIndex > 0) {
        handleSelectUpStart(options.range, nodeEditableElement, innerText, startIndex, options.event);
        return true;
    }
    return false;
};

/**
 * 处理向下选中或者 expandDown 的空白选区情况逻辑
 * @returns true 表示处理完毕，需要提前 return；false 表示继续执行
 */

export const handleSelectDownEmpty = (options: {
    nodeElement: HTMLElement,
    editorElement: HTMLElement,
    range: Range,
    event: KeyboardEvent,
}) => {
    const tdElement = hasClosestByTag(options.range.startContainer, "TD") || hasClosestByTag(options.range.startContainer, "TH");
    const nodeEditableElement = tdElement || getContenteditableElement(options.nodeElement) || options.nodeElement;
    if (!isHTMLElement(nodeEditableElement)) {
        return false;
    }
    const endIndex = getSelectionOffset(nodeEditableElement, options.editorElement, options.range).end;
    const innerText = nodeEditableElement.innerText;
    const isExpandDown = matchHotKey(getSiyuanConfig().keymap.editor.general.expandDown.custom, options.event);
    if (!isMac() && isExpandDown) {
        // Windows 中 ⌥⇧↓ 默认无选中功能会导致 https://ld246.com/article/1716635371149
        return false;
    }
    if (endIndex >= innerText.length) {
        return false;
    }
    // 选中下一个节点的处理在 toolbar/index.ts 中 `shift+方向键或三击选中`
    // 当最后一行太长自然换行的情况
    const isAtEndLine = innerText.trimRight().substr(endIndex).indexOf("\n") === -1;
    const paddingBottom = parseInt(getComputedStyle(nodeEditableElement).paddingBottom);
    const isBottomClose = nodeEditableElement.getBoundingClientRect().bottom - options.range.getBoundingClientRect().bottom - paddingBottom < 14;

    if (!getNextBlock(options.nodeElement) && isAtEndLine && isBottomClose) {
        // 当为最后一个块时应选中末尾
        setLastNodeRange(nodeEditableElement, options.range, false);
        if (options.nodeElement.classList.contains("code-block") && isExpandDown) {
            // 代码块中 shift+alt 向下选中到末尾时，最后一个字符无法选中
            options.event.preventDefault();
        }
        return true;
    }

    if (tdElement) {
        setLastNodeRange(tdElement, options.range, false);
        options.event.preventDefault();
        return true;
    }
    return true;
};
