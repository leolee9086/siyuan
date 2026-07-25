/**
 * dock.events.ts - Dock 事件处理逻辑
 * 从 index.ts 提取的事件处理相关函数
 */

/** 用途：约束 Dock 事件宿主；使用范围：鼠标离开处理；解耦评估：完整 Dock 领域根已由测试校验具体 class 兼容性。 */
import type {DockDomain} from "./dock.types";
/** 用途：读取窗口高度；使用范围：底部浮动 Dock 离开判定；解耦评估：环境读取已由现有封装隔离。 */
import {getWindowInnerHeight} from "./dock.environment";
/** 用途：读取窗口宽度；使用范围：左右浮动 Dock 离开判定；解耦评估：环境读取已由现有封装隔离。 */
import {getWindowInnerWidth} from "./dock.environment";

/** 判断鼠标离开事件是否已越过浮动 Dock 的保留边界。 */
const shouldHideOnMouseLeave = (dock: DockDomain, event: MouseEvent, toElement: HTMLElement | null) => {
    if (event.buttons !== 0 || dock.pin) {
        return false;
    }
    if (toElement && (toElement.classList.contains("b3-menu") || toElement.classList.contains("tooltip"))) {
        return false;
    }
    if (dock.position === "Left" && event.clientX < 43) {
        return false;
    }
    if (dock.position === "Right" && event.clientX > getWindowInnerWidth() - 43) {
        return false;
    }
    if (dock.position === "Bottom" && event.clientY > getWindowInnerHeight() - 73) {
        return false;
    }
    return true;
};

/**
 * 处理鼠标离开事件
 *
 * @同步豁免: UI构建 - 事件处理函数必须同步执行，因为需要立即响应用户交互并同步更新 DOM 状态
 */
export function handleMouseLeave(dock: DockDomain, event: MouseEvent) {
    const toElement = event.relatedTarget instanceof HTMLElement ? event.relatedTarget : null;
    // 检查是否满足隐藏 Dock 的条件（鼠标移出到非 Dock 相关区域）
    if (shouldHideOnMouseLeave(dock, event, toElement)) {
        dock.hideDock();
    }
}
