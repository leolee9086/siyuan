/**
 * 用途：描述一次表格框选矩形对物理单元格的包含查询。
 * 使用场景：复制、剪切、粘贴、鼠标框选与批量清空。
 * 关联类型：选区和目标均为当前表格 DOM，滚动偏移用于还原同一坐标系。
 * 问题/改进：现有交互使用固定 6px 内缩容差，若视觉规范调整应在唯一几何实现中同步修改。
 */
export interface TableSelectionContainmentQuery {
    tableSelectElement: HTMLElement;
    scrollLeft: number;
    scrollTop: number;
    item: HTMLTableCellElement;
}
