/** 用途：恢复拖拽填充手柄。使用范围：主键 block-more 在 table 视图下的补充动作。解耦评估：拖拽填充是 cell 子模块能力，继续复用共享实现即可。 */
import { addDragFill } from "./imports";
/** 用途：重渲染属性视图。使用范围：load-more 后的本地刷新。解耦评估：整体渲染属于 render 层能力，当前模块只负责触发。 */
import { avRender } from "./imports";
/** 用途：在移动端主动唤起键盘。使用范围：搜索图标点击且检测到原生桥接时。解耦评估：原生桥接细节应保留在移动端工具层。 */
import { callMobileAppShowKeyboard } from "./imports";
/** 用途：读取高级 data-type 分支所需常量。使用范围：分组折叠和搜索焦点。解耦评估：常量本就是共享约定，经本目录 imports.ts 接入最稳。 */
import { Constants } from "./imports";
/** 用途：按 Range 恢复焦点。使用范围：主键 block-more 分支。解耦评估：焦点控制是共享工具，不应在当前模块本地实现。 */
import { focusByRange } from "./imports";
/** 用途：读取 Android 桥接对象。使用范围：搜索图标点击后判断是否可主动唤起键盘。解耦评估：平台桥接访问必须在环境层收口。 */
import { getWindowJSAndroid } from "./imports";
/** 用途：读取 Harmony 桥接对象。使用范围：搜索图标点击后判断是否可主动唤起键盘。解耦评估：同 Android 桥接，继续经环境层转发更符合约束。 */
import { getWindowJSHarmony } from "./imports";
/** 用途：按类名查找局部容器。使用范围：load-more 查找 body 容器。解耦评估：DOM 遍历规则继续复用共享工具即可。 */
import { hasClosestByClassName } from "./imports";
/** 用途：弹出引用提示。使用范围：主键 block-more 分支。解耦评估：提示面板是独立能力，当前模块只提供文本上下文。 */
import { hintRef } from "./imports";
/** 用途：收窄 DOM 查询结果。使用范围：body、分组箭头和搜索框节点校验。解耦评估：DOM guard 属于基础能力，继续统一复用更清晰。 */
import { isHTMLElement } from "./imports";
/** 用途：移除全局菜单。使用范围：主键按钮点击前。解耦评估：全局菜单访问必须经 environment 封装。 */
import { removeSiyuanMenu } from "./imports";
import {getGroupFoldTip, getGroupFoldedStates, initUnfoldedGroupTables, updateGroupFoldedStates} from "./imports";
/** 用途：提交分组折叠事务。使用范围：延迟折叠回调。解耦评估：经现有 click 网关直达 Groups 严格命令。 */
import {submitAVGroupTransaction} from "./imports";
/** 用途：统一结束已处理点击。使用范围：所有高级 data-type handler 的成功分支。解耦评估：这是 click 子目录内部共用动作，集中在 shared.ts 更利于复用。 */
import { consumeClickEvent } from "./shared";

let foldTimeout: ReturnType<typeof setTimeout> | undefined;

/**
 * 作用：构建分组折叠事务需要的正反向操作数组。
 * 意图：把事务数据准备与延时调度解耦，避免点击处理函数里直接拼装长回调。
 * 调用时机：`handleGroupFoldClick` 的延时提交阶段调用。
 * 问题/改进：当前仍依赖 blockElement/target 上的数据属性。
 */
const buildFoldTransactionActions = (blockElement: Element, id: string | undefined, isOpen: boolean) => {
    const avID = blockElement.getAttribute("data-av-id");
    const blockID = blockElement.getAttribute("data-node-id");
    if (!avID || !blockID || !id) {
        return null;
    }
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) ||
        blockElement.querySelector(".layout-tab-bar .item--focus")?.getAttribute("data-id") || undefined;
    const baseAction = {
        action: "foldAttrViewGroup" as const,
        avID,
        blockID,
        id,
        ...(viewID ? {viewID} : {}),
    };
    return {
        redoActions: [{ ...baseAction, data: isOpen }],
        undoActions: [{ ...baseAction, data: !isOpen }],
    };
};

/**
 * 作用：在 table 视图下同步主键按钮点击后的选中态。
 * 意图：保持 block-more 在 table 视图里额外高亮所在单元格并显示拖拽填充手柄的原行为。
 * 调用时机：block-more 点击且 viewType 为 table 时调用。
 * 问题/改进：当前仍依赖按钮父节点就是目标单元格的 DOM 结构。
 */
const markTableBlockCellSelected = (target: HTMLElement) => {
    const parentCell = target.parentElement;
    if (!isHTMLElement(parentCell)) {
        return;
    }
    parentCell.classList.add("av__cell--select");
    addDragFill(parentCell);
};

/**
 * 作用：处理主键 block-more 点击。
 * 意图：保持“选中文本、清理菜单、弹引用提示”的原行为。
 * 调用时机：data-type 分发命中 `block-more` 时调用。
 * 问题/改进：仍依赖按钮前一个兄弟节点承载主键文本。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleBlockMoreClick = (protyle: IProtyle, target: HTMLElement, viewType: TAVView, event: MouseEvent) => {
    if (!protyle.toolbar) {
        return false;
    }
    removeSiyuanMenu();
    const range = document.createRange();
    protyle.toolbar.range = range;
    range.selectNodeContents(target);
    focusByRange(range);
    // 表格视图会额外高亮当前主键单元格，并恢复拖拽填充手柄。
    if (viewType === "table") {
        markTableBlockCellSelected(target);
    }
    const referenceText = target.previousElementSibling?.textContent?.trim() ?? "";
    hintRef(referenceText, protyle, "av");
    return consumeClickEvent(event);
};

/**
 * 作用：延时提交分组折叠事务。
 * @显式返回类型原因: setTimeout 的回调函数需要闭包捕获 blockElement/groupId/isOpen 状态，提取为命名函数可保持闭包变量清晰可审计。
 */
const onFoldTimeout = (blockElement: Element, groupId: string | undefined, isOpen: boolean, protyle: IProtyle) => {
    const actions = buildFoldTransactionActions(blockElement, groupId, isOpen);
    if (!actions) {
        return;
    }
    submitAVGroupTransaction(protyle, actions.redoActions, actions.undoActions);
};

/**
 * 作用：处理分组折叠箭头点击。
 * 意图：先立即更新本地 DOM，再延时提交折叠事务。
 * 调用时机：data-type 分发命中 `av-group-fold` 时调用。
 * 问题/改进：当前仍使用定时器合并连续点击。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
const setGroupFolded = (target: HTMLElement, folded: boolean) => {
    const arrowElement = target.firstElementChild;
    const bodyElement = target.parentElement?.nextElementSibling;
    if (!isHTMLElement(arrowElement) || !isHTMLElement(bodyElement)) {
        return false;
    }
    arrowElement.classList.toggle("av__group-arrow--open", !folded);
    bodyElement.classList.toggle("fn__none", folded);
    target.setAttribute("aria-label", getGroupFoldTip(folded));
    return true;
};

/**
 * 作用：处理 Alt 批量折叠的事务提交。
 * 意图：将 Alt 分支的 do/undo 数据收集与事务提交从主点击流程中抽离，降低主函数行数与嵌套。
 * 调用时机：handleGroupFoldClick 检测到 event.altKey 时调用。
 * 问题/改进：仍依赖 blockElement 上的 dataset 与折叠状态快照。
 */
const handleAltGroupFold = (protyle: IProtyle, blockElement: HTMLElement, viewID: string | undefined, folded: boolean, event: MouseEvent) => {
    const doData: Record<string, boolean> = {};
    const undoData = getGroupFoldedStates(blockElement);
    for (const item of blockElement.querySelectorAll<HTMLElement>('[data-type="av-group-fold"]')) {
        const groupID = item.dataset.id;
        if (!groupID) {
            continue;
        }
        if (typeof undoData[groupID] !== "boolean") {
            undoData[groupID] = !item.firstElementChild?.classList.contains("av__group-arrow--open");
        }
        item.setAttribute("data-processed", "true");
        setGroupFolded(item, folded);
    }
    for (const groupID of Object.keys(undoData)) {
        doData[groupID] = folded;
    }
    initUnfoldedGroupTables(blockElement, protyle);
    updateGroupFoldedStates(blockElement, doData);
    clearTimeout(foldTimeout);
    const avID = blockElement.getAttribute("data-av-id") || undefined;
    const blockID = blockElement.getAttribute("data-node-id") || undefined;
    submitAVGroupTransaction(protyle, [{
        action: "foldAttrViewGroups",
        ...(avID ? {avID} : {}),
        ...(blockID ? {blockID} : {}),
        ...(viewID ? {viewID} : {}),
        data: doData,
    }], [{
        action: "foldAttrViewGroups",
        ...(avID ? {avID} : {}),
        ...(blockID ? {blockID} : {}),
        ...(viewID ? {viewID} : {}),
        data: undoData,
    }]);
    return consumeClickEvent(event);
};

export const handleGroupFoldClick = (
    protyle: IProtyle,
    target: HTMLElement,
    blockElement: HTMLElement,
    event: MouseEvent,
) => {
    const arrowElement = target.firstElementChild;
    if (!isHTMLElement(arrowElement)) {
        return false;
    }
    const folded = arrowElement.classList.contains("av__group-arrow--open");
    const viewID = blockElement.getAttribute(Constants.CUSTOM_SY_AV_VIEW) ||
        blockElement.querySelector(".layout-tab-bar .item--focus")?.getAttribute("data-id") || undefined;
    if (event.altKey) {
        return handleAltGroupFold(protyle, blockElement, viewID, folded, event);
    }
    target.setAttribute("data-processed", "true");
    if (!setGroupFolded(target, folded)) {
        return false;
    }
    initUnfoldedGroupTables(blockElement, protyle);
    const groupId = target.dataset.id;
    if (groupId) {
        updateGroupFoldedStates(blockElement, {[groupId]: folded});
    }
    clearTimeout(foldTimeout);
    foldTimeout = setTimeout(() => onFoldTimeout(blockElement, groupId, folded, protyle), Constants.TIMEOUT_COUNT);
    return consumeClickEvent(event);
};

/**
 * 作用：还原 footer 行的 transform。
 * 意图：保持 load-more 前先清除过渡残留的原行为。
 * 调用时机：`av-load-more` 点击后立即调用。
 * 问题/改进：当前仍依赖 `.av__row--footer` DOM class。
 */
const resetFooterTransforms = (blockElement: Element) => {
    const footerRows = blockElement.querySelectorAll(".av__row--footer");
    for (const footerRow of footerRows) {
        // querySelectorAll 返回的是通用 Element，这里只在节点可写 style 时才清理 transform。
        if (isHTMLElement(footerRow)) {
            footerRow.style.transform = "";
        }
    }
};

/**
 * 作用：处理加载更多按钮点击。
 * 意图：扩展 pageSize 后重新渲染属性视图。
 * 调用时机：data-type 分发命中 `av-load-more` 时调用。
 * 问题/改进：页大小仍完全来自 DOM dataset。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleLoadMoreClick = (protyle: IProtyle, target: HTMLElement, blockElement: Element, event: MouseEvent) => {
    resetFooterTransforms(blockElement);
    blockElement.removeAttribute("data-render");
    const bodyCandidate = hasClosestByClassName(target, "av__body");
    if (!isHTMLElement(bodyCandidate)) {
        return false;
    }
    const pageSizeTrigger = bodyCandidate.querySelector('[data-type="set-page-size"]');
    const currentPageSize = parseInt(bodyCandidate.dataset.pageSize ?? "0", 10);
    const pageIncrement = parseInt(pageSizeTrigger?.getAttribute("data-size") ?? "0", 10);
    bodyCandidate.dataset.pageSize = (currentPageSize + pageIncrement).toString();
    avRender(blockElement, protyle);
    return consumeClickEvent(event);
};

/**
 * 作用：处理搜索图标点击。
 * 意图：展开搜索框并在移动原生容器中主动唤起键盘。
 * 调用时机：data-type 分发命中 `av-search-icon` 时调用。
 * 问题/改进：宽度与间距仍是硬编码值。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const handleSearchIconClick = (target: HTMLElement, blockElement: Element, event: MouseEvent) => {
    const searchElement = blockElement.querySelector('div[data-type="av-search"]');
    if (!isHTMLElement(searchElement)) {
        return false;
    }
    searchElement.style.width = "128px";
    searchElement.style.paddingLeft = "";
    searchElement.style.paddingRight = "";
    searchElement.style.marginRight = "1em";
    const viewsCandidate = hasClosestByClassName(searchElement, "av__views");
    // 搜索框展开时会同时展开视图栏包裹容器，保持原始显示效果。
    if (isHTMLElement(viewsCandidate)) {
        viewsCandidate.classList.add("av__views--show");
    }
    const hasKeyboardBridge = Boolean(getWindowJSAndroid()?.showKeyboard || getWindowJSHarmony()?.showKeyboard);
    if (hasKeyboardBridge) {
        callMobileAppShowKeyboard();
        // 这里保留固定延时，是因为原生键盘唤起和 WebView 焦点建立没有可靠事件可订阅，只能沿用现有过渡时长约定。
        setTimeout(() => {
            searchElement.focus();
        }, Constants.TIMEOUT_TRANSITION);
        return consumeClickEvent(event);
    }
    searchElement.focus();
    return consumeClickEvent(event);
};
