/**
 * 面包屑菜单显示逻辑
 * 从 Breadcrumb 类中提取的 showMenu 方法核心逻辑
 */
import { fetchPost } from "../../util/fetch";
import { Constants } from "../../constants";
import { hasClosestBlock, hasTopClosestByClassName } from "../util/hasClosest";
import { getEditorRange } from "../util/selection";
import { emitOpenMenu } from "../../plugin/EventBus";
import { getSiyuanConfig, getSiyuanMenus } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { 录音器上下文 } from "./breadcrumb.types";
import {
    添加资源转换菜单项,
    添加编辑模式菜单项,
    添加只读模式菜单项,
    添加全宽模式菜单项
} from "./menuItems";
import {
    添加懒加载菜单项,
    添加刷新菜单项,
    添加优化排版菜单项,
    添加全屏菜单项,
    添加文档信息菜单项,
    添加上传与录音组,
} from "./menuItems.misc";

/**
 * 显示面包屑"更多"菜单
 * @param protyle 编辑器实例
 * @param position 菜单位置
 * @param 录音上下文 录音相关的上下文对象
 */
export function 显示面包屑菜单(
    protyle: IProtyle,
    position: IPosition,
    录音上下文: 录音器上下文
): void {
    const menus = getSiyuanMenus();
    if (!menus) {
        return;
    }
    const menu = menus.menu;

    // 如果菜单已显示且是面包屑菜单，则关闭
    if (!menu.element.classList.contains("fn__none") &&
        menu.element.getAttribute("data-name") === Constants.MENU_BREADCRUMB_MORE) {
        menu.remove();
        return;
    }

    // 获取当前光标所在块的 ID
    let id: string | undefined;
    const cursorNodeElement = hasClosestBlock(getEditorRange(protyle.element).startContainer);
    if (cursorNodeElement) {
        id = cursorNodeElement.getAttribute("data-node-id") ?? undefined;
    }

    const blockId = id || (protyle.block.showAll ? protyle.block.id : protyle.block.rootID);

    fetchPost("/api/block/getTreeStat", { id: blockId }, (response) => {
        构建菜单内容(protyle, position, response, 录音上下文);
    });
}

/**
 * 构建菜单内容（fetchPost 回调）
 */
function 构建菜单内容(
    protyle: IProtyle,
    position: IPosition,
    response: IWebSocketData,
    录音上下文: 录音器上下文
): void {
    const menus = getSiyuanMenus();
    if (!menus) {
        return;
    }
    const menu = menus.menu;
    const siyuanConfig = getSiyuanConfig();

    if (!response.data || !response.data.stat) {
        return;
    }

    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_BREADCRUMB_MORE);

    // 上传和录音菜单项
    添加上传与录音组(protyle, menu, 录音上下文);

    // 资源转换菜单项
    if (!protyle.disabled) {
        添加资源转换菜单项(protyle, menu, siyuanConfig);
    }

    // 懒加载选项
    添加懒加载菜单项(protyle, menu);

    // 刷新菜单项（含分隔符）
    添加刷新菜单项(protyle, menu);

    // 优化排版
    添加优化排版菜单项(protyle, menu);

    // 全屏
    添加全屏菜单项(protyle, menu);

    // 编辑模式子菜单
    添加编辑模式菜单项(protyle, menu, siyuanConfig);

    // 只读模式子菜单
    if (!siyuanConfig.editor.readOnly && !siyuanConfig.readonly && protyle.wysiwyg) {
        添加只读模式菜单项(protyle, menu);
    }

    // 全宽模式子菜单
    /// #if !MOBILE
    if (!protyle.disabled && protyle.wysiwyg) {
        添加全宽模式菜单项(protyle, menu);
    }
    /// #endif

    // 插件菜单
    if (protyle.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-breadcrumbmore",
            detail: {
                protyle,
                data: response.data.stat,
            },
            separatorPosition: "top",
        });
    }

    // 文档信息
    添加文档信息菜单项(menu, response);

    // 显示菜单
    /// #if MOBILE
    menu.fullscreen();
    /// #else
    menu.popup(position);
    /// #endif

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
}
