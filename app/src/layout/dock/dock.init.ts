/**
 * dock.init.ts - Dock 初始化逻辑
 * 从 index.ts 提取的初始化相关函数
 */

import type { Dock } from "./index";
import { getDockByType } from "../tabUtil";
import { Protyle } from "../../protyle";
import { getAllModels } from "../getAll";
import { isWnd, isTDock } from "./dock.guard";

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
    if (!children || children.length <= 1) return;

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
    if (!sourceDock?.layout?.children) return;
    const sourceWnd = sourceDock.layout.children[sourceIndex];
    if (!isWnd(sourceWnd)) return;
    const sourceId = sourceElement.getAttribute("data-id");
    if (!sourceId) return;
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
    if (!container) return;
    container.insertAdjacentElement("afterbegin", sourceElement);
}

/**
 * 渲染 pin 按钮
 */
export function renderPinButton(dock: Dock, languages: { unpin?: string, pin?: string } | undefined): void {
    if (!languages) return;
    const firstChild = dock.element.firstElementChild;
    if (!firstChild) return;
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
