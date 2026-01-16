/**
 * styleBrush.impl.ts - 样式刷子核心实现
 * 
 * 包含样式提取、应用逻辑以及刷子模式的 UI 交互处理。
 * 
 * @module protyle/gutter/styleBrush.impl
 */

import { fetchPost, fetchSyncPost } from "../../util/fetch";
import { getGlobalWindow } from "../../util/siyuanEnvironments/window.environment";
import {
    退出刷子,
    获取刷子参数,
} from "../../registry/TriggerRegistry";
import type { IStyleBrushParameters } from "../../registry/TriggerRegistry.types";

// ============ 常量定义 ============

/** 样式刷子的触发器类型标识 */
export const 样式刷子类型 = "s-forge-style-brush";
export const STYLE_BRUSH_TYPE = 样式刷子类型;

/** 画笔光标的 CSS 类名 */
const 光标类名 = "s-forge-brush-cursor";

/** 鼠标左键代码 */
const MOUSE_BUTTON_LEFT = 0;
/** 鼠标右键代码 */
const MOUSE_BUTTON_RIGHT = 2;
/** 光标 Z-Index */
const CURSOR_Z_INDEX = 99999;

// ============ 核心功能 ============

/**
 * 同步从 DOM 提取样式 (用于 UI 快速判断)
 * @param element DOM 元素
 * @returns 样式字符串
 */
export function 提取DOM样式(element: Element): string | null {
    // 优先从 style 属性获取
    const styleAttr = element.getAttribute("style");
    if (styleAttr && styleAttr.trim()) {
        return styleAttr;
    }

    // 备选：从 data-node 相关属性提取
    // 未来可扩展更多样式来源

    return null;
}

/**
 * 从块元素提取可复制的样式
 * @AIDONE: 块样式应该通过id从后端接口获取
 * @param element 块元素
 * @returns 样式字符串，若无样式则返回 null
 */
export async function 提取块样式(element: Element): Promise<string | null> {
    const id = element.getAttribute("data-node-id");
    if (id) {
        try {
            const response = await fetchSyncPost("/api/attr/getBlockAttrs", { id });
            if (response.code === 0 && response.data && response.data.style) {
                return response.data.style;
            }
        } catch (e) {
            console.warn("[StyleBrush] Fetch style failed", e);
        }
    }

    return 提取DOM样式(element);
}

/**
 * 应用样式到目标块
 * 
 * 使用思源的 setBlockAttrs API，支持撤销
 * 
 * @param targetId 目标块 ID
 * @param style 样式字符串
 * @returns 是否成功
 */
export async function 应用样式(targetId: string, style: string): Promise<boolean> {
    try {
        await fetchPost("/api/attr/setBlockAttrs", {
            id: targetId,
            attrs: { style }
        });
        console.log(`[StyleBrush] 已应用样式到块 ${targetId}`);
        return true;
    } catch (e) {
        console.error("[StyleBrush] 应用样式失败:", e);
        return false;
    }
}

/**
 * 创建画笔光标元素
 * @returns 光标 HTMLElement
 */
export function 创建光标元素(): HTMLElement {
    const cursor = document.createElement("div");
    cursor.className = 光标类名;
    cursor.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24">
            <use xlink:href="#iconFormat"></use>
        </svg>
    `;
    cursor.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: ${CURSOR_Z_INDEX};
        transform: translate(-50%, -50%);
        opacity: 0.9;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;
    document.body.appendChild(cursor);
    return cursor;
}

/**
 * 更新光标位置
 * @param cursor 光标元素
 * @param x X 坐标
 * @param y Y 坐标
 */
function 更新光标位置(cursor: HTMLElement, x: number, y: number): void {
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
}

// ============ 事件处理 ============

/** 全局事件处理器引用 */
let 当前鼠标移动处理器: ((e: MouseEvent) => void) | null = null;
let 当前点击处理器: ((e: MouseEvent) => void) | null = null;
let 当前键盘处理器: ((e: KeyboardEvent) => void) | null = null;
let 当前右键处理器: ((e: MouseEvent) => void) | null = null;

/**
 * 处理鼠标移动 - 更新光标位置
 * @param cursorElement 光标元素
 * @returns 事件处理器
 */
function 创建鼠标移动处理器(cursorElement: HTMLElement): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        更新光标位置(cursorElement, e.clientX, e.clientY);
    };
}

/**
 * 处理左键点击 - 应用样式
 * @returns 事件处理器
 */
function 创建点击处理器(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (e.button !== MOUSE_BUTTON_LEFT) {
            return; // 只处理左键
        }

        const target = e.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const blockElement = target.closest("[data-node-id]");
        if (!(blockElement instanceof HTMLElement)) {
            console.debug("[StyleBrush] 点击位置不是有效块");
            return;
        }

        // 检查是否是链接或块引用（这些需要特殊处理）
        const linkElement = target.closest("[data-type=\"a\"], [data-type=\"block-ref\"]");

        const targetId = blockElement.getAttribute("data-node-id");
        if (!targetId) {
            return;
        }

        const params = 获取刷子参数<IStyleBrushParameters>();
        if (!params?.sourceStyle) {
            console.error("[StyleBrush] 无法获取源样式");
            return;
        }

        // 阻止默认行为
        e.preventDefault();
        e.stopPropagation();

        // 应用样式
        应用样式(targetId, params.sourceStyle);

        // 如果点击到链接，应用后退出
        if (linkElement) {
            退出刷子();
        }
    };
}

/**
 * 处理键盘事件 - Esc 退出
 * @returns 事件处理器
 */
function 创建键盘处理器(): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            退出刷子();
        }
    };
}

/**
 * 处理右键 - 退出
 * @returns 事件处理器
 */
function 创建右键处理器(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (e.button === MOUSE_BUTTON_RIGHT) {
            e.preventDefault();
            退出刷子();
        }
    };
}

/**
 * 设置刷子模式的全局事件监听
 * @param cursorElement 光标元素
 */
export function 设置事件监听(cursorElement: HTMLElement): void {
    const win = getGlobalWindow();

    当前鼠标移动处理器 = 创建鼠标移动处理器(cursorElement);
    当前点击处理器 = 创建点击处理器();
    当前键盘处理器 = 创建键盘处理器();
    当前右键处理器 = 创建右键处理器();

    // 使用 capture 确保优先处理
    win.addEventListener("mousemove", 当前鼠标移动处理器);
    win.addEventListener("click", 当前点击处理器, true);
    win.addEventListener("keydown", 当前键盘处理器, true);
    win.addEventListener("mousedown", 当前右键处理器, true);
}

/**
 * 清理事件监听
 */
export function 清理事件监听(): void {
    const win = getGlobalWindow();

    if (当前鼠标移动处理器) {
        win.removeEventListener("mousemove", 当前鼠标移动处理器);
        当前鼠标移动处理器 = null;
    }
    if (当前点击处理器) {
        win.removeEventListener("click", 当前点击处理器, true);
        当前点击处理器 = null;
    }
    if (当前键盘处理器) {
        win.removeEventListener("keydown", 当前键盘处理器, true);
        当前键盘处理器 = null;
    }
    if (当前右键处理器) {
        win.removeEventListener("mousedown", 当前右键处理器, true);
        当前右键处理器 = null;
    }

    // 恢复光标样式
    document.body.style.cursor = "";
}
