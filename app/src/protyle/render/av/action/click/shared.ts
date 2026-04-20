/**
 * 作用：统一结束已处理的点击事件。
 * 意图：避免每个分支重复写 `preventDefault` 和 `stopPropagation`。
 * 调用时机：任一 click handler 成功处理后立即调用。
 * 问题/改进：如果后续需要统一埋点，可以继续收敛到这里。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const consumeClickEvent = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    return true;
};

/**
 * 作用：识别只负责切换整行选择的标记列。
 * 意图：保持 updated / created / lineNumber 不进入编辑态的原行为。
 * 调用时机：普通单元格点击后，在进入编辑态前调用。
 * 问题/改进：如果未来新增同类只读列，需要同步扩充。
 *
 * @同步豁免: 类型守卫
 */
export const isReadonlyRowMarkerCell = (cellType: string | undefined) => {
    return cellType === "updated" || cellType === "created" || cellType === "lineNumber";
};

/**
 * 作用：把 data-type 映射为配置面板类型。
 * 意图：收敛 properties / config / switcher / sorts / filters 的分发规则。
 * 调用时机：点击配置按钮后，在决定是否打开 openMenuPanel 前调用。
 * 问题/改进：若后续 data-type 继续增长，可以再拆成更细的分发器。
 *
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getMenuPanelType = (dataType: string | null) => {
    if (dataType === "av-header-more") {
        return "properties";
    }
    if (dataType === "av-more") {
        return "config";
    }
    if (dataType === "av-switcher") {
        return "switcher";
    }
    if (dataType === "av-sort") {
        return "sorts";
    }
    if (dataType === "av-filter") {
        return "filters";
    }
    return undefined;
};
