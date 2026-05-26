/**
 * dock.events.ts - Dock 事件处理逻辑
 * 从 index.ts 提取的事件处理相关函数
 */

import type { Dock } from "./index";
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
