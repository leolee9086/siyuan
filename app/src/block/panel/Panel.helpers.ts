/** 用途：查找最近指定类名的祖先元素。使用范围：浮窗层级定位。解耦评估：通过 ./imports 转发。 */
import { hasClosestByClassName } from "./imports";
/** 用途：获取全局浮窗面板列表。使用范围：管理浮窗层级和清理。解耦评估：通过 ./imports 转发。 */
import { getSiyuanBlockPanels } from "./imports";
/** 用途：切换浮窗固定状态。使用范围：双击图标区域时切换固定。解耦评估：同目录模块直接导入。 */
import { 切换固定状态 } from "./actions";
/** 用途：执行图标点击操作。使用范围：处理浮窗工具栏图标点击。解耦评估：同目录模块直接导入。 */
import { 执行图标操作 } from "./actions";
/** 用途：面板图标能力签名；使用范围：转发打开引用页签动作；解耦评估：纯能力契约。 */
import type { headIconCtx } from "../Panel.types";

/**
 * 作用：初始化浮窗的层级关系和数据属性
 * 意图：确保浮窗在嵌套场景下正确继承父级层级，并设置唯一标识
 * 调用时机：BlockPanel构造函数中，创建DOM元素后立即调用
 * @同步豁免: UI构建 - 构造函数中需要立即同步设置DOM属性
 */
export function 初始化层级(
    element: HTMLElement,
    targetElement: HTMLElement | undefined,
    refDefs: IRefDefs[],
    清理回调: (level: number) => void
) {
    const parentElement = targetElement ? hasClosestByClassName(targetElement, "block__popover", true) : false;
    let level = 1;
    const firstRefDef = refDefs[0];
    // 非嵌套浮窗且有引用定义时，设置原始块ID
    if (!parentElement && firstRefDef) {
        element.setAttribute("data-oid", firstRefDef.refID);
    }
    const oid = parentElement ? parentElement.getAttribute("data-oid") : null;
    // 嵌套浮窗继承父级的原始块ID
    if (parentElement && oid) {
        element.setAttribute("data-oid", oid);
    }
    if (parentElement) {
        level = parseInt(parentElement.getAttribute("data-level") ?? "0") + 1;
    }
    element.setAttribute("data-level", level.toString());
    清理回调(level);
}

/**
 * 作用：清理同层级或更高层级的未固定浮窗
 * 意图：避免浮窗堆叠过多，保持界面整洁
 * 调用时机：新浮窗初始化层级时调用
 * @同步豁免: UI构建 - 构造函数中需要立即同步清理浮窗
 */
export function 清理同级浮窗(level: number) {
    const blockPanels = getSiyuanBlockPanels();
    for (let i = 0; i < blockPanels.length; i++) {
        const item = blockPanels[i];
        if (!item || !item.element) {
            continue;
        }
        const itemLevel = parseInt(item.element.getAttribute("data-level") ?? "0");
        // 清理未固定且层级不低于当前层级的浮窗
        if (item.element.getAttribute("data-pin") === "false" &&
            item.targetElement && itemLevel >= level) {
            item.destroy();
            i--;
        }
    }
}

/**
 * 作用：处理浮窗图标区域的双击事件，切换固定状态
 * 意图：提供快捷方式让用户固定/取消固定浮窗
 * 调用时机：用户双击浮窗图标区域时触发
 * @同步豁免: 需要绝对同步的DOM访问 - 事件处理器必须同步响应用户交互
 */
export function 处理双击事件(event: MouseEvent, element: HTMLElement) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
        return;
    }
    const iconsElement = hasClosestByClassName(target, "block__icons");
    if (!iconsElement) {
        return;
    }
    const 当前固定 = element.getAttribute("data-pin") === "true";
    切换固定状态(element, !当前固定);
    event.preventDefault();
    event.stopPropagation();
}

/**
 * 作用：处理浮窗内图标的点击事件
 * 意图：响应用户对浮窗工具栏图标的操作（如关闭、固定等）
 * 调用时机：用户点击浮窗内的图标时触发
 * @同步豁免: 需要绝对同步的DOM访问 - 事件处理器必须同步响应用户交互
 */
export function 处理图标点击(
    event: MouseEvent,
    element: HTMLElement,
    refDefs: IRefDefs[],
    openRefInTab: headIconCtx["openRefInTab"],
    onDestroy: () => void
) {
    const eventTarget = event.target;
    if (!(eventTarget instanceof HTMLElement)) {
        return;
    }
    let target = eventTarget;
    while (target && !target.isEqualNode(element)) {
        const isIconOrLogo = target.classList.contains("block__icon") || target.classList.contains("block__logo");
        const parentElement = target.parentElement;
        // 非图标元素且有父元素时，向上遍历
        if (!isIconOrLogo && parentElement) {
            target = parentElement;
            continue;
        }
        if (!isIconOrLogo) {
            break;
        }
        const type = target.getAttribute("data-type");
        执行图标操作({
            type,
            target,
            element,
            refDefs,
            openRefInTab,
            onDestroy
        });
        event.preventDefault();
        event.stopPropagation();
        break;
    }
}
