/**
 * @fileoverview 资源搜索相关点击处理
 */

import { setStorageVal } from "../../../../ai/imports";
import { Constants } from "../../../../constants";
import { assetInputEvent, assetMoreMenu, assetMethodMenu } from "../../../assets";
import { genQueryHTML } from "../../../util";

/**
 * 处理关闭资源搜索面板
 */
export function handleSearchAssetClose(
    assetsElement: HTMLElement,
    searchInputElement: HTMLInputElement
): void {
    window.siyuan.menus.menu.remove();
    assetsElement.classList.add("fn__none");
    assetsElement.previousElementSibling?.classList.remove("fn__none");
    searchInputElement.select();
}

/**
 * 处理资源更多菜单
 */
export function handleAssetMore(
    target: HTMLElement,
    assetsElement: HTMLElement,
    localSearch: ISearchAssetOption
): void {
    assetMoreMenu(target, assetsElement, () => {
        assetInputEvent(assetsElement);
        setStorageVal(Constants.LOCAL_SEARCHASSET, localSearch);
    });
}

/**
 * 处理资源上一页
 */
export function handleAssetPrevious(
    target: HTMLElement,
    assetsElement: HTMLElement,
    localSearch: ISearchAssetOption
): void {
    if (target.getAttribute("disabled")) {
        return;
    }

    const resultElement = assetsElement.querySelector("#searchAssetResult .fn__flex-center");
    if (!resultElement) {
        return;
    }

    const textContent = resultElement.textContent || "";
    let currentPage = parseInt(textContent.split("/")[0]);

    if (currentPage > 1) {
        currentPage--;
        assetInputEvent(assetsElement, localSearch, currentPage);
    }
}

/**
 * 处理资源下一页
 */
export function handleAssetNext(
    target: HTMLElement,
    assetsElement: HTMLElement,
    localSearch: ISearchAssetOption
): void {
    if (target.getAttribute("disabled")) {
        return;
    }

    const resultElement = assetsElement.querySelector("#searchAssetResult .fn__flex-center");
    if (!resultElement) {
        return;
    }

    const textContent = resultElement.textContent || "";
    const currentPage = parseInt(textContent.split("/")[0]);
    const totalPages = parseInt(textContent.split("/")[1] || "1");

    if (currentPage < totalPages) {
        assetInputEvent(assetsElement, localSearch, currentPage + 1);
    }
}

/**
 * 处理资源语法检查
 */
export function handleAssetSyntaxCheck(
    target: HTMLElement,
    element: HTMLElement,
    assetsElement: HTMLElement,
    localSearch: ISearchAssetOption
): void {
    assetMethodMenu(target, () => {
        const syntaxCheckElement = element.querySelector("#assetSyntaxCheck");
        if (syntaxCheckElement) {
            syntaxCheckElement.outerHTML = genQueryHTML(localSearch.method, "assetSyntaxCheck");
        }
        assetInputEvent(assetsElement, localSearch);
        setStorageVal(Constants.LOCAL_SEARCHASSET, localSearch);
    });
}

