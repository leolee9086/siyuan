/**
 * dock.init.ts - Dock 初始化逻辑
 * 从 index.ts 提取的初始化相关函数
 */

import type { Dock } from "./index";
import { getDockByType } from "../tabUtil";
import { Protyle } from "../../protyle";
import { getAllModels } from "../getAll";
import { isWnd, isTDock } from "./dock.guard";
import { hasValidDockType } from "./dock.visibility";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 初始化活动元素
 */
export function initActiveElements(dock: Dock, activeElements: Element[]): void {
    for (const item of activeElements) {
        const type = item.getAttribute("data-type");
        if (isTDock(type)) {
            dock.toggleModel(type, true, false, false, false);
        }
    }
}

/**
 * 初始化无活动元素的状态
 */
export function initNoActiveElements(dock: Dock): void {
    dock.resizeElement.classList.add("fn__none");
    const children = dock.layout.children;
    if (!children || children.length <= 1) {
        return;
    }

    for (const child of children) {
        child.element.classList.add("fn__none");
    }
    const firstChild = children[0];
    const nextSibling = firstChild?.element?.nextElementSibling;
    if (nextSibling) {
        nextSibling.classList.add("fn__none");
    }
}

/**
 * 查找活动编辑器
 */
export function findActiveEditor(): Protyle | undefined {
    const models = getAllModels();
    for (const item of models.editor) {
        const isFocused = item.parent.headElement.classList.contains("item--focus");
        const hasPath = item.editor?.protyle?.path;
        if (isFocused && hasPath) {
            return item.editor;
        }
    }
    return undefined;
}

/**
 * 移除源 tab
 */
export function removeSourceTab(
    sourceDock: ReturnType<typeof getDockByType>,
    sourceIndex: number,
    sourceElement: Element
): void {
    if (!sourceDock?.layout?.children) {
        return;
    }
    const sourceWnd = sourceDock.layout.children[sourceIndex];
    if (!isWnd(sourceWnd)) {
        return;
    }
    const sourceId = sourceElement.getAttribute("data-id");
    if (!sourceId) {
        return;
    }
    sourceWnd.removeTab(sourceId, false, true, false);
    sourceElement.removeAttribute("data-id");
}

/**
 * 插入源元素
 */
export function insertSourceElement(
    dock: Dock,
    sourceElement: Element,
    index: number,
    previousType?: string
): void {
    sourceElement.setAttribute("data-index", index.toString());
    if (previousType) {
        const prev = dock.element.querySelector(`[data-type="${previousType}"]`);
        if (prev) {
            prev.after(sourceElement);
            return;
        }
    }
    const container = index === 0 ? dock.element.firstElementChild : dock.element.lastElementChild;
    if (!container) {
        return;
    }
    container.insertAdjacentElement("afterbegin", sourceElement);
}

/**
 * 渲染 pin 按钮
 */
export function renderPinButton(dock: Dock, languages: { unpin?: string, pin?: string } | undefined): void {
    if (!languages) {
        return;
    }
    const firstChild = dock.element.firstElementChild;
    if (!firstChild) {
        return;
    }
    firstChild.innerHTML = `<span class="dock__item dock__item--pin ariaLabel" aria-label="${dock.pin ? languages.unpin : languages.pin}"><svg><use xlink:href="#icon${dock.pin ? "Unpin" : "Pin"}"></use></svg></span>`;
}

/**
 * 初始化 dock 文件（触发 file 类型的 toggle）
 */
export function initDockFiles(dock: Dock): void {
    for (const item of Array.from(dock.element.querySelectorAll(".dock__item"))) {
        if (item.getAttribute("data-type") === "file" && !item.classList.contains("dock__item--active")) {
            dock.toggleModel("file", true, false, false, false);
            dock.toggleModel("file", false, false, false, false);
        }
    }
}

/**
 * 初始化 dock 浮动模式
 */
export function initDockFloatMode(dock: Dock): void {
    dock.resetDockPosition(false);
    dock.hideDock(true);
    dock.layout.element.classList.add("layout--float");
    dock.resizeElement.classList.add("fn__none");
}

/**
 * 初始化 dock 数据
 */


/**
 * 初始化 dock 数据
 */
export function initDockData(
    dock: Dock,
    data: Config.IUILayoutDockTab[][],
    TYPES: string[],
    getSiyuanLanguagesFn: () => { unpin?: string; pin?: string } | undefined
): void {
    // 1. Defensively ensure data structure exists
    if (!data[0]) {
        data[0] = [];
    }
    if (!data[1]) {
        data[1] = [];
    }

    console.log("initDockData BEFORE DEDUPE:", JSON.stringify(data));

    // 2. Strict Global Deduplication (across both columns)
    const seenGlobalTypes = new Set<string>();

    // Process first column
    data[0] = uniqueDockItems(data[0], seenGlobalTypes, TYPES);
    // Process second column (continuing with same seen set)
    data[1] = uniqueDockItems(data[1], seenGlobalTypes, TYPES);

    console.log("initDockData AFTER DEDUPE:", JSON.stringify(data));

    // 3. Restore missing standard panels (Self-healing)
    // Only add if NOT present GLOBALLY
    // i18n safely typed
    const i18n = siyuanI18n as unknown as Record<string, string>;

    // 4. Final verification
    if (!hasValidDockType(data, TYPES)) {
        renderPinButton(dock, getSiyuanLanguagesFn());
        dock.element.classList.add("fn__none");
        initDockFiles(dock);
        initDockActiveState(dock);
        return;
    }

    const first = data[0];
    const second = data[1];
    if (first && first.length > 0) {
        dock.genButton(first, 0);
    }
    if (second && second.length > 0) {
        dock.genButton(second, 1);
    }
    dock.element.classList.remove("fn__none");
    initDockFiles(dock);
    initDockActiveState(dock);
}

/**
 * 初始化 dock 激活状态
 */
export function initDockActiveState(dock: Dock): void {
    const activeElements = Array.from(dock.element.querySelectorAll(".dock__item--active"));
    if (activeElements.length > 0) {
        initActiveElements(dock, activeElements);
        return;
    }
    initNoActiveElements(dock);
}



function uniqueDockItems(
    arr: Config.IUILayoutDockTab[],
    seen: Set<string>,
    standardTypes: string[]
): Config.IUILayoutDockTab[] {
    return arr.filter(item => {
        if (!item || !item.type) {
            return false;
        }

        // Normalize type to canonical standard type if it matches case-insensitively
        const lowerType = item.type.toLowerCase();
        const matchedStandard = standardTypes.find(t => t.toLowerCase() === lowerType);

        if (matchedStandard) {
            item.type = matchedStandard;
        }

        if (seen.has(item.type)) {
            // Already seen in a previous column or earlier in this column
            return false;
        }

        // Check if this type exists in the DOM (rendered by another dock)
        // This effectively deduplicates across docks without relying on potentially unstable Layout state
        // We must exclude the current dock's own deduplication which happens before rendering
        if (document.querySelector(`[data-type="${item.type}"]`)) {
            console.warn(`Dock: Removing ${item.type} because it already exists in the DOM`);
            return false;
        }

        seen.add(item.type);
        return true;
    });
}

function restoreIfMissing(
    targetArray: Config.IUILayoutDockTab[],
    existingTypes: Set<string>,
    type: string,
    icon: string,
    title: string
) {
    if (!existingTypes.has(type)) {
        targetArray.push({
            type,
            icon,
            title,
            size: { width: 0, height: 0 },
            show: false,
            hotkey: ""
        } as Config.IUILayoutDockTab);
        existingTypes.add(type);
    }
}
