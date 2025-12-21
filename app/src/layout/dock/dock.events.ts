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
 */
export function handleMouseLeave(dock: Dock, event: MouseEvent): void {
    const toElement = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    if (shouldHideOnMouseLeave(dock, event, toElement)) {
        dock.hideDock();
    }
}

/**
 * 处理点击事件
 */
export function handleClick(dock: Dock, event: MouseEvent): void {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
        return;
    }
    let target: Element | null = eventTarget;
    while (target && target !== dock.element) {
        if (processClickTarget(dock, target, event)) {
            return;
        }
        target = target.parentElement;
    }
}

/**
 * 处理点击目标
 */
function processClickTarget(dock: Dock, target: Element, event: MouseEvent): boolean {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const type = target.getAttribute("data-type");
    if (isTDock(type)) {
        dock.toggleModel(type, false, true);
        event.preventDefault();
        return true;
    }
    if (target.classList.contains("dock__item")) {
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
    if (languages?.unpin && languages?.pin) {
        target.setAttribute("aria-label", dock.pin ? languages.unpin : languages.pin);
    }
    const use = target.querySelector("use");
    if (use) {
        use.setAttribute("xlink:href", dock.pin ? "#iconUnpin" : "#iconPin");
    }
    event.preventDefault();
}
