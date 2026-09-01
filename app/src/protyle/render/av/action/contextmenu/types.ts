/** 用途：引用菜单实例类型。使用范围：插入菜单上下文类型定义中描述菜单句柄。解耦评估：类型仅用于类型层约束，不产生运行时耦合，适合由共享网关集中管理。 */
import type { Menu } from "./imports";

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

/**
 * 用途：插入菜单动作共享上下文。
 * 使用场景：在插入前后菜单的各类动作间传递，收敛 6 个同传参数为单一对象以满足 max-params 约束。
 * 关联类型：与 `BindInsertMenuItemContext` 配合，区分动作与绑定阶段的不同载荷。
 * 问题/改进：后续若需感知分组或虚拟滚动上下文，可扩展此结构而保持调用方参数稳定。
 */
export type InsertMenuActionContext = {
    menu: Menu;
    protyle: IProtyle;
    blockElement: HTMLElement;
    rowElement: HTMLElement;
    insertAfter: boolean;
    inputElement: HTMLInputElement;
};

/**
 * 用途：绑定插入菜单项所需的上下文。
 * 使用场景：构建插入前后菜单项的 `bind` 回调时创建，将 6 个同传参数收敛为一个对象。
 * 关联类型：与 `InsertMenuActionContext` 区分，绑定阶段持有 `element` 而非 `inputElement`。
 * 问题/改进：若后续 bind 需要感知更多菜单状态，可扩展此结构而保持调用方参数稳定。
 */
export type BindInsertMenuItemContext = {
    menu: Menu;
    protyle: IProtyle;
    blockElement: HTMLElement;
    rowElement: HTMLElement;
    insertAfter: boolean;
    element: HTMLElement;
};
