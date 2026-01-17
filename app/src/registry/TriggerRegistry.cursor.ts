/**
 * TriggerRegistry.cursor.ts - 刷子光标管理模块
 * 
 * 负责刷子模式下的光标创建、位置更新和事件监听管理。
 * 从 TriggerRegistry 中分离出来以保持单一职责。
 * 
 * @module layout/registry/TriggerRegistry.cursor
 */

import { 添加窗口事件监听, 移除窗口事件监听 } from "../util/siyuanEnvironments/window.environment";
import type { 光标管理会话 } from "./TriggerRegistry.types";

// ============ 常量定义 ============

/** 刷子光标的 CSS 类名 */
const 刷子光标类名 = "sforge-brush-cursor";

/** 光标 Z-Index */
const 光标层级 = 99999;

/** 鼠标右键代码 */
const 鼠标右键 = 2;

/** 当前光标会话，由外部设置和清理 */
let 当前会话: 光标管理会话 | null = null;

// ============ 内部事件处理器 ============

/**
 * 鼠标移动处理器 - 更新光标位置
 * 
 * @简洁函数 事件处理器，逻辑简单
 */
function 鼠标移动处理器(e: MouseEvent): void {
    更新刷子光标位置(e.clientX, e.clientY);
}

/**
 * 创建键盘退出处理器
 * 
 * 作用：生成监听 Esc 键的事件处理器
 * 意图：支持 Esc 键退出刷子模式
 * 调用时机：设置退出事件监听时
 * 
 * @param 退出回调 刷子退出时执行的函数
 * @returns 键盘事件处理器
 */
function 创建键盘退出处理器(退出回调: () => void): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            退出回调();
        }
    };
}

/**
 * 创建右键退出处理器
 * 
 * 作用：生成监听鼠标右键的事件处理器
 * 意图：支持右键退出刷子模式
 * 调用时机：设置退出事件监听时
 * 
 * @param 退出回调 刷子退出时执行的函数
 * @returns 鼠标事件处理器
 */
function 创建右键退出处理器(退出回调: () => void): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        if (e.button === 鼠标右键) {
            e.preventDefault();
            退出回调();
        }
    };
}

// ============ 会话管理 ============

/**
 * 初始化光标管理会话
 * 
 * 作用：为新的刷子会话创建光标管理上下文
 * 意图：隔离每次刷子激活的光标状态
 * 调用时机：在 激活刷子 函数调用时由 TriggerRegistry 调用
 */
export function 初始化光标会话(): 光标管理会话 {
    当前会话 = {
        cursorElement: null,
        cleanupFns: []
    };
    return 当前会话;
}

/**
 * 清理光标会话
 * 
 * 作用：执行所有清理函数并重置会话状态
 * 意图：确保刷子退出后光标管理器恢复干净状态
 * 调用时机：在 退出刷子 函数调用时由 TriggerRegistry 调用
 */
export function 清理光标会话(): void {
    if (!当前会话) {
        return;
    }

    // 执行所有清理函数
    for (const fn of 当前会话.cleanupFns) {
        try {
            fn();
        } catch (e) {
            console.error("[CursorManager] 清理函数执行失败:", e);
        }
    }

    // 移除光标元素
    当前会话.cursorElement?.remove();

    // 重置会话
    当前会话 = null;
}

/**
 * 注册光标清理函数
 * 
 * 作用：将清理函数加入当前会话的清理列表
 * 意图：延迟执行资源释放，确保刷子退出时统一清理
 * 调用时机：设置事件监听后立即调用，用于注册对应的移除函数
 */
export function 注册光标清理函数(fn: () => void): void {
    当前会话?.cleanupFns.push(fn);
}

// ============ 光标元素管理 ============

/**
 * 创建刷子光标元素
 * 
 * 作用：根据 HTML 模板创建光标 DOM 元素
 * 意图：提供统一的光标创建逻辑，支持自定义外观
 * 调用时机：刷子激活时，如果注册配置包含 cursorHTML
 * 
 * @param html 光标的 HTML 内容（通常是 SVG 图标）
 * @returns 创建的光标元素
 */
export function 创建刷子光标(html: string): HTMLElement {
    const cursor = document.createElement("div");
    cursor.className = 刷子光标类名;
    cursor.innerHTML = html;
    cursor.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: ${光标层级};
        transform: translate(-50%, -50%);
        opacity: 0.9;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;
    document.body.appendChild(cursor);

    if (当前会话) {
        当前会话.cursorElement = cursor;
    }

    return cursor;
}

/**
 * 更新刷子光标位置
 * 
 * 作用：将光标元素移动到指定坐标
 * 意图：实现光标跟随鼠标的效果
 * 调用时机：mousemove 事件触发时
 * 
 * @param x X 坐标（clientX）
 * @param y Y 坐标（clientY）
 */
export function 更新刷子光标位置(x: number, y: number): void {
    if (当前会话?.cursorElement) {
        当前会话.cursorElement.style.left = `${x}px`;
        当前会话.cursorElement.style.top = `${y}px`;
    }
}

/**
 * 设置刷子光标元素（外部创建的光标）
 * 
 * 作用：将外部创建的光标元素纳入会话管理
 * 意图：支持旧代码或特殊场景下外部创建光标
 * 调用时机：具体刷子实现自行创建光标时调用
 * 
 * @param element 光标元素
 */
export function 设置刷子光标(element: HTMLElement): void {
    if (当前会话) {
        // 移除旧的光标
        当前会话.cursorElement?.remove();
        当前会话.cursorElement = element;
    }
}

// ============ 通用事件监听 ============

/**
 * 设置刷子光标跟随事件
 * 
 * 作用：监听 mousemove 事件，自动更新光标位置
 * 意图：将光标跟随逻辑封装为可复用的函数
 * 调用时机：刷子激活且有光标元素时
 */
export function 设置光标跟随(): void {
    添加窗口事件监听("mousemove", 鼠标移动处理器);
    注册光标清理函数(() => 移除窗口事件监听("mousemove", 鼠标移动处理器));
}

/**
 * 设置刷子退出事件监听
 * 
 * 作用：监听 Esc 键和鼠标右键，触发刷子退出
 * 意图：提供统一的刷子退出交互
 * 调用时机：刷子激活时自动调用
 * 
 * @param 退出回调 刷子退出时执行的函数
 */
export function 设置退出事件监听(退出回调: () => void): void {
    // Esc 键退出
    const 键盘处理器 = 创建键盘退出处理器(退出回调);
    添加窗口事件监听("keydown", 键盘处理器, true);
    注册光标清理函数(() => 移除窗口事件监听("keydown", 键盘处理器, true));

    // 右键退出
    const 鼠标处理器 = 创建右键退出处理器(退出回调);
    添加窗口事件监听("mousedown", 鼠标处理器, true);
    注册光标清理函数(() => 移除窗口事件监听("mousedown", 鼠标处理器, true));
}

/**
 * 隐藏系统光标
 * 
 * 作用：将 body 的 cursor 设为 none，并注册恢复函数
 * 意图：在刷子模式下隐藏系统光标，只显示自定义光标
 * 调用时机：刷子激活时
 */
export function 隐藏系统光标(): void {
    document.body.style.cursor = "none";
    注册光标清理函数(() => {
        document.body.style.cursor = "";
    });
}
