/**
 * @fileoverview 列表项点击处理
 */

import * as path from "path";
import { Constants } from "../../../../constants";
import { isIPad, isNotCtrl } from "../../../../protyle/util/compatibility";
import { useShell } from "../../../../util/file/pathName";
import { newFile } from "../../../../util/file/newFile";
import { renderPreview, renderNextAssetMark } from "../../../assets";
import { getArticle, openSearchEditor, renderNextSearchMark } from "../../../util";
import { isHTMLInputElement } from "../search.guard";
import { isBrowser, isElectron } from "../../../../platform";
import type { IListItemClickContext } from "../SearchContext.types";

/**
 * 处理列表项点击
 */
export function handleListItemClick(
    target: HTMLElement,
    event: MouseEvent,
    ctx: IListItemClickContext
): { clickTimeout: number; lastClickTime: number } {
    const type = target.getAttribute("data-type");
    const element = ctx.element.querySelector("#searchAssetInput");
    const searchAssetInputElement = isHTMLInputElement(element) ? element : null;

    const { clickTimeout, lastClickTime } = ctx;

    // 新建文件
    if (type === "search-new") {
        if (ctx.config.method === 0) {
            newFile(ctx.app, ctx.searchInputElement.value);
        }
        return { clickTimeout, lastClickTime };
    }

    // 搜索项点击
    if (type === "search-item") {
        return processSearchItemClick(target, event, ctx, searchAssetInputElement, clickTimeout, lastClickTime);
    }

    // 切换子项展开/折叠
    if (target.querySelector(".b3-list-item__toggle")) {
        target.nextElementSibling?.classList.toggle("fn__none");
        target.firstElementChild?.firstElementChild?.classList.toggle("b3-list-item__arrow--open");
    }

    return { clickTimeout, lastClickTime };
}

/**
 * 处理搜索项点击
 */
function processSearchItemClick(
    target: HTMLElement,
    event: MouseEvent,
    ctx: IListItemClickContext,
    searchAssetInputElement: HTMLInputElement | null,
    clickTimeout: number,
    lastClickTime: number
): { clickTimeout: number; lastClickTime: number } {
    const searchType = target.dataset.id ? "asset" : (ctx.unRefPanelElement.classList.contains("fn__none") ? "doc" : "unRef");

    let isClick = event.detail === 1;
    let isDblClick = event.detail === 2;

    // 浏览器环境下 iPad 的 detail 不可靠，需用时间差判断单双击
    if (isBrowser && isIPad()) {
        const newDate = Date.now();
        isClick = newDate - lastClickTime > Constants.TIMEOUT_DBLCLICK;
        isDblClick = !isClick;
        lastClickTime = newDate;
    }

    if (isClick) {
        const altKey = event.altKey;
        clickTimeout = window.setTimeout(() => {
            handleSingleClick(target, searchType, ctx, searchAssetInputElement, altKey);
        }, Constants.TIMEOUT_DBLCLICK);
    }

    if (isDblClick && isNotCtrl(event)) {
        clearTimeout(clickTimeout);
        handleDoubleClick(target, searchType, ctx);
    }

    window.siyuan.menus?.menu?.remove();
    return { clickTimeout, lastClickTime };
}

/**
 * 处理单击
 */
function handleSingleClick(
    target: HTMLElement,
    searchType: string,
    ctx: IListItemClickContext,
    searchAssetInputElement: HTMLInputElement | null,
    altKey: boolean
): void {
    if (searchType === "asset") {
        processAssetClick(target, ctx, searchAssetInputElement);
        return;
    }

    processDocOrUnRefClick(target, searchType, ctx, altKey);
}

/**
 * 处理资源点击
 */
function processAssetClick(
    target: HTMLElement,
    ctx: IListItemClickContext,
    searchAssetInputElement: HTMLInputElement | null
): void {
    if (!target.classList.contains("b3-list-item--focus")) {
        ctx.element.querySelector("#searchAssets .b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
        renderPreview(
            ctx.element.querySelector("#searchAssetPreview"),
            target.dataset.id || "",
            searchAssetInputElement?.value || "",
            window.siyuan.storage[Constants.LOCAL_SEARCHASSET].method
        );
        searchAssetInputElement?.focus();
        return;
    }

    renderNextAssetMark(ctx.element.querySelector("#searchAssetPreview"));
    searchAssetInputElement?.focus();
}

/**
 * 处理文档或无效引用点击
 */
function processDocOrUnRefClick(
    target: HTMLElement,
    searchType: string,
    ctx: IListItemClickContext,
    altKey: boolean
): void {
    if (altKey) {
        openSearchEditor({
            rootId: target.getAttribute("data-root-id") || "",
            protyle: ctx.edit.protyle,
            id: target.getAttribute("data-node-id") || "",
            cb: ctx.closeCB,
            openPosition: "right",
        });
        return;
    }

    if (!target.classList.contains("b3-list-item--focus")) {
        const panelElement = searchType === "doc" ? ctx.searchPanelElement : ctx.unRefPanelElement;
        panelElement.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
        target.classList.add("b3-list-item--focus");
        getArticle({
            edit: searchType === "doc" ? ctx.edit : ctx.unRefEdit,
            id: target.getAttribute("data-node-id") || "",
            config: searchType === "doc" ? ctx.config : null,
            value: searchType === "doc" ? ctx.searchInputElement.value : null,
        });
        ctx.searchInputElement.focus();
        return;
    }

    if (searchType === "doc") {
        renderNextSearchMark({
            edit: ctx.edit,
            id: target.getAttribute("data-node-id") || "",
            target,
        });
        ctx.searchInputElement.focus();
    }
}

/**
 * 处理双击
 */
function handleDoubleClick(
    target: HTMLElement,
    searchType: string,
    ctx: IListItemClickContext
): void {
    if (searchType === "asset") {
        // Electron 环境下调用系统文件管理器显示资源文件所在目录
        if (isElectron) {
            useShell("showItemInFolder", path.join(
                window.siyuan.config.system.dataDir,
                target.lastElementChild?.getAttribute("aria-label") || ""
            ));
        }
        return;
    }

    openSearchEditor({
        rootId: target.getAttribute("data-root-id") || "",
        protyle: ctx.edit.protyle,
        id: target.getAttribute("data-node-id") || "",
        cb: ctx.closeCB
    });
}

/**
 * 处理列表项切换按钮点击
 */
export function handleListToggleClick(target: HTMLElement): void {
    target.parentElement?.nextElementSibling?.classList.toggle("fn__none");
    target.firstElementChild?.classList.toggle("b3-list-item__arrow--open");
}
