/**
 * dock.layout.ts - Dock 布局初始化逻辑
 * 从 index.ts 提取的 initLayout 相关函数，使用策略模式替代 switch
 */

import type { Layout } from "../index";
import type { Dock } from "./index";

interface LayoutConfig {
    getLayout: () => Layout;
    getResizeElement: (layout: Layout) => HTMLElement | null;
    className: string;
    resizeHTML: string;
}

/**
 * 布局配置策略
 */
const layoutStrategies: Record<TDockPosition, LayoutConfig> = {
    Left: {
        getLayout: () => {
            const siyuanLayout = window.siyuan?.layout?.layout;
            const children = siyuanLayout?.children;
            const firstChild = children?.[0];
            return firstChild?.children?.[0] as Layout;
        },
        getResizeElement: (layout: Layout) => layout.element.nextElementSibling as HTMLElement,
        className: "layout__dockl",
        resizeHTML: '<div class="layout__dockresize layout__dockresize--lr"></div>'
    },
    Right: {
        getLayout: () => {
            const siyuanLayout = window.siyuan?.layout?.layout;
            const children = siyuanLayout?.children;
            const firstChild = children?.[0];
            return firstChild?.children?.[2] as Layout;
        },
        getResizeElement: (layout: Layout) => layout.element.previousElementSibling as HTMLElement,
        className: "layout__dockr",
        resizeHTML: '<div class="layout__dockresize layout__dockresize--lr"></div>'
    },
    Bottom: {
        getLayout: () => {
            const siyuanLayout = window.siyuan?.layout?.layout;
            const children = siyuanLayout?.children;
            return children?.[1] as Layout;
        },
        getResizeElement: (layout: Layout) => layout.element.previousElementSibling as HTMLElement,
        className: "layout__dockb",
        resizeHTML: '<div class="layout__dockresize"></div>'
    }
};

/**
 * 初始化 Dock 布局
 */
export function initDockLayout(dock: Dock, position: TDockPosition): void {
    const strategy = layoutStrategies[position];
    if (!strategy) {
        return;
    }

    const layout = strategy.getLayout();
    if (!layout) {
        return;
    }

    const resizeElement = strategy.getResizeElement(layout);
    if (!resizeElement) {
        return;
    }

    dock.layout = layout;
    dock.resizeElement = resizeElement;
    dock.layout.element.classList.add(strategy.className);
    dock.layout.element.insertAdjacentHTML("beforeend", strategy.resizeHTML);
}

/**
 * 重置 Dock 位置
 */
export function resetDockPositionStyle(dock: Dock, show: boolean): void {
    const isLeftOrRight = dock.position === "Left" || dock.position === "Right";

    if (isLeftOrRight) {
        dock.layout.element.setAttribute(
            "style",
            `width:${dock.layout.element.clientWidth}px;opacity:${show ? 1 : 0};`
        );
        return;
    }

    dock.layout.element.setAttribute(
        "style",
        `height:${dock.layout.element.clientHeight}px;opacity:${show ? 1 : 0};`
    );
}

/**
 * 设置 Dock 显示位置样式
 */
export function setDockShowPosition(dock: Dock): void {
    if (dock.position === "Left") {
        dock.layout.element.style.left = `${dock.element.clientWidth}px`;
        return;
    }

    if (dock.position === "Right") {
        dock.layout.element.style.right = `${dock.element.clientWidth}px`;
        return;
    }

    // Bottom
    const statusElement = document.getElementById("status");
    const statusHeight = statusElement?.offsetHeight || 0;
    dock.layout.element.style.bottom = `${dock.element.offsetHeight + statusHeight}px`;
}

/**
 * 设置 Dock 隐藏位置样式
 */
export function setDockHideTransform(dock: Dock): void {
    if (dock.position === "Left") {
        dock.layout.element.style.transform = `translateX(-${dock.layout.element.clientWidth + 8}px)`;
        dock.layout.element.style.left = "";
        return;
    }

    if (dock.position === "Right") {
        dock.layout.element.style.transform = `translateX(${dock.layout.element.clientWidth + 8}px)`;
        dock.layout.element.style.right = "";
        return;
    }

    // Bottom
    dock.layout.element.style.transform = `translateY(${dock.layout.element.clientHeight + 8}px)`;
    dock.layout.element.style.bottom = "";
}
