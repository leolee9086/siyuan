/**
 * @fileoverview 无效引用面板相关点击处理
 */

import type {ProtyleDomain} from "../../../../protyle/protyle.types";
import { getUnRefList } from "../../../unRef";

/**
 * 处理关闭无效引用面板
 */
export function handleSearchUnRefClose(
    unRefPanelElement: HTMLElement,
    assetsElement: HTMLElement,
    searchInputElement: HTMLInputElement
): void {
    window.siyuan.menus.menu.remove();
    unRefPanelElement.classList.add("fn__none");
    assetsElement.previousElementSibling?.classList.remove("fn__none");
    searchInputElement.select();
}

/**
 * 处理无效引用上一页
 */
export function handleUnRefPrevious(
    target: HTMLElement,
    unRefPanelElement: HTMLElement,
    unRefEdit: ProtyleDomain
): void {
    if (target.getAttribute("disabled")) {
        return;
    }

    const resultElement = unRefPanelElement.querySelector("#searchUnRefResult");
    if (!resultElement) {
        return;
    }

    let currentPage = parseInt(resultElement.textContent || "1");
    if (currentPage > 1) {
        currentPage--;
        getUnRefList(unRefPanelElement, unRefEdit, currentPage);
    }
}

/**
 * 处理无效引用下一页
 */
export function handleUnRefNext(
    target: HTMLElement,
    unRefPanelElement: HTMLElement,
    unRefEdit: ProtyleDomain
): void {
    if (target.getAttribute("disabled")) {
        return;
    }

    const resultElement = unRefPanelElement.querySelector("#searchUnRefResult");
    if (!resultElement) {
        return;
    }

    const textContent = resultElement.textContent || "";
    const currentPage = parseInt(textContent);
    const totalPages = parseInt(textContent.split("/")[1] || "1");

    if (currentPage < totalPages) {
        getUnRefList(unRefPanelElement, unRefEdit, currentPage + 1);
    }
}
