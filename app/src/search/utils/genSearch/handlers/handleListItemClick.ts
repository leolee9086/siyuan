/**
 * @fileoverview 列表项点击处理
 */

import * as path from "path";
import { Constants } from "../../../../constants";
import { Protyle } from "../../../../protyle";
import { isIPad, isNotCtrl } from "../../../../protyle/util/compatibility";
import { useShell } from "../../../../util/pathName";
import { newFileByName } from "../../../../util/newFile";
import { renderPreview, renderNextAssetMark } from "../../../assets";
import { getArticle, openSearchEditor, renderNextSearchMark } from "../../../util";
import type { App } from "../../../..";

interface IListItemClickContext {
    app: App;
    element: HTMLElement;
    edit: Protyle;
    unRefEdit: Protyle;
    config: Config.IUILayoutTabSearchConfig;
    searchInputElement: HTMLInputElement;
    searchPanelElement: Element;
    unRefPanelElement: HTMLElement;
    closeCB: (() => void) | undefined;
    clickTimeout: number;
    lastClickTime: number;
}

/**
 * 处理列表项点击
 */
export function handleListItemClick(
    target: HTMLElement,
    event: MouseEvent,
    ctx: IListItemClickContext
): { clickTimeout: number; lastClickTime: number } {
    const type = target.getAttribute("data-type");
    const searchAssetInputElement = ctx.element.querySelector("#searchAssetInput") as HTMLInputElement;

    let { clickTimeout, lastClickTime } = ctx;

    // 新建文件
    if (type === "search-new") {
        if (ctx.config.method === 0) {
            newFileByName(ctx.app, ctx.searchInputElement.value);
        }
        return { clickTimeout, lastClickTime };
    }

    // 搜索项点击
    if (type === "search-item") {
        const searchType = target.dataset.id ? "asset" : (ctx.unRefPanelElement.classList.contains("fn__none") ? "doc" : "unRef");

        let isClick = event.detail === 1;
        let isDblClick = event.detail === 2;

        /// #if BROWSER
        if (isIPad()) {
            const newDate = new Date().getTime();
            isClick = newDate - lastClickTime > Constants.TIMEOUT_DBLCLICK;
            isDblClick = !isClick;
            lastClickTime = newDate;
        }
        /// #endif

        if (isClick) {
            clickTimeout = window.setTimeout(() => {
                handleSingleClick(target, searchType, ctx, searchAssetInputElement);
            }, Constants.TIMEOUT_DBLCLICK);
        } else if (isDblClick && isNotCtrl(event)) {
            clearTimeout(clickTimeout);
            handleDoubleClick(target, searchType, ctx);
        }

        window.siyuan.menus.menu.remove();
        return { clickTimeout, lastClickTime };
    }

    // 切换子项展开/折叠
    if (target.querySelector(".b3-list-item__toggle")) {
        target.nextElementSibling?.classList.toggle("fn__none");
        target.firstElementChild?.firstElementChild?.classList.toggle("b3-list-item__arrow--open");
    }

    return { clickTimeout, lastClickTime };
}

/**
 * 处理单击
 */
function handleSingleClick(
    target: HTMLElement,
    searchType: string,
    ctx: IListItemClickContext,
    searchAssetInputElement: HTMLInputElement
): void {
    if (searchType === "asset") {
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
        } else {
            renderNextAssetMark(ctx.element.querySelector("#searchAssetPreview"));
            searchAssetInputElement?.focus();
        }
        return;
    }

    // 文档或无效引用
    const altKey = window.event && (window.event as KeyboardEvent).altKey;
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
    } else if (searchType === "doc") {
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
        /// #if !BROWSER
        useShell("showItemInFolder", path.join(
            window.siyuan.config.system.dataDir,
            target.lastElementChild?.getAttribute("aria-label") || ""
        ));
        /// #endif
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
