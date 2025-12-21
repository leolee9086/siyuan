/**
 * dock.button.ts - Dock 按钮生成逻辑
 * 从 index.ts 提取的 genButton 相关辅助函数
 */

import { updateHotkeyTip } from "../../protyle/util/compatibility";

const TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink"];

/**
 * 生成单个按钮的 HTML
 */
export function generateButtonHTML(
    item: Config.IUILayoutDockTab,
    index: number,
    dockTip: string,
    tabIndex?: number
): string {
    if (typeof tabIndex === "undefined" && !TYPES.includes(item.type)) {
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
 */
export function insertButtonsToContainer(
    container: Element | null,
    html: string,
    tabIndex: number | undefined,
    pinText: string,
    isPinned: boolean,
    isFirstContainer: boolean
): void {
    if (!container) {
        return;
    }

    if (typeof tabIndex === "number") {
        insertAtTabIndex(container, html, tabIndex, isFirstContainer);
        return;
    }

    // 完整替换内容
    if (isFirstContainer) {
        const pinHtml = generatePinButtonHTML(pinText, isPinned);
        container.innerHTML = `${html}${pinHtml}`;
        return;
    }

    container.innerHTML = html;
}

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
