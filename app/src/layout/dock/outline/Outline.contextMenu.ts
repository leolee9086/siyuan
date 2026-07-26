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
import type {OutlineDomain} from "./types";
import { appendLevelMenuItems, appendInsertMenuItems, appendSubDocMenu } from "./Outline.contextMenu.edit";
/** 用途：构建 Outline 剪贴板菜单；使用范围：右键菜单组合根；解耦评估：直接指向剪贴板菜单所有者，不经编辑菜单转发。 */
import {appendClipboardMenuItems} from "./Outline.contextMenu.clipboard";
import { appendExpandCollapseMenuItems } from "./Outline.contextMenu.tree";
/** 用途：保留 Outline class 使用的编辑器上下文公共行为；使用范围：菜单组合与实例装配；解耦评估：直接指向独立上下文所有者。 */
import {getProtyleAndBlockElement} from "./editorContext/resolve";
/** 用途：保留 Outline class 使用的标题转换菜单行为；使用范围：菜单组合与实例装配；解耦评估：直接指向编辑菜单所有者。 */
import {genHeadingTransform} from "./Outline.contextMenu.edit";

/** 导出 Outline 编辑器上下文解析行为。 */
export {getProtyleAndBlockElement};
/** 导出标题转换菜单构造行为。 */
export {genHeadingTransform};

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
export function showContextMenu(outline: OutlineDomain, element: HTMLElement, event: MouseEvent) {
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
