/**
 * styleBrush.ts - 样式刷子 (格式刷) 实现
 * 
 * MVP 阶段 1 的核心功能：验证 TriggerRegistry 架构下的"刷子模式"生命周期。
 * 
 * 功能流程：
 * 1. 从源块提取 style 属性
 * 2. 激活刷子模式，光标变为画笔图标
 * 3. 点击目标块时应用样式
 * 4. 按 Esc 或右键退出
 * 
 * @module protyle/gutter/styleBrush
 */

import { fetchPost } from "../../util/fetch";
import {
    注册触发器,
    激活刷子,
    退出刷子,
    注册刷子清理函数,
    设置刷子光标,
    获取刷子参数,
    刷子是否激活,
    获取激活刷子类型
} from "../../registry/TriggerRegistry";
import type { IGlobalContext, I样式刷子参数 } from "../../registry/TriggerRegistry.types";
import { getGlobalWindow } from "../../util/siyuanEnvironments/window.environment";

// ============ 常量定义 ============

/** 样式刷子的触发器类型标识 */
export const 样式刷子类型 = "s-forge-style-brush";
export const STYLE_BRUSH_TYPE = 样式刷子类型;

/** 画笔光标的 CSS 类名 */
const 光标类名 = "s-forge-brush-cursor";

// ============ 核心功能 ============

/**
 * 从块元素提取可复制的样式
 * 
 * @param element 块元素
 * @returns 样式字符串，若无样式则返回 null
 */
export function 提取块样式(element: Element): string | null {
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
 * 应用样式到目标块
 * 
 * 使用思源的 setBlockAttrs API，支持撤销
 * 
 * @param targetId 目标块 ID
 * @param style 样式字符串
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
 */
function 创建光标元素(): HTMLElement {
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
        z-index: 99999;
        transform: translate(-50%, -50%);
        opacity: 0.9;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;
    document.body.appendChild(cursor);
    return cursor;
}

/**
 * 更新光标位置
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
 */
function 创建鼠标移动处理器(cursorElement: HTMLElement): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        更新光标位置(cursorElement, e.clientX, e.clientY);
    };
}

/**
 * 处理左键点击 - 应用样式
 */
function 创建点击处理器(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (e.button !== 0) {
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

        const params = 获取刷子参数<I样式刷子参数>();
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
 */
function 创建右键处理器(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (e.button === 2) {
            e.preventDefault();
            退出刷子();
        }
    };
}

/**
 * 设置刷子模式的全局事件监听
 */
function 设置事件监听(cursorElement: HTMLElement): void {
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
function 清理事件监听(): void {
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

// ============ 触发器注册 ============

/**
 * 注册样式刷子触发器
 * 
 * 应在应用初始化时调用
 */
export function 注册样式刷子(): void {
    注册触发器({
        type: 样式刷子类型,
        mode: "brush",

        // 匹配逻辑：当块有 style 属性时可用
        match: (context: IGlobalContext) => {
            const element = context.目标块?.element;
            if (!element) {
                return false;
            }
            return 提取块样式(element) !== null;
        },

        // 进入刷子模式
        onEnter: (params: unknown) => {
            const brushParams = params as I样式刷子参数;
            console.log(`[StyleBrush] 进入刷子模式，源样式: ${brushParams.sourceStyle}`);

            // 创建光标
            const cursor = 创建光标元素();
            设置刷子光标(cursor);

            // 隐藏系统光标
            document.body.style.cursor = "none";

            // 设置事件监听
            设置事件监听(cursor);

            // 注册清理函数
            注册刷子清理函数(清理事件监听);
        },

        // 应用逻辑
        onApply: (target: Element, _context: IGlobalContext, isSecondary: boolean) => {
            if (isSecondary) {
                // 右键 = 退出
                退出刷子();
                return;
            }

            const targetId = target.getAttribute("data-node-id");
            if (!targetId) {
                return;
            }

            const params = 获取刷子参数<I样式刷子参数>();
            if (params?.sourceStyle) {
                应用样式(targetId, params.sourceStyle);
            }
        },

        // 退出清理
        onExit: () => {
            console.log("[StyleBrush] 退出刷子模式");
        }
    });
}

// ============ 公开 API ============

/**
 * 激活样式刷子
 * 
 * 从 gutter 菜单调用此函数启动格式刷
 * 
 * @param sourceStyle 源块的样式字符串
 * @param sourceBlockId 源块 ID (可选，用于调试)
 * @returns 是否激活成功
 */
export function 激活样式刷子(sourceStyle: string, sourceBlockId?: string): boolean {
    if (!sourceStyle) {
        console.warn("[StyleBrush] 源样式为空，无法激活");
        return false;
    }

    const params: I样式刷子参数 = {
        sourceStyle,
        sourceBlockId
    };

    return 激活刷子(样式刷子类型, params);
}

/**
 * 检查样式刷子是否激活
 */
export function 样式刷子是否激活(): boolean {
    return 刷子是否激活() && 获取激活刷子类型() === 样式刷子类型;
}

/**
 * 退出样式刷子
 */
export function 退出样式刷子(): void {
    if (样式刷子是否激活()) {
        退出刷子();
    }
}

// 英文别名
export const extractBlockStyle = 提取块样式;
export const applyStyle = 应用样式;
export const registerStyleBrush = 注册样式刷子;
export const activateStyleBrush = 激活样式刷子;
export const isStyleBrushActive = 样式刷子是否激活;
export const deactivateStyleBrush = 退出样式刷子;
