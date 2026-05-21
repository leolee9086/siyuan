/**
 * dock.events.ts - Dock 事件处理逻辑
 * 从 index.ts 提取的事件处理相关函数
 */

import type { Dock } from "./index";
import { isTDock } from "./dock.guard";
import { getSiyuanLanguages } from "./dock.environment";
import { shouldHideOnMouseLeave } from "./dock.visibility";

/**
 * 处理鼠标离开事件
 *
 * @同步豁免: UI构建 - 事件处理函数必须同步执行，因为需要立即响应用户交互并同步更新 DOM 状态
 */
export function handleMouseLeave(dock: Dock, event: MouseEvent): void {
    const toElement = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    // 检查是否满足隐藏 Dock 的条件（鼠标移出到非 Dock 相关区域）
    if (shouldHideOnMouseLeave(dock, event, toElement)) {
        dock.hideDock();
    }
}

/**
 * 处理点击事件
 *
 * @同步豁免: UI构建 - 事件处理函数必须同步执行，需要立即响应点击并同步更新 DOM 状态
 */
export function handleClick(dock: Dock, event: MouseEvent): void {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
        return;
    }
    let target: Element | null = eventTarget;
    while (target && target !== dock.elements[0].parentElement) {
        if (processClickTarget(dock, target, event)) {
            return;
        }
        target = target.parentElement;
    }
}

/**
 * 处理点击目标
 *
 * 逻辑说明：
 * 1. 内置 dock 类型（file, outline 等）和 custom_list: 前缀类型由 isTDock 识别
 * 2. 插件添加的 dock 图标有 data-type 属性但不在 isTDock 范围内，需要单独处理
 * 3. 真正的 pin 按钮没有 data-type 属性，只有 dock__item 类
 */
function processClickTarget(dock: Dock, target: Element, event: MouseEvent): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const type = target.getAttribute("data-type");
    
    // 内置 dock 类型（file, outline, bookmark 等）和 custom_list: 前缀类型
    if (isTDock(type)) {
        dock.toggleModel(type, false, true);
        event.preventDefault();
        return true;
    }
    
    // 插件添加的 dock 图标：有 data-type 属性但不是内置类型
    // 这些图标也需要调用 toggleModel 来打开对应的面板
    if (type && target.classList.contains("dock__item")) {
        dock.toggleModel(type, false, true);
        event.preventDefault();
        return true;
    }
    
    // 真正的 pin 按钮：没有 data-type 属性，只有 dock__item 类
    if (!type && target.classList.contains("dock__item")) {
        handlePinClick(dock, target, event);
        return true;
    }
    
    return false;
}

/**
 * 处理 pin 按钮点击
 */
function handlePinClick(dock: Dock, target: HTMLElement, event: MouseEvent): void {
    dock.togglePin();
    const languages = getSiyuanLanguages();
    // 只有当语言包中存在 unpin 和 pin 翻译时才更新 aria-label，避免显示 undefined
    if (languages?.unpin && languages?.pin) {
        target.setAttribute("aria-label", dock.pin ? languages.unpin : languages.pin);
    }
    const use = target.querySelector("use");
    if (use) {
        use.setAttribute("xlink:href", dock.pin ? "#iconUnpin" : "#iconPin");
    }
    event.preventDefault();
}
