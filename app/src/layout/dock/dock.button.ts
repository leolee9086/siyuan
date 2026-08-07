/**
 * dock.button.ts - Dock 按钮生成逻辑
 * 从 index.ts 提取的 genButton 相关辅助函数
 */

import { updateHotkeyTip } from "../../protyle/util/compatibility";
import {isBuiltinDockType} from "./dock.builtin";

/**
 * 生成单个按钮的 HTML
 * @同步豁免: UI构建
 */
export function generateButtonHTML(
    item: Config.IUILayoutDockTab,
    index: number,
    dockTip: string,
    tabIndex?: number
) {
    if (typeof tabIndex === "undefined" && !isBuiltinDockType(item.type) && !item.type.startsWith("custom_list:")) {
        return "";
    }

    const hotkey = item.hotkey ? updateHotkeyTip(item.hotkey) : "";
    const activeClass = item.show ? " dock__item--active" : "";

    return `<span data-height="${item.size.height}" data-width="${item.size.width}" data-type="${item.type}" data-index="${index}" data-hotkey="${item.hotkey || ""}" data-hotkeyLangId="${item.hotkeyLangId || ""}" data-title="${item.title}" class="dock__item${activeClass} ariaLabel" aria-label="<span style='white-space:pre'>${item.title} ${hotkey}${dockTip}</span>">
    <svg><use xlink:href="#${item.icon}"></use></svg>
</span>`;
}

/**
 * 生成所有按钮的 HTML
 * @同步豁免: UI构建
 */
export function generateAllButtonsHTML(
    data: Config.IUILayoutDockTab[],
    index: number,
    dockTip: string,
    tabIndex?: number
) {
    let html = "";
    for (const item of data) {
        html += generateButtonHTML(item, index, dockTip, tabIndex);
    }
    return html;
}

/**
 * 插入按钮到容器
 * @param container 目标容器
 * @param html 按钮HTML
 * @param tabIndex 可选的tab索引，用于指定插入位置
 * @param append 是否追加模式（默认false为替换模式，用于初始化；true为追加模式，用于动态添加）
 * @同步豁免: DOM访问
 */
export function insertButtonsToContainer(
    container: Element | null,
    html: string,
    tabIndex: number | undefined,
    append: boolean = false
) {
    if (!container) {
        return;
    }

    if (typeof tabIndex === "number") {
        insertAtTabIndex(container, html, tabIndex);
        return;
    }

    if (append) {
        container.insertAdjacentHTML("beforeend", html);
        return;
    }

    container.innerHTML = html;
}

/**
 * 在指定 Tab 索引处插入 HTML
 * 
 * 作用：将生成的按钮 HTML 插入到容器的指定位置
 * 意图：支持精确控制按钮的插入位置，用于恢复布局或插入特定位置的 Dock Item
 * 调用时机：在 insertButtonsToContainer 中，当提供了 tabIndex 时调用
 */
function insertAtTabIndex(
    container: Element,
    html: string,
    tabIndex: number
) {
    const target = container.children[tabIndex];

    if (target) {
        target.insertAdjacentHTML("beforebegin", html);
        return;
    }

    container.insertAdjacentHTML("beforeend", html);
}
