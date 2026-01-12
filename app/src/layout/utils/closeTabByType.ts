import { Tab } from "../Tab";


/**
 * 根据类型关闭页签
 *
 * - 作用：根据类型（关闭其他、关闭所有、指定列表）批量关闭页签。
 * - 意图：为页签栏右键菜单及批量操作提供关闭功能。
 * - 调用时机：用户在界面上触发“关闭其他”、“关闭全部”或关闭选中页签时调用。
 * - 改进：使用逆序遍历代替原有的索引调整逻辑，避免数组变动带来的潜在问题。
 *
 * @param tab 基准页签
 * @param type 关闭类型
 * @param tabs 指定要关闭的页签列表（当 type 为 "other" 时使用）
 */
export const closeTabByType = async (tab: Tab, type: "closeOthers" | "closeAll" | "other", tabs?: Tab[]) => {
    // 关闭其他页签
    if (type === "closeOthers") {
        const children = tab.parent.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const item = children[i];
            if (item && item.id !== tab.id && !item.headElement.classList.contains("item--pin")) {
                await tab.parent.removeTab(item.id, true, false);
            }
        }
    }

    // 关闭所有页签
    if (type === "closeAll") {
        const children = tab.parent.children;
        for (let i = children.length - 1; i >= 0; i--) {
            const item = children[i];
            if (item && !item.headElement.classList.contains("item--pin")) {
                await tab.parent.removeTab(item.id, true);
            }
        }
    }

    // 关闭指定的一组页签
    if (type === "other" && tabs && tabs.length > 0) {
        for (const item of tabs) {
            if (!item.headElement.classList.contains("item--pin")) {
                await item.parent.removeTab(item.id);
            }
        }
    }

    // 如果基准页签还在且当前没有焦点，则聚焦基准页签
    if (tab.headElement.parentElement && !tab.headElement.parentElement.querySelector(".item--focus")) {
        tab.parent.switchTab(tab.headElement, true);
        return;
    }

    // 否则聚焦最后一个子页签（兜底策略）
    const lastChild = tab.parent.children[tab.parent.children.length - 1];
    if (lastChild) {
        tab.parent.switchTab(lastChild.headElement, true);
    }
};
