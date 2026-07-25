/** 用途：完整 Outline 面板领域根；使用范围：图标命令分派；解耦评估：替代具体 class 和 Dock 查询依赖。 */
import type {IOutlinePanel} from "./types";

/** 点击搜索图标时显示并选中当前 header 输入框。 */
function showSearch(input: HTMLInputElement) {
    input.classList.remove("fn__none");
    input.select();
}

/** 点击展开层级图标时打开菜单并终止本次图标事件继续传播。 */
function showExpandLevel(outline: IOutlinePanel, target: HTMLElement, event: MouseEvent) {
    outline.showExpandLevelMenu(target);
    event.preventDefault();
    event.stopPropagation();
}

/**
 * 作用：处理面板内图标的点击。
 * 意图：根据图标的 data-type 属性，执行对应的策略动作。
 * 调用时机：handlePanelClick 检测到点击了 .block__icon 时。
 * @同步豁免: 需要绝对同步的DOM访问 - 点击分派必须使用当前事件目标和输入框状态。
 */
export function handlePanelIconClick(outline: IOutlinePanel, target: HTMLElement, event: MouseEvent) {
    const type = target.getAttribute("data-type");
    const inputElement = outline.headerElement.querySelector("input.b3-text-field.search__label");

    /**
     * 作用：检查是否为搜索图标且输入框有效。
     * 意图：如果点击的是搜索图标，确保输入框元素存在以便聚焦。
     * 生效场景：type 为 "search" 且 inputElement 是 HTMLInputElement。
     */
    if (type === "search" && inputElement instanceof HTMLInputElement) {
        showSearch(inputElement);
        return;
    }

    /**
     * 作用：检查是否为最小化图标。
     * 意图：执行最小化面板操作。
     * 生效场景：type 为 "min"。
     */
    if (type === "min") {
        outline.minimize();
        return;
    }

    /**
     * 作用：检查是否为展开层级图标。
     * 意图：显示展开层级菜单。
     * 生效场景：type 为 "expandLevel"。
     */
    if (type === "expandLevel") {
        showExpandLevel(outline, target, event);
        return;
    }
}
