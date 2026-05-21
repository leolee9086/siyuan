/**
 * @fileoverview 设置主点击事件处理器
 * @description 使用事件委托分发点击事件到各个处理器
 */

import { saveCriterion } from "../../menu";
import {
    handleRemoveCriterion,
    handleSetCriteria,
    handleRemoveCriteria,
} from "./handlers/handleCriteriaClick";
import { handleNextPage, handlePreviousPage } from "./handlers/handlePaginationClick";
import { handleSearchExpand, handleSearchCollapse } from "./handlers/handleExpandCollapseClick";
import { handleSearchPin } from "./handlers/handlePinClick";
import { handleSearchPath, handleRemovePath, handleSearchInclude } from "./handlers/handlePathClick";
import {
    handleSearchReplace,
    handleReplaceFilter,
    handleSearchFilter,
} from "./handlers/handleReplaceClick";
import { replace } from "../../util";
import { openSearchUnRef, unRefMoreMenu } from "../../unRef";
import {
    handleSearchUnRefClose,
    handleUnRefPrevious,
    handleUnRefNext,
} from "./handlers/handleUnRefClick";
import { assetInputEvent, assetFilterMenu, assetMethodMenu } from "../../assets";
import { openSearchAsset } from "../../assets.openSearchAsset";
import {
    handleSearchAssetClose,
    handleAssetMore,
    handleAssetPrevious,
    handleAssetNext,
    onAssetMethodChange,
} from "./handlers/handleAssetClick";
import { toggleSearchHistory, toggleAssetHistory } from "../../toggleHistory";
import {
    handleSearchRefresh,
    handleSearchOpen,
    handleSearchMore,
    handleSearchSyntaxCheck,
    handleReplaceHistoryBtn,
} from "./handlers/handleSearchControlClick";
import { handleListItemClick, handleListToggleClick } from "./handlers/handleListItemClick";
import { isStylableElement } from "../../../util/DOM/element.guard";
import type {
    IClickHandlerUIElements,
    IClickHandlerState,
    IClickHandlerCallbacks,
    IClickContext,
    IClassClickResult,
    IClickListenerState,
} from "./SearchContext.types";

// 重新导出类型以便外部使用
export type { IClickHandlerUIElements, IClickHandlerState, IClickHandlerCallbacks };

/** 基于 ID 的简单处理器映射 */
const idHandlers: Record<string, (ctx: IClickContext) => void> = {
    searchExpand: (ctx) => handleSearchExpand(ctx.ui.searchPanelElement),
    searchCollapse: (ctx) => handleSearchCollapse(ctx.ui.searchPanelElement),
    searchPin: (ctx) => handleSearchPin(ctx.target, ctx.ui.element, ctx.ui.searchInputElement),
    searchPath: (ctx) => handleSearchPath(ctx.state.config, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB),
    searchInclude: (ctx) => handleSearchInclude(ctx.target, ctx.state.config, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB),
    searchReplace: (ctx) => handleSearchReplace(ctx.state.config, ctx.ui.element, ctx.callbacks.updateCB),
    replaceFilter: (ctx) => handleReplaceFilter(ctx.state.config),
    replaceBtn: (ctx) => replace(ctx.ui.element, ctx.state.config, ctx.state.edit, false),
    replaceAllBtn: (ctx) => replace(ctx.ui.element, ctx.state.config, ctx.state.edit, true),
    searchUnRef: (ctx) => openSearchUnRef(ctx.ui.unRefPanelElement, ctx.state.unRefEdit),
    unRefMore: (ctx) => unRefMoreMenu(ctx.target, ctx.ui.unRefPanelElement, ctx.state.unRefEdit),
    searchUnRefClose: (ctx) => handleSearchUnRefClose(ctx.ui.unRefPanelElement, ctx.ui.assetsElement, ctx.ui.searchInputElement),
    searchAsset: (ctx) => openSearchAsset(ctx.ui.assetsElement, !ctx.callbacks.closeCB),
    searchAssetClose: (ctx) => handleSearchAssetClose(ctx.ui.assetsElement, ctx.ui.searchInputElement),
    assetMore: (ctx) => handleAssetMore(ctx.target, ctx.ui.assetsElement, ctx.state.localSearch),
    assetFilter: (ctx) => assetFilterMenu(ctx.ui.assetsElement),
    assetSyntaxCheck: (ctx) => assetMethodMenu(ctx.target, () => onAssetMethodChange(ctx.ui.element, ctx.ui.assetsElement, ctx.state.localSearch)),
    searchRefresh: (ctx) => handleSearchRefresh(ctx.ui.element, ctx.state.config, ctx.state.edit, ctx.callbacks.updateCB),
    searchOpen: (ctx) => handleSearchOpen(ctx.state.app, ctx.state.config, ctx.ui.searchInputElement, ctx.ui.replaceInputElement, ctx.callbacks.closeCB),
    searchFilter: (ctx) => handleSearchFilter(ctx.state.config, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB),
    searchSyntaxCheck: (ctx) => handleSearchSyntaxCheck(ctx.target, ctx.state.config, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB),
};

/** 基于 ID 的历史按钮处理器（需要特殊的事件处理） */
const historyHandlers: Record<string, (ctx: IClickContext) => void> = {
    searchHistoryBtn: (ctx) => toggleSearchHistory(ctx.ui.element, ctx.state.config, ctx.state.edit),
    assetHistoryBtn: (ctx) => toggleAssetHistory(ctx.ui.assetsElement),
    replaceHistoryBtn: (ctx) => handleReplaceHistoryBtn(ctx.ui.element),
};

/** 基于 data-type 的处理器映射 */
const typeHandlers: Record<string, (ctx: IClickContext) => void> = {
    removeCriterion: (ctx) => {
        ctx.state.config = handleRemoveCriterion(ctx.ui.element, ctx.state.config, ctx.state.edit, ctx.callbacks.updateCB);
    },
    saveCriterion: (ctx) => saveCriterion(ctx.state.config, ctx.state.criteriaData, ctx.ui.element),
    next: (ctx) => handleNextPage(ctx.target, ctx.state.config, ctx.ui.element, ctx.state.edit),
    previous: (ctx) => handlePreviousPage(ctx.target, ctx.state.config, ctx.ui.element, ctx.state.edit),
    unRefPrevious: (ctx) => handleUnRefPrevious(ctx.target, ctx.ui.unRefPanelElement, ctx.state.unRefEdit),
    unRefNext: (ctx) => handleUnRefNext(ctx.target, ctx.ui.unRefPanelElement, ctx.state.unRefEdit),
    assetPrevious: (ctx) => handleAssetPrevious(ctx.target, ctx.ui.assetsElement, ctx.state.localSearch),
    assetNext: (ctx) => handleAssetNext(ctx.target, ctx.ui.assetsElement, ctx.state.localSearch),
    assetRefresh: (ctx) => assetInputEvent(ctx.ui.assetsElement),
};

/** 需要更新 config 的 ID 处理器 */
const configUpdatingIdHandlers: Record<string, (ctx: IClickContext) => Config.IUILayoutTabSearchConfig> = {
    searchMore: (ctx) => handleSearchMore(ctx.target, ctx.state.config, ctx.state.criteriaData, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB),
};



/** 处理基于 CSS 类名的特殊情况 */
function handleClassBasedClick(ctx: IClickContext): IClassClickResult {
    if (ctx.target.classList.contains("search__rmpath")) {
        handleRemovePath(ctx.state.config, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB);
        return { handled: true, clickTimeout: ctx.clickTimeout, lastClickTime: ctx.lastClickTime };
    }
    if (ctx.target.classList.contains("b3-chip") && ctx.type === "set-criteria") {
        ctx.state.config = handleSetCriteria(ctx.target, ctx.state.config, ctx.state.criteriaData, ctx.ui.element, ctx.state.edit, ctx.callbacks.updateCB);
        return { handled: true, clickTimeout: ctx.clickTimeout, lastClickTime: ctx.lastClickTime };
    }
    if (ctx.target.classList.contains("b3-chip__close") && ctx.type === "remove-criteria") {
        ctx.state.config = handleRemoveCriteria(ctx.target, ctx.state.config, ctx.state.criteriaData, ctx.ui.element, ctx.state.edit);
        return { handled: true, clickTimeout: ctx.clickTimeout, lastClickTime: ctx.lastClickTime };
    }
    if (ctx.target.classList.contains("b3-list-item__toggle")) {
        handleListToggleClick(ctx.target);
        return { handled: true, clickTimeout: ctx.clickTimeout, lastClickTime: ctx.lastClickTime };
    }
    if (ctx.target.classList.contains("b3-list-item")) {
        const result = handleListItemClick(ctx.target, ctx.event, {
            app: ctx.state.app,
            element: ctx.ui.element,
            edit: ctx.state.edit,
            unRefEdit: ctx.state.unRefEdit,
            config: ctx.state.config,
            searchInputElement: ctx.ui.searchInputElement,
            searchPanelElement: ctx.ui.searchPanelElement,
            unRefPanelElement: ctx.ui.unRefPanelElement,
            closeCB: ctx.callbacks.closeCB,
            clickTimeout: ctx.clickTimeout,
            lastClickTime: ctx.lastClickTime,
        });
        return { handled: true, clickTimeout: result.clickTimeout, lastClickTime: result.lastClickTime };
    }
    return { handled: false, clickTimeout: ctx.clickTimeout, lastClickTime: ctx.lastClickTime };
}



/** 分发点击事件到对应的处理器 */
function dispatchClick(
    ctx: IClickContext,
    state: IClickHandlerState,
    listenerState: IClickListenerState
): boolean {
    const { targetId, type } = ctx;

    // ID 处理器
    if (idHandlers[targetId]) {
        idHandlers[targetId](ctx);
        return true;
    }
    // 更新 config 的 ID 处理器
    if (configUpdatingIdHandlers[targetId]) {
        state.config = configUpdatingIdHandlers[targetId](ctx);
        return true;
    }
    // type 处理器
    if (type && typeHandlers[type]) {
        typeHandlers[type](ctx);
        return true;
    }
    // CSS 类名处理器
    const result = handleClassBasedClick(ctx);
    listenerState.clickTimeout = result.clickTimeout;
    listenerState.lastClickTime = result.lastClickTime;
    return result.handled;
}

/** 创建点击事件处理函数 */
function createClickListener(
    ui: IClickHandlerUIElements,
    state: IClickHandlerState,
    callbacks: IClickHandlerCallbacks,
    listenerState: IClickListenerState
): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
        const eventTarget = event.target;
        if (!isStylableElement(eventTarget)) {
            return;
        }
        let target: Element | null = eventTarget;

        while (target && target !== ui.element) {
            // 只处理 HTMLElement，忽略 purely SVG 节点（如 path, use 等），但在 DOM 树中向上查找直到找到 HTMLElement
            if (!(target instanceof HTMLElement)) {
                target = target.parentElement;
                continue;
            }

            const type = target.getAttribute("data-type");
            const targetId = target.id;
            const ctx: IClickContext = {
                target, type, targetId, ui, state, callbacks, event,
                clickTimeout: listenerState.clickTimeout,
                lastClickTime: listenerState.lastClickTime,
            };

            // 历史按钮需要特殊处理（提前返回）
            if (historyHandlers[targetId]) {
                historyHandlers[targetId](ctx);
                event.stopPropagation();
                event.preventDefault();
                return;
            }

            if (dispatchClick(ctx, state, listenerState)) {
                event.stopPropagation();
                event.preventDefault();
                break;
            }
            target = target.parentElement;
        }
    };
}

/**
 * 设置主点击事件处理器
 * @param ui - UI 元素引用
 * @param state - 状态数据
 * @param callbacks - 回调函数
 */
export function setupClickHandler(
    ui: IClickHandlerUIElements,
    state: IClickHandlerState,
    callbacks: IClickHandlerCallbacks
): void {
    const listenerState: IClickListenerState = {
        clickTimeout: 0,
        lastClickTime: Date.now(),
    };
    const clickListener = createClickListener(ui, state, callbacks, listenerState);
    ui.element.addEventListener("click", clickListener, false);
}

