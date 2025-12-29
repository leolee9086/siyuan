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
import { headIconCtx } from "./Panel.types";

/**
 * 切换面板的固定状态
 */
export function 切换固定状态(element: HTMLElement, 固定: boolean): void {
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
    应用固定状态(pinElement, useElement, element, 固定);
}

/**
 * 应用固定状态到元素上（核心逻辑）
 */
function 应用固定状态(
    pinElement: Element,
    useElement: SVGUseElement,
    element: HTMLElement,
    固定: boolean
): void {
    if (固定) {
        pinElement.setAttribute("aria-label", siyuanI18n.unpin);
        useElement.setAttribute("xlink:href", "#iconUnpin");
        element.setAttribute("data-pin", "true");
        return;
    }
    pinElement.setAttribute("aria-label", siyuanI18n.pin);
    useElement.setAttribute("xlink:href", "#iconPin");
    element.setAttribute("data-pin", "false");
}


/**
 * 执行图标点击后的操作
 */
export function 执行图标操作(ctx: headIconCtx): void {
    const { type, target, element, refDefs, app, onDestroy } = ctx;
    const firstRef = refDefs[0];

    if (type === "close") {
        onDestroy();
        return;
    }
    if (type === "pin") {
        执行固定操作(target, element);
        return;
    }
    if (type === "open" && firstRef) {
        /// #if !BROWSER
        openNewWindowById(firstRef.refID);
        /// #endif
        return;
    }
    if (type === "open") {
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
    // 切换状态：当前固定则取消固定，当前未固定则固定
    应用固定状态(target, useElement, element, !当前固定);
}

function 执行粘贴标签页操作(refDefs: IRefDefs[], app: App, onDestroy: () => void): void {
    const firstRef = refDefs[0];
    if (!firstRef) {
        return;
    }
    // @内联回调
    checkFold(firstRef.refID, (zoomIn, action) => {
        openFileById({
            app: app,
            id: firstRef.refID,
            action,
            zoomIn,
            openNewTab: true
        });
    });
    onDestroy();
}
