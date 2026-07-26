/** 用途：折叠状态应用所需的 DOM、焦点和滚动能力；使用范围：本模块；解耦评估：专属网关逐项直达唯一实现，不加载事务提交。 */
import {clearSelect} from "./imports";
/** 用途：恢复隐藏子列表中的焦点；使用范围：进入折叠状态；解耦评估：经专属网关使用唯一焦点实现。 */
import {focusBlock} from "./imports";
/** 用途：定位光标所属块；使用范围：折叠焦点判断；解耦评估：经专属网关使用 DOM 查询原语。 */
import {hasClosestBlock} from "./imports";
/** 用途：重绘展开后的代码行号；使用范围：移除 fold 属性后；解耦评估：经专属网关直达渲染实现。 */
import {lineNumberRender} from "./imports";
/** 用途：抑制折叠后的滚动读取；使用范围：操作收集完成阶段；解耦评估：经专属网关直达生命周期实现。 */
import {preventScroll} from "./imports";
/** 用途：清理标题折叠附属 DOM；使用范围：标题进入折叠状态；解耦评估：经专属网关直达标题实现。 */
import {removeFoldHeading} from "./imports";
/** 用途：保持折叠目标可见；使用范围：进入折叠状态；解耦评估：经专属网关直达滚动实现。 */
import {scrollCenter} from "./imports";
/** 用途：已解析折叠操作输入；使用范围：操作构造函数；解耦评估：同域纯类型直达定义。 */
import type {FoldOperationOptions} from "../state.types";
/** 用途：折叠状态请求；使用范围：状态应用入口；解耦评估：同域纯类型直达定义。 */
import type {FoldStateRequest} from "../state.types";

/** 展开当前块并恢复其中需要重绘的行号。 */
const applyExpandedState = (nodeElement: Element) => {
    nodeElement.removeAttribute("fold");
    for (const item of nodeElement.querySelectorAll<HTMLElement>(".protyle-linenumber__rows")) {
        lineNumberRender(item.parentElement);
    }
};

/** 折叠当前块并同步焦点、选择与视口。 */
const restoreCollapsedFocus = (nodeElement: Element) => {
    if (getSelection().rangeCount === 0) {
        return;
    }
    const range = getSelection().getRangeAt(0);
    const blockElement = hasClosestBlock(range.startContainer);
    // 当前选择位于即将被隐藏的子块时，先将焦点移回折叠目标，避免浏览器保留不可见的选区焦点。
    if (blockElement?.getBoundingClientRect().width === 0) {
        focusBlock(nodeElement, undefined, false);
    }
};

/** 折叠当前块并同步焦点、选择与视口。 */
const applyCollapsedState = (protyle: IProtyle, nodeElement: Element) => {
    nodeElement.setAttribute("fold", "1");
    restoreCollapsedFocus(nodeElement);
    clearSelect(["img", "av"], nodeElement);
    scrollCenter(protyle, nodeElement);
};

/** 构造标题展开操作，并保持原有加载指示器插入时机。 */
const buildHeadingUnfoldOperations = ({nodeElement, id, isRemove, addLoading}: FoldOperationOptions) => {
    if (addLoading) {
        nodeElement.insertAdjacentHTML("beforeend", '<div spin="1" style="text-align: center"><img width="24px" height="24px" src="/stage/loading-pure.svg"></div>');
    }
    const doOperations: IOperation[] = [{action: "unfoldHeading", id, data: isRemove ? "remove" : undefined}];
    const undoOperations: IOperation[] = [{action: "foldHeading", id}];
    return {doOperations, undoOperations};
};

/** 构造标题折叠操作并清理折叠附属 DOM。 */
const buildHeadingFoldOperations = ({nodeElement, id}: FoldOperationOptions) => {
    removeFoldHeading(nodeElement);
    const doOperations: IOperation[] = [{action: "foldHeading", id}];
    const undoOperations: IOperation[] = [{action: "unfoldHeading", id}];
    return {doOperations, undoOperations};
};

/** 构造普通块的属性更新操作。 */
const buildBlockFoldOperations = ({id, hasFold}: FoldOperationOptions) => {
    const doOperations: IOperation[] = [{action: "setAttrs", id, data: JSON.stringify({fold: hasFold ? "" : "1"})}];
    const undoOperations: IOperation[] = [{action: "setAttrs", id, data: JSON.stringify({fold: hasFold ? "1" : ""})}];
    return {doOperations, undoOperations};
};

/** 根据应用前状态构造标题或普通块的可逆折叠操作。 */
const buildFoldOperations = (options: FoldOperationOptions) => {
    const {nodeElement, id, hasFold, isRemove, addLoading} = options;
    if (nodeElement.getAttribute("data-type") !== "NodeHeading") {
        return buildBlockFoldOperations(options);
    }
    if (hasFold) {
        return buildHeadingUnfoldOperations({nodeElement, id, hasFold, isRemove, addLoading});
    }
    return buildHeadingFoldOperations(options);
};

/** 校验请求方向并执行对应的 DOM 状态变更。 */
const applyRequestedFoldState = ({protyle, nodeElement, isOpen}: FoldStateRequest, hasFold: boolean) => {
    if (hasFold && typeof isOpen === "boolean" && !isOpen) {
        return false;
    }
    if (!hasFold && typeof isOpen === "boolean" && isOpen) {
        return false;
    }
    if (hasFold) {
        applyExpandedState(nodeElement);
        return true;
    }
    applyCollapsedState(protyle, nodeElement);
    return true;
};

/**
 * 同步应用一个块的折叠 DOM，并返回对应的可逆操作；不提交事务。
 * @同步豁免: 需要绝对同步的DOM访问 - fold 属性、焦点、选择和操作快照必须在调用方组合事务前原子完成。
 */
/** 按请求同步折叠状态，并返回对应操作而不提交事务。 */
export const applyFoldStateRequest = (request: FoldStateRequest) => {
    const {nodeElement, isOpen} = request;
    if (nodeElement.getAttribute("data-type") === "NodeListItem" && nodeElement.childElementCount < 4 && !isOpen) {
        return {fold: -1};
    }
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return {fold: -1};
    }
    const hasFold = nodeElement.getAttribute("fold") === "1";
    if (!applyRequestedFoldState(request, hasFold)) {
        return {fold: -1};
    }
    const id = nodeElement.getAttribute("data-node-id");
    if (!id) {
        return {fold: -1};
    }
    const {doOperations, undoOperations} = buildFoldOperations({...request, id, hasFold});
    return {fold: !hasFold ? 1 : 0, undoOperations, doOperations};
};

/** 应用折叠状态、保留原滚动抑制时机并返回操作，供更大的组合事务使用。 @同步豁免: 生命周期 - DOM、操作快照和 preventScroll 必须在组合事务前完成。 */
export const setFoldAndCollectOperations = (request: FoldStateRequest) => {
    const result = applyFoldStateRequest(request);
    if (result.doOperations) {
        preventScroll(request.protyle);
    }
    return result;
};
