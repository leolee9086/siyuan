/**
 * 用途：表示一条已选中的属性视图记录及其主键单元格上下文。
 * 使用场景：右键菜单复制、插入、字段编辑和添加到数据库都会复用这一组 DOM 引用与标识。
 * 关联类型：由 `AttrViewContextmenuState` 聚合持有，并由 selection.ts 负责组装。
 * 问题/改进：当前仍然直接持有 DOM 节点，未来如果 AV 有稳定的 ViewModel，可以逐步替换为纯数据结构。
 */
export type SelectedAttrViewRow = {
    rowElement: HTMLElement;
    keyCellElement: HTMLElement;
    keyTextElement: HTMLElement;
    rowId: string;
    blockId: string;
    isDetached: boolean;
};

/**
 * 用途：表示一次属性视图右键菜单构建所需的完整上下文。
 * 使用场景：右键菜单入口在完成选中态同步后，把共享上下文传给 copy/openBy/fields 等子模块。
 * 关联类型：依赖 `SelectedAttrViewRow` 表示多选记录列表。
 * 问题/改进：这里把视图类型和选中记录绑定在一起，后续若菜单行为进一步按视图拆分，可以再细化子上下文。
 */
export type AttrViewContextmenuState = {
    blockElement: HTMLElement;
    viewType: TAVView;
    rowElement: HTMLElement;
    selectedRows: SelectedAttrViewRow[];
    keyRow: SelectedAttrViewRow;
    hasAttachedBlock: boolean;
};
