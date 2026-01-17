/**
 * dock.button.ts - Dock 按钮生成逻辑
 * 从 index.ts 提取的 genButton 相关辅助函数
 */

import { updateHotkeyTip } from "../../protyle/util/compatibility";

const TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink", "forwardlink", "embedding_dock", "cronjob"];

/**
 * 生成单个按钮的 HTML
 */
export function generateButtonHTML(
    item: Config.IUILayoutDockTab,
    index: number,
    dockTip: string,
    tabIndex?: number
): string {
    if (typeof tabIndex === "undefined" && !TYPES.includes(item.type) && !item.type.startsWith("custom_list:")) {
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
 */
export function generateAllButtonsHTML(
    data: Config.IUILayoutDockTab[],
    index: number,
    dockTip: string,
    tabIndex?: number
): string {
    let html = "";
    for (const item of data) {
        html += generateButtonHTML(item, index, dockTip, tabIndex);
    }
    return html;
}

/**
 * 生成 Pin 按钮的 HTML
 */
export function generatePinButtonHTML(pinText: string, isPinned: boolean): string {
    return `<span class="dock__item dock__item--pin ariaLabel" aria-label="${pinText}">
    <svg><use xlink:href="#icon${isPinned ? "Unpin" : "Pin"}"></use></svg>
</span>`;
}

/**
 * 插入按钮到容器
 * @param container 目标容器
 * @param html 按钮HTML
 * @param tabIndex 可选的tab索引，用于指定插入位置
 * @param pinText pin按钮文本
 * @param isPinned 是否已pin
 * @param isFirstContainer 是否是第一个容器
 * @param append 是否追加模式（默认false为替换模式，用于初始化；true为追加模式，用于动态添加）
 */
export function insertButtonsToContainer(
    container: Element | null,
    html: string,
    tabIndex: number | undefined,
    pinText: string,
    isPinned: boolean,
    isFirstContainer: boolean,
    append: boolean = false
): void {
    if (!container) {
        return;
    }

    if (typeof tabIndex === "number") {
        insertAtTabIndex(container, html, tabIndex, isFirstContainer);
        return;
    }

    // 处理第一个容器（带pin按钮）
    if (isFirstContainer) {
        const pinHtml = generatePinButtonHTML(pinText, isPinned);
        container.innerHTML = `${html}${pinHtml}`;
        return;
    }

    // 第二个容器：根据 append 参数决定替换还是追加
    if (append) {
        container.insertAdjacentHTML("beforeend", html);
        return;
    }

    // 默认替换模式
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
    tabIndex: number,
    isFirstContainer: boolean
): void {
    const target = container.children[tabIndex];

    if (target) {
        target.insertAdjacentHTML("beforebegin", html);
        return;
    }

    if (isFirstContainer) {
        const lastChild = container.lastElementChild;
        lastChild?.insertAdjacentHTML("beforebegin", html);
        return;
    }

    container.insertAdjacentHTML("beforeend", html);
}
