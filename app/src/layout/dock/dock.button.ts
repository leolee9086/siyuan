/**
 * dock.button.ts - Dock 按钮生成逻辑
 * 从 index.ts 提取的 genButton 相关辅助函数
 */

import { updateHotkeyTip } from "../../protyle/util/compatibility";

const TYPES = ["file", "outline", "inbox", "bookmark", "tag", "graph", "globalGraph", "backlink", "embedding_dock"];

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

    // 完整替换内容 OR 追加？
    // If we are just initializing (genButton), we might want replace.
    // But addCustomItem re-uses this.
    // However, genButton logic is: 
    // const container = index === 0 ? this.element.firstElementChild : this.element.lastElementChild;
    // insertButtonsToContainer(container, html, tabIndex, ... index === 0);

    // If genButton is called, `html` contains ALL buttons for that side. So replace is correct for genButton.
    // But addCustomItem parses `html` for JUST the new item.

    // We need a way to distinguish "Replace All" vs "Append One".
    // genButton passes `tabIndex` as undefined? No, genButton loops? 
    // genButton(data, index, tabIndex) -> generateAllButtonsHTML(data...)
    // if tabIndex is undefined in genButton, it means "Generate ALL buttons for this dock side". So Replace is correct.

    // addCustomItem calls: generateAllButtonsHTML([item], ...) -> insertButtonsToContainer(..., html, undefined, ...)
    // It passes `undefined` for tabIndex too!

    // We need to differentiate. 
    // `genButton` is primarily for initialization.
    // `addCustomItem` is for dynamic addition.

    // Check if container already has children?
    // If container has children (other buttons), we should PROBABLY append if we are not overwriting everything.
    // But genButton might be called to "Refresh" the dock?

    // Let's look at `index.ts`. `genButton` iterates `this.data`.

    // Ideally, we add a flag `append: boolean`.
    // But changing signature affects `genButton`.

    // QUICK FIX: If `html` contains only one item (roughly checked) and container has children? 
    // No, too hacky.

    // Better: In `addCustomItem` in index.ts, we should use a different specific logic or pass a flag.
    // But I can modify `insertButtonsToContainer` to support append.
    // Let's assume if it is NOT first container (bottom/right end), we usually append?
    // No, Bottom dock has 2 sides?

    // Let's modify `dock.button.ts` to accept `append` flag, defaulting to false.
    // Then update `index.ts` to pass `true` for `addCustomItem`.

    // Wait, I can't easily change `index.ts` all call sites in one go if I am not careful.
    // `genButton` calls it.

    // Alternative: `addCustomItem` logic in `index.ts` is:
    // const container = this.element.lastElementChild;
    // insertButtonsToContainer(..., html, undefined, ...)

    // If I change `dock.button.ts` to ALWAYS append if container is not empty? 
    // `genButton` likely calling on empty container (initialization).

    // Let's try: if (container.children.length > 0 && !isFirstContainer) { append } else { innerHTML }
    // `genButton` clears container? No.
    // But `genButton` is called once per side?

    if (isFirstContainer) {
        const pinHtml = generatePinButtonHTML(pinText, isPinned);
        if (container.children.length > 0) {
            // If first container already has content (Pin?), we might want to preserve pin?
            // But genButton replaces everything.
            container.innerHTML = `${html}${pinHtml}`;
            return;
        }
        container.innerHTML = `${html}${pinHtml}`;
        return;
    }

    if (container.children.length > 0) {
        container.insertAdjacentHTML("beforeend", html);
    } else {
        container.innerHTML = html;
    }
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
