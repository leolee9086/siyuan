//@AIDONE 检查App等导入被用作值还是类型,如果仅用作类型则改为 type 导入以优化性能
/** 用途：在新窗口中打开指定块。使用范围：Electron 下打开引用块。解耦评估：通过 ./imports 转发。 */
import { openNewWindowById } from "./imports";
/** 用途：在编辑器中打开指定文件。使用范围：粘贴标签页操作。解耦评估：通过 ./imports 转发。 */
import { openFileById } from "./imports";
/** 用途：检查块是否折叠并执行回调。使用范围：粘贴标签页前检查折叠。解耦评估：通过 ./imports 转发。 */
import { checkFold } from "./imports";
/** 用途：判断当前是否为 Electron 环境。使用范围：判断是否支持新窗口。解耦评估：通过 ./imports 转发。 */
import { isElectron } from "./imports";
/** 用途：获取国际化文本。使用范围：固定按钮 aria-label。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";
/** 用途：App 类型定义。使用范围：函数参数类型标注。解耦评估：通过 ./imports 转发。 */
import type { App } from "./imports";
// 用途：面板头部图标上下文类型；使用范围：执行图标操作函数的参数类型；解耦评估：本地类型定义，作为类型导入不影响运行时
import type { headIconCtx } from "../Panel.types";
// 用途：固定操作固定的 DOM 元素上下文；使用范围：应用固定状态函数参数类型；解耦评估：本地类型，通过类型文件集中管理
import type { 固定状态上下文 } from "../Panel.types";

/**
 * 切换面板的固定状态
 * 作用：查找面板内的固定按钮并更新其状态（图标及 aria-label）和面板容器的 data-pin 属性
 * 意图：供外部调用，强制设定面板的固定/未固定视觉状态
 * 调用时机：通常在面板初始化或需要重置状态时调用
 * @同步豁免: 需要绝对同步的DOM访问 - 必须立即更新DOM状态以保证UI一致性
 */
export function 切换固定状态(element: HTMLElement, 固定: boolean) {
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
    应用固定状态({ pinElement, useElement, element }, 固定);
}

/**
 * 应用固定状态到元素上（核心逻辑）
 * 作用：直接操作 DOM 元素，设置固定/取消固定的图标、aria-label 和 data-pin 属性
 * 意图：封装底层的 DOM 操作逻辑，复用于 toggle 和 set 操作
 * 调用时机：在 执行固定操作 或 切换固定状态 中调用
 */
function 应用固定状态(
    ctx: 固定状态上下文,
    固定: boolean
) {
    const { pinElement, useElement, element } = ctx;
    // 判断是否需要固定面板：当固定参数为true时，设置为固定状态（显示取消固定图标）；否则设置为未固定状态（显示固定图标）
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
 * @同步豁免: UI构建 - 事件处理器必须同步响应用户点击，立即执行对应操作
 */
export function 执行图标操作(ctx: headIconCtx) {
    const { type, target, element, refDefs, app, onDestroy } = ctx;
    const firstRef = refDefs[0];

    // 判断是否为关闭操作：当用户点击关闭图标时，调用销毁回调关闭面板
    if (type === "close") {
        onDestroy();
        return;
    }
    // 判断是否为固定操作：当用户点击固定图标时，切换面板的固定状态
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
    // 判断是否为粘贴标签页操作：当用户点击粘贴标签页图标时，在编辑器中打开引用块并关闭浮窗
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
function 执行固定操作(target: HTMLElement, element: HTMLElement) {
    const 当前固定 = element.getAttribute("data-pin") === "true";
    const useElement = target.querySelector("use");
    if (!useElement) {
        return;
    }
    // 切换状态：当前固定则取消固定，当前未固定则固定
    应用固定状态({ pinElement: target, useElement, element }, !当前固定);
}

/**
 * 执行粘贴标签页操作
 * 作用：在非移动端环境下，打开引用块对应的文件，并根据情况处理折叠状态
 * 意图：响应 'stickTab' 操作，将当前内容以标签页形式打开
 * 调用时机：在 执行图标操作 中，当 type 为 'stickTab' 时调用
 */
function 执行粘贴标签页操作(refDefs: IRefDefs[], app: App, onDestroy: () => void) {
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
