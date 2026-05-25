/**
 * 文件树"更多"菜单模块
 *
 * @description
 * 作用：提供文件树面板右上角"更多"按钮的菜单初始化功能
 * 意图：将菜单逻辑从 Files.ts 中分离，减少主文件行数
 */

import type { InitMoreMenuDeps } from "./moreMenu.types";
import { MenuItem } from "../../../menus/Menu.Item";
import { sortMenu } from "../../../menus/navigation";
import { fetchPost } from "../../../util/network/fetch";
import { newNotebook } from "../../../util/file/mount";
import { setNoteBook } from "../../../util/file/pathName";
import { refreshFileTree } from "../../../dialog/processSystem";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";

/**
 * 创建新建笔记本菜单项
 *
 * @description
 * 作用：创建"新建笔记本"菜单项元素
 * 意图：将菜单项创建逻辑独立出来，便于维护
 * 调用时机：initMoreMenu 构建菜单时调用
 *
 * @returns 菜单项元素
 */
function createNewNotebookMenuItem(): HTMLElement {
    return new MenuItem({
        icon: "iconNewNoteBook",
        label: siyuanI18n.newNotebook,
        /**
         * 点击回调
         * @description
         * 作用：触发新建笔记本对话框
         * 意图：允许用户创建新笔记本
         * 调用时机：用户点击菜单项时
         */
        click: () => {
            newNotebook();
        }
    }).element;
}

/**
 * 创建重建索引菜单项
 *
 * @description
 * 作用：创建"重建索引"菜单项元素
 * 意图：提供重建文件树索引的入口
 * 调用时机：initMoreMenu 构建菜单时调用
 *
 * @param deps - 依赖参数
 * @returns 菜单项元素
 */
function createRebuildIndexMenuItem(deps: InitMoreMenuDeps): HTMLElement {
    const { element, init } = deps;
    return new MenuItem({
        icon: "iconRefresh",
        label: siyuanI18n.rebuildIndex,
        /**
         * 点击回调
         * @description
         * 作用：触发文件树索引重建
         * 意图：修复文件树显示异常或同步问题
         * 调用时机：用户点击菜单项时
         */
        click: () => {
            // 防止重复点击：检查元素是否已被禁用
            if (!element.getAttribute("disabled")) {
                element.setAttribute("disabled", "disabled");
                refreshFileTree(() => {
                    element.removeAttribute("disabled");
                    init(false);
                });
            }
        }
    }).element;
}

/**
 * 处理排序变更
 *
 * @description
 * 作用：保存排序设置并刷新文件树
 * 意图：持久化用户的排序偏好
 * 调用时机：用户在排序子菜单中选择排序方式时
 *
 * @param sort - 排序方式
 * @param init - 初始化函数
 */
function handleSortChange(sort: number, init: (isInitialCall?: boolean) => void): void {
    const config = getSiyuanConfig();
    config.fileTree.sort = sort;
    fetchPost("/api/setting/setFiletree", {
        sort: config.fileTree.sort,
        alwaysSelectOpenedFile: config.fileTree.alwaysSelectOpenedFile,
        refCreateSavePath: config.fileTree.refCreateSavePath,
        docCreateSavePath: config.fileTree.docCreateSavePath,
        openFilesUseCurrentTab: config.fileTree.openFilesUseCurrentTab,
        maxListCount: config.fileTree.maxListCount,
    }, () => {
        setNoteBook(() => {
            init(false);
        });
    });
}

/**
 * 创建排序菜单项
 *
 * @description
 * 作用：创建"排序"子菜单项元素
 * 意图：提供笔记本排序方式的选择入口
 * 调用时机：initMoreMenu 构建菜单时调用
 *
 * @param init - 初始化函数
 * @returns 菜单项元素
 */
function createSortMenuItem(init: (isInitialCall?: boolean) => void): HTMLElement {
    const config = getSiyuanConfig();
    const subMenu = sortMenu("notebooks", config.fileTree.sort, (sort: number) => {
        handleSortChange(sort, init);
    });
    return new MenuItem({
        icon: "iconSort",
        label: siyuanI18n.sort,
        type: "submenu",
        submenu: subMenu,
    }).element;
}

/**
 * 初始化文件树"更多"菜单
 *
 * @description
 * 作用：构建并返回文件树面板的"更多"菜单
 * 意图：提供文件树的全局操作入口，包含新建笔记本、重建索引、排序等功能
 * 调用时机：用户点击文件树面板右上角的"更多"按钮时
 *
 * @同步豁免: UI构建 - 菜单构建需要同步返回菜单实例以便立即显示
 *
 * @param deps - 依赖参数，包含 element 和 init 函数
 * @returns 构建好的菜单实例
 */
export function initMoreMenu(deps: InitMoreMenuDeps) {
    const { init, element, refreshPublishAccessSwitch } = deps;
    const menu = getSiyuanGlobalMenusMenu();
    const config = getSiyuanConfig();

    menu.remove();

    // 新建笔记本菜单项（只读模式下不显示）
    if (!config.readonly) {
        menu.append(createNewNotebookMenuItem());
    }

    // 重建索引菜单项
    menu.append(createRebuildIndexMenuItem(deps));

    // 发布权限切换菜单项（只读且非发布模式下不显示）
    if (!config.readonly && !config.publish?.enable) {
        menu.append(new MenuItem({
            icon: "iconEye",
            label: siyuanI18n.publishAccess,
            checked: element.classList.contains("file-tree__publish-access--active"),
            click: () => {
                element.classList.toggle("file-tree__publish-access--active");
                const editingPublishAccess = element.classList.contains("file-tree__publish-access--active");
                element.querySelectorAll(".b3-list-item__icon").forEach(item => {
                    item.classList.toggle("fn__none", editingPublishAccess);
                });
                element.querySelectorAll(".b3-list-item__switch").forEach(item => {
                    item.classList.toggle("fn__none", !editingPublishAccess);
                });
                refreshPublishAccessSwitch?.();
            }
        }).element);
    }

    // 排序子菜单（只读模式下不显示）
    if (!config.readonly) {
        menu.append(createSortMenuItem(init));
    }

    return menu;
}
