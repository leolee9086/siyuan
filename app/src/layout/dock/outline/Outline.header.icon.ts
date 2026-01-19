import { getDockByType } from "../../tabUtil";
import type { Outline } from "./Outline";
import { isHTMLInputElement } from "../../../util/DOM/element.guard";

/**
 * 定义图标点击的策略映射
 */
const iconClickStrategies = {
    /**
     * 作用：最小化面板。
     * 意图：调用 getDockByType 隐藏大纲面板。
     * 调用时机：点击最小化图标时。
     * 问题/改进：无
     */
    min: () => {
        getDockByType("outline")?.toggleModel("outline", false, true);
    },
    /**
     * 作用：激活搜索框。
     * 意图：显示并选中搜索框内容。
     * 调用时机：点击搜索图标时。
     * 问题/改进：无
     */
    search: (input: HTMLInputElement | null) => {
        if (input) {
            input.classList.remove("fn__none");
            input.select();
        }
    },
    /**
     * 作用：显示展开层级菜单。
     * 意图：调用 outline.showExpandLevelMenu 显示菜单。
     * 调用时机：点击展开层级图标时。
     * 问题/改进：无
     */
    expandLevel: (outline: Outline, target: HTMLElement, event: MouseEvent) => {
        outline.showExpandLevelMenu(target);
        event.preventDefault();
        event.stopPropagation();
    }
};

/**
 * 作用：处理面板内图标的点击。
 * 意图：根据图标的 data-type 属性，执行对应的策略动作。
 * 调用时机：handlePanelClick 检测到点击了 .block__icon 时。
 * @同步豁免: DOM访问
 */
export function handlePanelIconClick(outline: Outline, target: HTMLElement, event: MouseEvent) {
    const type = target.getAttribute("data-type");
    const inputElement = outline.headerElement.querySelector("input.b3-text-field.search__label");

    /**
     * 作用：检查是否为搜索图标且输入框有效。
     * 意图：如果点击的是搜索图标，确保输入框元素存在以便聚焦。
     * 生效场景：type 为 "search" 且 inputElement 是 HTMLInputElement。
     */
    if (type === "search" && isHTMLInputElement(inputElement)) {
        iconClickStrategies.search(inputElement);
        return;
    }

    /**
     * 作用：检查是否为最小化图标。
     * 意图：执行最小化面板操作。
     * 生效场景：type 为 "min"。
     */
    if (type === "min") {
        iconClickStrategies.min();
        return;
    }

    /**
     * 作用：检查是否为展开层级图标。
     * 意图：显示展开层级菜单。
     * 生效场景：type 为 "expandLevel"。
     */
    if (type === "expandLevel") {
        iconClickStrategies.expandLevel(outline, target, event);
        return;
    }
}
