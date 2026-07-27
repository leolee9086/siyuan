/**
 * 用途：描述打开添加排序菜单及刷新原 Panel 所需的完整既有上下文。
 * 使用场景：`addSort` 创建字段菜单，并在点击后提交事务、重绘和复位 Panel。
 * 关联类型：直接组合 AV 数据、Protyle 生命周期和宿主 DOM 几何，不作为跨领域契约。
 * 问题/改进：当前字段 `avId` 沿用调用方签名但事务以 `data.id` 为准，后续单独审计该既有差异。
 */
export type AddSortOptions = {
    data: IAV,
    rect: DOMRect,
    menuElement: HTMLElement,
    tabRect: DOMRect,
    avId: string,
    protyle: IProtyle,
    blockID: string,
};

/**
 * 用途：描述一次排序 Panel 事件绑定所需的完整生命周期状态。
 * 使用场景：Panel 首次打开、添加/删除/拖拽排序后的重新绑定。
 * 关联类型：由 Protyle、宿主 DOM、当前 AV 数据和事务块身份组成，仅在 Sort 领域使用。
 * 问题/改进：无；这些值共同确定事件写入目标，拆散传递会弱化调用语义。
 */
export type SortPanelBinding = {
    protyle: IProtyle,
    menuElement: HTMLElement,
    data: IAV,
    blockID: string,
};
