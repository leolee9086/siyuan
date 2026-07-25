/**
 * Outline 右键菜单
 * 从 Outline.ts 拆分出来以保持单文件行数限制
 */
import type { AppFacade } from "../../../app/AppFacade.types";
import { MenuItem } from "../../../menus/Menu.Item";
import { Constants } from "../../../constants";
import { checkFold } from "../../../util/platform/noRelyPCFunction";
import { openFileById } from "../../../editor/utils.openFileById";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
import type { Outline } from "./Outline";
import { appendLevelMenuItems, appendInsertMenuItems, appendClipboardMenuItems, appendSubDocMenu } from "./Outline.contextMenu.edit";
import { appendExpandCollapseMenuItems } from "./Outline.contextMenu.tree";
// 重导出编辑模块的函数供 Outline 使用
export { getProtyleAndBlockElement, genHeadingTransform } from "./Outline.contextMenu.edit";

const ZOOM_IN_ACTIONS: TProtyleAction[] = [Constants.CB_GET_FOCUS, Constants.CB_GET_ALL, Constants.CB_GET_HTML, Constants.CB_GET_OUTLINE];
const ZOOM_OUT_ACTIONS: TProtyleAction[] = [Constants.CB_GET_FOCUS, Constants.CB_GET_OUTLINE, Constants.CB_GET_SETID, Constants.CB_GET_CONTEXT, Constants.CB_GET_HTML];

/**
 * 作用：处理 checkFold 的回调，打开文件并设置焦点。
 * 意图：当折叠状态检查完成后，根据结果（不论是否 zoomIn）执行打开文件的动作。
 * 调用时机：checkFold 完成后。
 */
function handleOpenOutlineFile(app: AppFacade, id: string, zoomIn: boolean) {
    openFileById({
        app,
        id,
        position: "start",
        action: zoomIn ? ZOOM_IN_ACTIONS : ZOOM_OUT_ACTIONS,
    });
}

/**
 * 显示右键菜单
 * @同步豁免: UI构建
 */
export function showContextMenu(outline: Outline, element: HTMLElement, event: MouseEvent) {
    /**
     * 作用：检查大纲是否处于预览模式。
     * 意图：预览模式下主要用于查看，不应提供右键编辑菜单，避免误操作。
     * 生效场景：当 `outline.isPreview` 为 true 时。
     */
    if (outline.isPreview) {
        return; // 预览模式下不显示右键菜单
    }
    const currentLevel = parseInt(element.getAttribute("data-subtype")?.replace("h", "") || "0", 10);
    getSiyuanGlobalMenusMenu().remove();
    getSiyuanGlobalMenusMenu().element.setAttribute("data-name", Constants.MENU_OUTLINE_CONTEXT);
    const id = element.getAttribute("data-node-id");
    if (!id) {
        return;
    }

    /**
     * 作用：仅在非只读模式下显示编辑菜单项。
     * 意图：只读模式（如发布分享、只读锁定）下禁止修改文档结构和内容。
     * 生效场景：`getSiyuanConfig().readonly` 为 false 时。
     */
    if (!getSiyuanConfig().readonly) {
        // 升降级和转换菜单
        appendLevelMenuItems(outline, element, id, currentLevel);
        appendSubDocMenu(outline, element);

        // 跳转并聚焦
        checkFold(id, (zoomIn) => handleOpenOutlineFile(outline.app, id, zoomIn));
        outline.setCurrentById(id);

        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);

        // 插入标题菜单
        appendInsertMenuItems(outline, element, id, currentLevel);

        getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    }

    // 复制/剪切/删除菜单
    appendClipboardMenuItems(outline, element, id);

    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_3", type: "separator" }).element);

    // 展开/折叠菜单
    appendExpandCollapseMenuItems(outline, element);

    getSiyuanGlobalMenusMenu().popup({
        x: event.clientX,
        y: event.clientY
    });
}
