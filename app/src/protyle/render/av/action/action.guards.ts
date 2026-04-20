/**
 * action.guards.ts - action 子模块的类型收窄边界。
 *
 * 作用：集中处理从 DOM 属性读取的字符串到 TAVView / TAVCol 的收窄，
 * 避免在业务代码中散布 `as` 断言。
 * @同步豁免: 类型守卫
 */

const 视图类型列表: TAVView[] = ["table", "gallery", "kanban"];

/**
 * 将 data-av-type 字符串收窄为属性视图类型。
 *
 * 意图：DOM attribute 来自渲染层，运行时通常可靠，但 action 层仍需要一个集中的兜底入口。
 * 调用时机：在点击处理、菜单构建、动画刷新读取 `data-av-type` 后立即调用。
 * 问题/改进：如果未来新增视图类型，应同步扩充本守卫，避免默认回退到 table。
 *
 * @param {string | null} value - DOM attribute 读取到的视图类型字符串
 * @returns {TAVView} 收窄后的视图类型，无法识别时回退为 table
 */
export const toAttrViewType = (value: string | null): TAVView => {
    if (视图类型列表.includes(value as TAVView)) {
        return value as TAVView;
    }
    return "table";
};

/**
 * 将 data-dtype 字符串收窄为属性列类型。
 *
 * 意图：列菜单和字段菜单需要把 DOM 中的列类型重新传回列图标工具函数。
 * 调用时机：在右键菜单和动画刷新读取 `data-dtype` 后调用。
 * 问题/改进：这里保守回退为 text，若未来出现无效类型，应进一步增加日志或诊断提示。
 *
 * @param {string | null} value - DOM attribute 读取到的列类型字符串
 * @returns {TAVCol} 收窄后的列类型
 */
export const toAttrColType = (value: string | null): TAVCol => {
    return (value ?? "text") as TAVCol;
};

/**
 * 判断当前视图是否属于卡片式布局。
 *
 * 意图：gallery 和 kanban 在单元格刷新、点击行为上共享一套卡片式 DOM 规则。
 * 调用时机：在 action 模块区分表格布局与卡片布局时调用。
 * 问题/改进：如果未来新增新的卡片式视图，这里需要同步扩展。
 *
 * @param {TAVView} viewType - 已收窄的视图类型
 * @returns {boolean} 是否为 gallery / kanban
 */
export const isCardLayoutView = (viewType: TAVView): boolean => {
    return viewType === "gallery" || viewType === "kanban";
};
