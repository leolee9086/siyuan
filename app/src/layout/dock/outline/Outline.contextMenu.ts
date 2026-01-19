/**
 * Outline 右键菜单
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { checkFold } from "../../../util/noRelyPCFunction";
import { openFileById } from "../../../editor/utils.openFileById";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import type { Outline } from "./Outline";
import { appendLevelMenuItems, appendInsertMenuItems, appendClipboardMenuItems, appendSubDocMenu } from "./Outline.contextMenu.edit";

// 重导出编辑模块的函数供 Outline 使用
export { getProtyleAndBlockElement, genHeadingTransform } from "./Outline.contextMenu.edit";

/**
 * 显示右键菜单
 */
export function showContextMenu(this: Outline, element: HTMLElement, event: MouseEvent) {
    if (this.isPreview) {
        return; // 预览模式下不显示右键菜单
    }
    const currentLevel = this.getHeadingLevel(element);
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_OUTLINE_CONTEXT);
    const id = element.getAttribute("data-node-id");

    if (!window.siyuan.config.readonly) {
        // 升降级和转换菜单
        appendLevelMenuItems.call(this, element, id, currentLevel);
        appendSubDocMenu.call(this, element);

        // 跳转并聚焦
        checkFold(id, (zoomIn) => {
            openFileById({
                app: this.app,
                id,
                scrollPosition: "start",
                action: zoomIn
                    ? [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HTML, Constants.CB_GET_OUTLINE]
                    : [Constants.CB_GET_FOCUS, Constants.CB_GET_OUTLINE, Constants.CB_GET_SETID, Constants.CB_GET_CONTEXT, Constants.CB_GET_HTML],
            });
        });
        this.setCurrentById(id);

        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);

        // 插入标题菜单
        appendInsertMenuItems.call(this, element, id, currentLevel);

        window.siyuan.menus.menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    }

    // 复制/剪切/删除菜单
    appendClipboardMenuItems.call(this, element, id);

    window.siyuan.menus.menu.append(new MenuItem({ id: "separator_3", type: "separator" }).element);

    // 展开子标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "expandChildHeading",
        icon: "iconExpand",
        label: siyuanI18n.expandChildHeading,
        accelerator: "⌘" + siyuanI18n.clickArrow,
        click: () => this.collapseChildren(element, true)
    }).element);

    // 折叠子标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "foldChildHeading",
        icon: "iconContract",
        label: siyuanI18n.foldChildHeading,
        accelerator: "⌘" + siyuanI18n.clickArrow,
        click: () => this.collapseChildren(element, false)
    }).element);

    // 展开同级标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "expandSameLevelHeading",
        icon: "iconExpand",
        label: siyuanI18n.expandSameLevelHeading,
        accelerator: "⌥" + siyuanI18n.clickArrow,
        click: () => this.collapseSameLevel(element, true)
    }).element);

    // 折叠同级标题
    window.siyuan.menus.menu.append(new MenuItem({
        id: "foldSameLevelHeading",
        icon: "iconContract",
        label: siyuanI18n.foldSameLevelHeading,
        accelerator: "⌥" + siyuanI18n.clickArrow,
        click: () => this.collapseSameLevel(element, false)
    }).element);

    // 全部展开
    window.siyuan.menus.menu.append(new MenuItem({
        id: "expandAll",
        icon: "iconExpand",
        label: siyuanI18n.expandAll,
        click: () => {
            this.tree.expandAll();
            this.saveExpendIds();
        }
    }).element);

    // 全部折叠
    window.siyuan.menus.menu.append(new MenuItem({
        id: "foldAll",
        icon: "iconContract",
        label: siyuanI18n.foldAll,
        click: () => {
            this.tree.collapseAll();
            this.saveExpendIds();
        }
    }).element);

    window.siyuan.menus.menu.popup({
        x: event.clientX,
        y: event.clientY
    });
}
