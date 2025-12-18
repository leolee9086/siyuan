/**
 * BlockPanel 的图标操作相关方法
 * 从 Panel.ts 中提取，用于减少文件行数
 */

/// #if !BROWSER
import { openNewWindowById } from "../window/openNewWindow";
/// #endif
/// #if !MOBILE
import { openFileById } from "../editor/utils.openFileById";
/// #endif
import { checkFold } from "../util/noRelyPCFunction";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { App } from "../index";

/**
 * 切换面板固定状态的参数
 */
export interface 切换固定状态参数 {
    element: HTMLElement;
    固定: boolean;
}

/**
 * 切换面板的固定状态
 */
export function 切换固定状态(参数: 切换固定状态参数): void {
    const { element, 固定 } = 参数;
    const pinSelector = '[data-type="pin"]';
    const pinElement = element.querySelector(pinSelector) ??
        element.firstElementChild?.querySelector(pinSelector);
    if (!pinElement) {
        return;
    }
    const useElement = pinElement.querySelector("use");
    if (!useElement) {
        return;
    }
    if (固定) {
        pinElement.setAttribute("aria-label", siyuanI18n.unpin);
        useElement.setAttribute("xlink:href", "#iconUnpin");
        element.setAttribute("data-pin", "true");
    } else {
        pinElement.setAttribute("aria-label", siyuanI18n.pin);
        useElement.setAttribute("xlink:href", "#iconPin");
        element.setAttribute("data-pin", "false");
    }
}

/**
 * 执行图标操作的参数
 */
export interface 执行图标操作参数 {
    type: string | null;
    target: HTMLElement;
    element: HTMLElement;
    refDefs: IRefDefs[];
    app: App;
    onDestroy: () => void;
}

/**
 * 执行图标点击后的操作
 */
export function 执行图标操作(参数: 执行图标操作参数): void {
    const { type, target, element, refDefs, app, onDestroy } = 参数;

    if (type === "close") {
        onDestroy();
        return;
    }
    if (type === "pin") {
        执行固定操作(target, element);
        return;
    }
    if (type === "open") {
        /// #if !BROWSER
        openNewWindowById(refDefs[0].refID);
        /// #endif
        return;
    }
    if (type === "stickTab") {
        执行粘贴标签页操作(refDefs, app, onDestroy);
    }
}

function 执行固定操作(target: HTMLElement, element: HTMLElement): void {
    const 当前固定 = element.getAttribute("data-pin") === "true";
    const useElement = target.querySelector("use");
    if (!useElement) {
        return;
    }
    if (当前固定) {
        target.setAttribute("aria-label", siyuanI18n.pin);
        useElement.setAttribute("xlink:href", "#iconPin");
        element.setAttribute("data-pin", "false");
    } else {
        target.setAttribute("aria-label", siyuanI18n.unpin);
        useElement.setAttribute("xlink:href", "#iconUnpin");
        element.setAttribute("data-pin", "true");
    }
}

function 执行粘贴标签页操作(refDefs: IRefDefs[], app: App, onDestroy: () => void): void {
    checkFold(refDefs[0].refID, (zoomIn, action) => {
        openFileById({
            app: app,
            id: refDefs[0].refID,
            action,
            zoomIn,
            openNewTab: true
        });
    });
    onDestroy();
}
