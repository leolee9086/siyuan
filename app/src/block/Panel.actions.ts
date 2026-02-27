/**
 * BlockPanel 的图标操作相关方法
 * 从 Panel.ts 中提取，用于减少文件行数
 */

import { openNewWindowById } from "../window/openNewWindow";
import { openFileById } from "../editor/utils.openFileById";
import { checkFold } from "../util/platform/noRelyPCFunction";
import { isElectron } from "../platform";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { App } from "../index";
import { headIconCtx } from "./Panel.types";

/**
 * 切换面板的固定状态
 * 作用：查找面板内的固定按钮并更新其状态（图标及 aria-label）和面板容器的 data-pin 属性
 * 意图：供外部调用，强制设定面板的固定/未固定视觉状态
 * 调用时机：通常在面板初始化或需要重置状态时调用
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
 * 作用：直接操作 DOM 元素，设置固定/取消固定的图标、aria-label 和 data-pin 属性
 * 意图：封装底层的 DOM 操作逻辑，复用于 toggle 和 set 操作
 * 调用时机：在 执行固定操作 或 切换固定状态 中调用
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
 * 作用：根据传入的上下文（headIconCtx）中的 type 字段分发不同的处理逻辑（关闭、固定、打开、粘贴标签页）
 * 意图：统一处理面板头部各种功能图标的点击事件
 * 调用时机：面板头部图标被点击时调用
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
    // Electron 环境下，点击 open 图标时在新窗口打开引用块
    if (type === "open" && firstRef && isElectron) {
        openNewWindowById(firstRef.refID);
        return;
    }
    if (type === "open") {
        return;
    }
    if (type === "stickTab") {
        执行粘贴标签页操作(refDefs, app, onDestroy);
    }
}

/**
 * 执行固定操作
 * 作用：读取当前元素的 data-pin 状态并取反，调用 应用固定状态 更新 UI
 * 意图：处理点击固定按钮的具体业务逻辑
 * 调用时机：在 执行图标操作 中，当 type 为 'pin' 时调用
 */
function 执行固定操作(target: HTMLElement, element: HTMLElement): void {
    const 当前固定 = element.getAttribute("data-pin") === "true";
    const useElement = target.querySelector("use");
    if (!useElement) {
        return;
    }
    // 切换状态：当前固定则取消固定，当前未固定则固定
    应用固定状态(target, useElement, element, !当前固定);
}

/**
 * 执行粘贴标签页操作
 * 作用：在非移动端环境下，打开引用块对应的文件，并根据情况处理折叠状态
 * 意图：响应 'stickTab' 操作，将当前内容以标签页形式打开
 * 调用时机：在 执行图标操作 中，当 type 为 'stickTab' 时调用
 */
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
