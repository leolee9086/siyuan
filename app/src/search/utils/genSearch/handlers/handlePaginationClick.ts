/**
 * @fileoverview 翻页相关点击处理
 */

import type {ProtyleDomain} from "../../../../protyle/protyle.types";
import { inputEvent } from "../../../inputEvent";

/**
 * 处理下一页点击
 */
export function handleNextPage(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain
): void {
    if (target.getAttribute("disabled")) {
        return;
    }

    const searchResultElement = target.parentElement?.querySelector("#searchResult");
    if (!searchResultElement) {
        return;
    }

    const pageCount = parseInt(searchResultElement.getAttribute("data-pagecount") || "1");
    if (config.page < pageCount) {
        config.page++;
        inputEvent(element, config, edit);
    }
}

/**
 * 处理上一页点击
 */
export function handlePreviousPage(
    target: HTMLElement,
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain
): void {
    if (target.getAttribute("disabled")) {
        return;
    }

    if (config.page > 1) {
        config.page--;
        inputEvent(element, config, edit);
    }
}
