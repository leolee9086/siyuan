/**
 * @fileoverview 替换相关点击处理
 */

import type {ProtyleDomain} from "../../../../protyle/protyle.types";
import { filterMenu, replaceFilterMenu } from "../../../menu";
import { inputEvent } from "../../../inputEvent";

/**
 * 处理显示/隐藏替换面板
 */
export function handleSearchReplace(
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    config.hasReplace = !config.hasReplace;
    if (updateCB) {
        updateCB(config);
    }
    element.querySelectorAll(".search__header")[1]?.classList.toggle("fn__none");
    element.querySelector("#criteria .b3-chip--current")?.classList.remove("b3-chip--current");
}

/**
 * 处理替换类型过滤
 */
export function handleReplaceFilter(config: Config.IUILayoutTabSearchConfig): void {
    window.siyuan.menus.menu.remove();
    replaceFilterMenu(config);
}

/**
 * 处理搜索过滤
 */
export function handleSearchFilter(
    config: Config.IUILayoutTabSearchConfig,
    element: HTMLElement,
    edit: ProtyleDomain,
    updateCB?: (config: Config.IUILayoutTabSearchConfig) => void
): void {
    window.siyuan.menus.menu.remove();
    filterMenu(config, () => {
        config.page = 1;
        inputEvent(element, config, edit, true);
        if (updateCB) {
            updateCB(config);
        }
    });
}
