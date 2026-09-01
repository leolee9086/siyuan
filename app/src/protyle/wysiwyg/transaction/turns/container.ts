/** 用途：读取容器属性常量。使用范围：引述容器构造。解耦评估：经同域 imports 网关读取基础协议。 */
import {Constants} from "./imports";
/** 用途：取消唯一子块超级块。使用范围：容器转换收尾。解耦评估：经同域 imports 网关读取超级块事务。 */
import {cancelSB} from "./imports";
/** 用途：聚焦转换结果。使用范围：容器事务提交后。解耦评估：经同域 imports 网关读取选择能力。 */
import {focusBlock} from "./imports";
/** 用途：创建超级块容器。使用范围：多块合并。解耦评估：经同域 imports 网关读取容器工厂。 */
import {genSBElement} from "./imports";
/** 用途：定位嵌入块操作父级。使用范围：容器插入操作。解耦评估：经同域 imports 网关读取块查询。 */
import {getEmbedChildOperationParentID} from "./imports";
/** 用途：定位容器父块。使用范围：容器插入操作。解耦评估：经同域 imports 网关读取块查询。 */
import {getParentBlock} from "./imports";
/** 用途：统计超级块子块。使用范围：唯一子块取消判断。解耦评估：经同域 imports 网关读取块查询。 */
import {getSbChildBlockCount} from "./imports";
/** 用途：读取转换视觉端口。使用范围：嵌入查询块重渲染。解耦评估：低层 owner 不直接导入高层渲染。 */
import {getTransactionTransformVisualEffects} from "./imports";
/** 用途：关闭块标工具。使用范围：容器转换提交后。解耦评估：经同域 imports 网关读取 UI 命令。 */
import {hideElements} from "./imports";
/** 用途：收窄样式来源元素。使用范围：超级块宽度传递。解耦评估：经同域 imports 网关读取类型守卫。 */
import {isHTMLElement} from "./imports";
/** 用途：刷新超级块尺寸。使用范围：子块移动完成后。解耦评估：经同域 imports 网关读取刷新 owner。 */
import {refreshSbs} from "./imports";
/** 用途：提交正反向操作。使用范围：容器转换。解耦评估：经同域 imports 网关读取提交协议。 */
import {transaction} from "./imports";
/** 用途：描述单项移动请求。使用范围：容器子块移动。解耦评估：纯类型不加载实现。 */
import type {TTurnIntoOneMoveItemRequest} from "./types";
/** 用途：描述批量移动请求。使用范围：容器子块移动。解耦评估：纯类型不加载实现。 */
import type {TTurnIntoOneMoveItemsRequest} from "./types";
/** 用途：描述宽度回写请求。使用范围：超级块转换。解耦评估：纯类型不加载实现。 */
import type {TTurnIntoOneWidthRequest} from "./types";
/** 用途：描述操作缓冲。使用范围：容器转换构造。解耦评估：纯类型不加载实现。 */
import type {TTurnOperationBuffers} from "./types";
/** 用途：描述容器转换参数。使用范围：容器 owner 公开入口。解耦评估：纯类型不加载实现。 */
import type {TTurnsIntoOneOptions} from "./types";

/** 作用：创建引述容器。意图：复用标准块属性 DOM 并保留新的块身份。调用时机：多块转引述前。 */
const createBlockquoteContainer = (id: string) => {
    const parentElement = document.createElement("div");
    parentElement.classList.add("bq");
    parentElement.setAttribute("data-node-id", id);
    parentElement.setAttribute("data-type", "NodeBlockquote");
    parentElement.innerHTML = `<div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return parentElement;
};

/** 作用：创建标注容器。意图：保持旧命令生成的 NOTE 标注结构。调用时机：多块转标注前。 */
const createCalloutContainer = (id: string) => {
    const parentElement = document.createElement("div");
    parentElement.classList.add("callout");
    parentElement.setAttribute("data-node-id", id);
    parentElement.setAttribute("data-type", "NodeCallout");
    parentElement.setAttribute("contenteditable", "false");
    parentElement.setAttribute("data-subtype", "NOTE");
    parentElement.innerHTML = `<div class="callout-info"><span class="callout-icon">✏️</span><span class="callout-title">Note</span></div><div class="callout-content"></div><div class="protyle-attr" contenteditable="false">${Constants.ZWSP}</div>`;
    return parentElement;
};

/** 作用：生成列表项外壳。意图：容器转换只移动原块内容，列表项保留标准交互结构。调用时机：多块转列表前。 */
const createListItemHTML = (type: TTurnIntoOne, index: number) => {
    if (type === "Blocks2ULs") {
        return `<div data-marker="*" data-subtype="u" data-node-id="${Lute.NewNodeID()}" data-type="NodeListItem" class="li"><div class="protyle-action" draggable="true"><svg><use xlink:href="#iconDot"></use></svg></div><div class="protyle-attr" contenteditable="false"></div></div>`;
    }
    // 有序列表必须生成连续标号和可编辑序号操作柄。
    if (type === "Blocks2OLs") {
        const marker = index + 1;
        return `<div data-marker="${marker}." data-subtype="o" data-node-id="${Lute.NewNodeID()}" data-type="NodeListItem" class="li"><div class="protyle-action protyle-action--order" contenteditable="false" draggable="true">${marker}.</div><div class="protyle-attr" contenteditable="false"></div></div>`;
    }
    return `<div data-marker="*" data-task=" " data-subtype="t" data-node-id="${Lute.NewNodeID()}" data-type="NodeListItem" class="li"><div class="protyle-action protyle-action--task" draggable="true"><svg><use xlink:href="#iconUncheck"></use></svg></div><div class="protyle-attr" contenteditable="false"></div></div>`;
};

/** 作用：创建列表容器及其空列表项。意图：移动现有块时保留列表项和内容块的分层结构。调用时机：多块转任意列表前。 */
const createListContainer = (options: TTurnsIntoOneOptions, id: string) => {
    const parentElement = document.createElement("div");
    parentElement.classList.add("list");
    parentElement.setAttribute("data-node-id", id);
    parentElement.setAttribute("data-type", "NodeList");
    const subtype = options.type === "Blocks2ULs" ? "u" : options.type === "Blocks2OLs" ? "o" : "t";
    parentElement.setAttribute("data-subtype", subtype);
    let html = "";
    for (let index = 0; index < options.selectsElement.length; index++) {
        html += createListItemHTML(options.type, index);
    }
    parentElement.innerHTML = html + '<div class="protyle-attr" contenteditable="false"></div>';
    return parentElement;
};

/** 作用：创建超级块并转移来源宽度。意图：避免列布局合并后丢失用户调整过的尺寸。调用时机：多块合并为超级块前。 */
const createSuperBlockContainer = (options: TTurnsIntoOneOptions, id: string) => {
    const parentElement = genSBElement(options.level, id);
    const widthSource = options.widthSourceElement || options.selectsElement[0];
    if (!isHTMLElement(widthSource) || !widthSource.style.width) {
        return {id, parentElement};
    }
    parentElement.style.width = widthSource.style.width;
    parentElement.style.flex = widthSource.style.flex;
    if (!options.selectsElement.includes(widthSource)) {
        return {id, parentElement};
    }
    const widthSourceOldStyle = widthSource.getAttribute("style") || "";
    widthSource.style.width = "";
    widthSource.style.flex = "";
    return {id, parentElement, widthSourceOldStyle, widthSourceElement: widthSource};
};

/** 作用：按转换类型创建目标容器。意图：把容器构造与事务移动解耦。调用时机：多块转换启动时。 */
const createTurnIntoOneContainer = (options: TTurnsIntoOneOptions) => {
    const id = Lute.NewNodeID();
    if (options.type === "BlocksMergeSuperBlock") {
        return createSuperBlockContainer(options, id);
    }
    if (options.type === "Blocks2Blockquote") {
        return {id, parentElement: createBlockquoteContainer(id)};
    }
    if (options.type === "Blocks2Callout") {
        return {id, parentElement: createCalloutContainer(id)};
    }
    return {id, parentElement: createListContainer(options, id)};
};

/** 作用：确定容器插入操作的父块身份。意图：嵌入块转换不能越过其运行时操作边界。调用时机：容器插入前。 */
const getContainerParentID = (options: TTurnsIntoOneOptions) => {
    const firstElement = options.selectsElement[0];
    return options.parentID || getEmbedChildOperationParentID(firstElement) ||
        getParentBlock(firstElement)?.getAttribute("data-node-id") || options.protyle.block.parentID;
};

/** 作用：在首个选区块前插入容器。意图：随后移动子块时维持原文档顺序。调用时机：事务操作构造前。 */
const insertContainerBeforeSelection = (firstElement: Element, parentElement: HTMLElement) => {
    if (firstElement.previousElementSibling) {
        firstElement.before(parentElement);
        return;
    }
    firstElement.parentElement?.prepend(parentElement);
};

/** 作用：清除单个块的选择标记。意图：移动 DOM 后不保留失效的多选状态。调用时机：每个子块移入容器前。 */
const clearElementSelection = (item: Element) => {
    item.classList.remove("protyle-wysiwyg--select");
    item.removeAttribute("select-start");
    item.removeAttribute("select-end");
};

/** 作用：追加将子块移回原父级的反向操作。意图：容器转换必须可精确撤销。调用时机：每个子块移入容器前。 */
const appendUndoMove = (request: TTurnIntoOneMoveItemRequest) => {
    const itemID = request.item.getAttribute("data-node-id");
    if (!itemID) {
        return;
    }
    request.operations.undoOperations.push({
        action: "move",
        id: itemID,
        previousID: request.previousID || request.container.id,
        parentID: request.parentID,
    });
};

/** 作用：把块移入新建列表项。意图：保留原块作为列表项内容而非重建其 HTML。调用时机：多块转列表时。 */
const moveIntoList = (request: TTurnIntoOneMoveItemRequest) => {
    const itemID = request.item.getAttribute("data-node-id");
    const listItem = request.container.parentElement.children[request.index];
    const actionElement = listItem?.firstElementChild;
    const listItemID = listItem?.getAttribute("data-node-id");
    if (!itemID || !actionElement || !listItemID) {
        return;
    }
    request.operations.doOperations.push({action: "move", id: itemID, parentID: listItemID});
    actionElement.after(request.item);
};

/** 作用：把块移入标注内容容器。意图：保留标注标题和属性节点的位置。调用时机：多块转标注时。 */
const moveIntoCallout = (request: TTurnIntoOneMoveItemRequest) => {
    const itemID = request.item.getAttribute("data-node-id");
    const contentElement = request.container.parentElement.querySelector(".callout-content");
    if (!itemID || !contentElement) {
        return;
    }
    request.operations.doOperations.push({
        action: "move",
        id: itemID,
        previousID: request.previousID,
        parentID: request.container.id,
    });
    contentElement.insertAdjacentElement("beforeend", request.item);
};

/** 作用：把块移入超级块或引述容器。意图：在容器属性节点之前维持内容块顺序。调用时机：非列表、非标注转换时。 */
const moveIntoDefaultContainer = (request: TTurnIntoOneMoveItemRequest) => {
    const itemID = request.item.getAttribute("data-node-id");
    const attributeElement = request.container.parentElement.lastElementChild;
    if (!itemID || !attributeElement) {
        return;
    }
    request.operations.doOperations.push({
        action: "move",
        id: itemID,
        previousID: request.previousID,
        parentID: request.container.id,
    });
    attributeElement.before(request.item);
};

/** 作用：刷新已移入容器的嵌入块。意图：超级块内嵌入块缺失面包屑时恢复其渲染状态。调用时机：嵌入查询块完成移动后。 */
const rerenderMovedEmbedBlock = (request: TTurnIntoOneMoveItemRequest) => {
    if (request.item.getAttribute("data-type") !== "NodeBlockQueryEmbed") {
        return;
    }
    request.item.removeAttribute("data-render");
    getTransactionTransformVisualEffects().renderBlock(request.options.protyle, request.item);
};

/** 作用：按容器类型移动单个块。意图：把结构差异限制在单一分派点。调用时机：多块容器转换循环中。 */
const moveSelectedElement = (request: TTurnIntoOneMoveItemRequest) => {
    clearElementSelection(request.item);
    appendUndoMove(request);
    // 列表容器的子块必须嵌入到对应列表项，而不是直接插入列表容器。
    if (request.options.type.endsWith("Ls")) {
        moveIntoList(request);
        rerenderMovedEmbedBlock(request);
        return;
    }
    // 标注容器有独立内容区，块不能插入标题或属性节点之间。
    if (request.options.type === "Blocks2Callout") {
        moveIntoCallout(request);
        rerenderMovedEmbedBlock(request);
        return;
    }
    moveIntoDefaultContainer(request);
    rerenderMovedEmbedBlock(request);
};

/** 作用：移动所有选区块并构造顺序操作。意图：单一循环同时保持 DOM、正向和反向操作顺序。调用时机：容器插入后。 */
const moveSelectedElements = (request: TTurnIntoOneMoveItemsRequest) => {
    let previousID: string | undefined;
    for (let index = 0; index < request.options.selectsElement.length; index++) {
        const item = request.options.selectsElement[index];
        moveSelectedElement({...request, item, index, previousID});
        previousID = item.getAttribute("data-node-id") || undefined;
        // 最后一个块移动完成后，反向事务删除整个新建容器。
        if (index === request.options.selectsElement.length - 1) {
            request.operations.undoOperations.push({action: "delete", id: request.container.id});
        }
    }
};

/** 作用：追加超级块宽度的正反向属性操作。意图：撤销时恢复来源块的完整样式。调用时机：子块移动完成后。 */
const appendWidthOperations = (request: TTurnIntoOneWidthRequest) => {
    const {widthSourceElement, widthSourceOldStyle} = request.container;
    const widthSourceID = widthSourceElement?.getAttribute("data-node-id");
    if (widthSourceOldStyle === undefined || !widthSourceElement || !widthSourceID) {
        return;
    }
    request.operations.doOperations.push({
        action: "setAttrs",
        id: widthSourceID,
        data: JSON.stringify({style: widthSourceElement.getAttribute("style") || ""}),
    });
    request.operations.undoOperations.splice(request.operations.undoOperations.length - 1, 0, {
        action: "setAttrs", id: widthSourceID, data: JSON.stringify({style: widthSourceOldStyle}),
    });
};

/** 作用：刷新受容器转换影响的超级块尺寸。意图：保持拖拽手柄和布局宽度与已移动 DOM 对齐。调用时机：所有子块移动后。 */
const refreshAffectedSuperBlock = (parentElement: HTMLElement) => {
    // 新建容器本身是超级块时，直接刷新其尺寸和拖拽手柄。
    if (parentElement.classList.contains("sb")) {
        refreshSbs(parentElement);
        return;
    }
    // 引述、列表和标注嵌入已有超级块时，刷新外层超级块的尺寸。
    if (parentElement.parentElement?.classList.contains("sb")) {
        refreshSbs(parentElement.parentElement);
    }
};

/** 作用：在唯一子块场景取消外层超级块。意图：保留上游引述、列表和标注转换的结构简化语义。调用时机：容器移动完成后。 */
const appendSingleChildSuperBlockCancellation = async (options: TTurnsIntoOneOptions,
                                                       parentElement: HTMLElement, operations: TTurnOperationBuffers) => {
    const convertsToNestedContainer = ["Blocks2Blockquote", "Blocks2Callout"].includes(options.type) ||
        options.type.endsWith("Ls");
    const shouldCancelSuperBlock = convertsToNestedContainer && parentElement.parentElement?.classList.contains("sb") &&
        getSbChildBlockCount(parentElement.parentElement) === 1;
    // 容器成为超级块唯一内容时需追加取消操作，避免留下无意义的单子块超级块。
    if (!shouldCancelSuperBlock || !parentElement.parentElement) {
        return;
    }
    const cancellation = await cancelSB(options.protyle, parentElement.parentElement);
    operations.doOperations.push(...cancellation.doOperations);
    operations.undoOperations.splice(0, 0, ...cancellation.undoOperations);
};

/** 作用：将多个块合并为一个结构容器。意图：在同一事务内协调 DOM 移动、宽度、超级块和撤销记录。调用时机：块标、列表和超级块命令执行时。 */
export const turnsIntoOneTransaction = async (options: TTurnsIntoOneOptions) => {
    const firstElement = options.selectsElement[0];
    if (!firstElement) {
        return;
    }
    const container = createTurnIntoOneContainer(options);
    const parentID = getContainerParentID(options);
    const operations: TTurnOperationBuffers = {
        doOperations: [{action: "insert", id: container.id, data: container.parentElement.outerHTML,
            nextID: firstElement.getAttribute("data-node-id"), parentID}],
        undoOperations: [],
    };
    insertContainerBeforeSelection(firstElement, container.parentElement);
    moveSelectedElements({options, container, parentID, operations});
    appendWidthOperations({container, operations});
    refreshAffectedSuperBlock(container.parentElement);
    await appendSingleChildSuperBlockCancellation(options, container.parentElement, operations);
    if (options.getOperations) {
        return operations;
    }
    transaction(options.protyle, operations.doOperations, operations.undoOperations);
    if (!options.unfocus) {
        focusBlock(options.protyle.wysiwyg.element.querySelector(`[data-node-id="${firstElement.getAttribute("data-node-id")}"]`));
    }
    hideElements(["gutter"], options.protyle);
};
