import { MenuItem } from "../../../menus/Menu.Item";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 用途：Outline 树交互领域根；使用范围：右键树动作；解耦评估：替代具体 Outline class。 */
import type {IOutlineTreePanel} from "./types";

/**
 * 作用：添加展开/折叠相关的菜单项。
 * 意图：提供对大纲树节点的展开、折叠操作，包括子标题、同级标题以及全部展开/折叠。
 * 调用时机：在构建大纲右键菜单时调用，通常位于菜单末尾。
 */
export async function appendExpandCollapseMenuItems(outline: IOutlineTreePanel, element: HTMLElement) {
    const menu = getSiyuanGlobalMenusMenu();

    // 展开子标题
    menu.append(new MenuItem({
        id: "expandChildHeading",
        icon: "iconExpand",
        label: siyuanI18n.expandChildHeading,
        accelerator: "⌘" + siyuanI18n.clickArrow,
        /**
         * 作用：展开当前标题的所有子标题。
         * 意图：方便用户快速查看子级内容。
         * 调用时机：用户点击“展开子标题”菜单项时。
         */
        click: () => outline.collapseChildren(element, true)
    }).element);

    // 折叠子标题
    menu.append(new MenuItem({
        id: "foldChildHeading",
        icon: "iconContract",
        label: siyuanI18n.foldChildHeading,
        accelerator: "⌘" + siyuanI18n.clickArrow,
        /**
         * 作用：折叠当前标题的所有子标题。
         * 意图：方便用户隐藏子级内容，专注当前级别。
         * 调用时机：用户点击“折叠子标题”菜单项时。
         */
        click: () => outline.collapseChildren(element, false)
    }).element);

    // 展开同级标题
    menu.append(new MenuItem({
        id: "expandSameLevelHeading",
        icon: "iconExpand",
        label: siyuanI18n.expandSameLevelHeading,
        accelerator: "⌥" + siyuanI18n.clickArrow,
        /**
         * 作用：展开所有与当前标题同级的标题。
         * 意图：方便用户查看同一层级的所有内容。
         * 调用时机：用户点击“展开同级标题”菜单项时。
         */
        click: () => outline.collapseSameLevel(element, true)
    }).element);

    // 折叠同级标题
    menu.append(new MenuItem({
        id: "foldSameLevelHeading",
        icon: "iconContract",
        label: siyuanI18n.foldSameLevelHeading,
        accelerator: "⌥" + siyuanI18n.clickArrow,
        /**
         * 作用：折叠所有与当前标题同级的标题。
         * 意图：方便用户隐藏同一层级的内容。
         * 调用时机：用户点击“折叠同级标题”菜单项时。
         */
        click: () => outline.collapseSameLevel(element, false)
    }).element);

    // 全部展开
    menu.append(new MenuItem({
        id: "expandAll",
        icon: "iconExpand",
        label: siyuanI18n.expandAll,
        /**
         * 作用：展开大纲中的所有节点。
         * 意图：让用户看到完整的文档结构。
         * 调用时机：用户点击“全部展开”菜单项时。
         */
        click: () => {
            outline.tree.expandAll();
            outline.saveExpendIds();
        }
    }).element);

    // 全部折叠
    menu.append(new MenuItem({
        id: "foldAll",
        icon: "iconContract",
        label: siyuanI18n.foldAll,
        /**
         * 作用：折叠大纲中的所有节点。
         * 意图：让用户只看到最顶层的结构，节省空间。
         * 调用时机：用户点击“全部折叠”菜单项时。
         */
        click: () => {
            outline.tree.collapseAll();
            outline.saveExpendIds();
        }
    }).element);
}
