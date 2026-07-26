/**
 * @fileoverview 设置拖拽分割线事件处理
 */

import {setStorageVal} from "../../../util/storage/setStorageVal";
import { Constants } from "../../../constants";
import type {ProtyleDomain} from "../../../protyle/protyle.types";
import { resize } from "../../../protyle/util/resize";
import { getSafeSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { ILayoutConfig } from "./SearchContext.types";

/** 获取布局配置 */
function getLayoutConfig(closeCB: boolean): ILayoutConfig {
    const layoutKey = closeCB ? "layout" : "layoutTab";
    const storage = getSafeSiyuanStorage();
    const searchKeys = storage?.[Constants.LOCAL_SEARCHKEYS];
    const direction = searchKeys?.[layoutKey] === 1 ? "lr" : "tb";
    const isHorizontal = direction === "lr";
    const storageKey = isHorizontal
        ? (closeCB ? "col" : "colTab")
        : (closeCB ? "row" : "rowTab");
    return {
        direction,
        positionKey: isHorizontal ? "clientX" : "clientY",
        sizeKey: isHorizontal ? "width" : "height",
        clientSizeKey: isHorizontal ? "clientWidth" : "clientHeight",
        storageKey,
    };
}

/** 保存布局到存储 */
function saveLayoutToStorage(storageKey: string, value: string): void {
    const storage = getSafeSiyuanStorage();
    if (!storage) {
        return;
    }
    const searchKeys = storage[Constants.LOCAL_SEARCHKEYS];
    if (searchKeys) {
        searchKeys[storageKey] = value;
        setStorageVal(Constants.LOCAL_SEARCHKEYS, searchKeys);
    }
}

/** 清理鼠标事件监听器 */
function cleanupMouseListeners(element: HTMLElement): void {
    element.style.userSelect = "";
    document.onmousemove = null;
    document.onmouseup = null;
    document.ondragstart = null;
    document.onselectstart = null;
    document.onselect = null;
}

/** 处理拖拽开始事件 */
function handleDragStart(
    event: MouseEvent,
    dragElement: Element,
    element: HTMLElement,
    edit: ProtyleDomain,
    closeCB: boolean
): void {
    const config = getLayoutConfig(closeCB);
    const nextElement = dragElement.nextElementSibling;
    const previousElement = dragElement.previousElementSibling;
    if (!(nextElement instanceof HTMLElement) || !(previousElement instanceof HTMLElement)) {
        return;
    }

    const startPosition = event[config.positionKey];
    const previousSize = previousElement[config.clientSizeKey];
    const nextSize = nextElement[config.clientSizeKey];

    nextElement.classList.remove("fn__flex-1");
    nextElement.style[config.sizeKey] = nextSize + "px";
    element.style.userSelect = "none";

    document.onmousemove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const delta = moveEvent[config.positionKey] - startPosition;
        if (previousSize + delta < 120 || nextSize - delta < 120) {
            return;
        }
        nextElement.style[config.sizeKey] = (nextSize - delta) + "px";
    };

    document.onmouseup = () => {
        cleanupMouseListeners(element);
        saveLayoutToStorage(config.storageKey, nextElement[config.clientSizeKey] + "px");
        if (config.direction === "lr") {
            resize(edit.protyle);
        }
    };
}

/** 处理双击重置事件 */
function handleDoubleClick(edit: ProtyleDomain, closeCB: boolean): void {
    const config = getLayoutConfig(closeCB);
    edit.protyle.element.style[config.sizeKey] = "";
    edit.protyle.element.classList.add("fn__flex-1");
    saveLayoutToStorage(config.storageKey, "");
    if (config.direction === "lr") {
        resize(edit.protyle);
    }
}

/**
 * 设置拖拽分割线的事件处理
 * 
 * @param element - 根容器元素
 * @param edit - 预览编辑器
 * @param closeCB - 是否存在关闭回调
 * @param _localSearch - 本地搜索配置 (保留参数以保持接口兼容)
 */
export function setupDragHandler(
    element: HTMLElement,
    edit: ProtyleDomain,
    closeCB: boolean,
    _localSearch: ISearchAssetOption
): void {
    const dragElement = element.querySelector(".search__drag");
    if (!dragElement) {
        return;
    }
    dragElement.addEventListener("mousedown", (e: Event) => {
        if (e instanceof MouseEvent) {
            handleDragStart(e, dragElement, element, edit, closeCB);
        }
    });
    dragElement.addEventListener("dblclick", () => handleDoubleClick(edit, closeCB));
}
