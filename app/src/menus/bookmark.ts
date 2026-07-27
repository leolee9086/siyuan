import { MenuItem } from "./Menu.Item";
import { Dialog } from "../dialog";
import { fetchPost } from "../util/network/fetch";
import { confirmDialog } from "../dialog/confirmDialog";
import { escapeHtml } from "../util/DOM/escape";
import {copySubMenu} from "./commonMenuItem/copy/copySubMenu.factory";
import type {BookmarkDomain} from "../layout/dock/bookmark/bookmark.types";
import { isMobile } from "../util/platform/functions";
import type {MobileBookmarksDomain} from "../mobile/dock/bookmark/mobileBookmarks.types";
import { Constants } from "../constants";
import { getSiyuanGlobalMenus } from "../util/siyuanEnvironments/getMenu.environment";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/**
 * 创建书签重命名菜单项
 *
 * 此函数用于在书签dock的右键菜单中创建"重命名"选项。只有当元素是纯书签项（非块引用书签）
 * 且系统处于非只读模式时，才会显示此菜单项。
 *
 * @param element - 书签列表项的DOM元素，预期包含书签文本内容
 * @returns 返回创建的菜单项DOM元素，如果不满足条件则返回null
 *
 * @example
 * ```typescript
 * const menuItem = createRenameBookmarkMenuItem(bookmarkElement);
 * if (menuItem) {
 *   menu.append(menuItem);
 * }
 * ```
 */
const createRenameBookmarkMenuItem = (element: HTMLElement) => {
    // 获取元素的data-node-id属性，用于判断是否为块引用书签
    // 没有data-node-id说明是纯书签项目而不是块项目
    const id = element.getAttribute("data-node-id");

    // 检查是否为块引用书签(id存在)或系统处于只读模式
    // 在这两种情况下，不允许重命名操作
    if (id || getSiyuanConfig().readonly) {
        return null;
    }

    return new MenuItem({
        id: "rename",
        icon: "iconEdit",
        label: siyuanI18n.rename,
        click: () => {
            const textElement = element.querySelector(".b3-list-item__text");
            if (!textElement) {
return;
}

            const oldBookmark = textElement.textContent || "";
            const dialog = new Dialog({
                title: siyuanI18n.rename,
                content: `<div class="b3-dialog__content"><input class="b3-text-field fn__block"></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
                width: isMobile() ? "92vw" : "520px",
            });
            dialog.element.setAttribute("data-key", Constants.DIALOG_RENAMEBOOKMARK);
            const btnsElement = dialog.element.querySelectorAll(".b3-button");
            if (btnsElement[0]) {
                btnsElement[0].addEventListener("click", () => {
                    dialog.destroy();
                });
            }
            const inputElement = dialog.element.querySelector("input") as HTMLInputElement;
            if (inputElement) {
                dialog.bindInput(inputElement, () => {
                    if (btnsElement[1]) {
                        (btnsElement[1] as HTMLButtonElement).click();
                    }
                });
                inputElement.value = oldBookmark;
                inputElement.focus();
                inputElement.select();
            }
            if (btnsElement[1]) {
                btnsElement[1].addEventListener("click", () => {
                    if (inputElement) {
                        fetchPost("/api/bookmark/renameBookmark", {
                            oldBookmark,
                            newBookmark: inputElement.value
                        }, () => {
                            dialog.destroy();
                        });
                    }
                });
            }
        }
    });
};

/**
 * 创建书签复制菜单项
 *
 * 此函数用于在书签dock的右键菜单中创建"复制"选项。只有当元素是块引用书签
 * （即存在data-node-id属性）时，才会显示此菜单项，提供各种复制操作。
 *
 * @param element - 书签列表项的DOM元素，预期包含data-node-id属性
 * @returns 返回创建的菜单项DOM元素，如果不满足条件则返回null
 *
 * @example
 * ```typescript
 * const menuItem = createCopyBookmarkMenuItem(bookmarkElement);
 * if (menuItem) {
 *   menu.append(menuItem);
 * }
 * ```
 */
const createCopyBookmarkMenuItem = (element: HTMLElement) => {
    // 获取元素的data-node-id属性，用于判断是否为块引用书签
    const id = element.getAttribute("data-node-id");

    // 只有块引用书签（有data-node-id）才能复制
    if (!id) {
        return null;
    }

    return new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        type: "submenu",
        icon: "iconCopy",
        submenu: copySubMenu([id], false)
    });
};

/**
 * 创建书签删除菜单项
 *
 * 此函数用于在书签dock的右键菜单中创建"删除"选项。系统处于只读模式时不会显示此菜单项。
 * 支持删除两种类型的书签：块引用书签和纯书签。
 *
 * @param element - 书签列表项的DOM元素，包含书签文本和可能的data-node-id属性
 * @param bookmarkObj - 书签管理对象实例，用于在删除后更新书签列表
 * @returns 返回创建的菜单项DOM元素，如果系统处于只读模式则返回null
 *
 * @example
 * ```typescript
 * const menuItem = createRemoveBookmarkMenuItem(bookmarkElement, bookmarkInstance);
 * if (menuItem) {
 *   menu.append(menuItem);
 * }
 * ```
 */
const createRemoveBookmarkMenuItem = (element: HTMLElement, bookmarkObj: BookmarkDomain | MobileBookmarksDomain) => {
    // 检查系统是否处于只读模式，只读模式下不允许删除操作
    if (getSiyuanConfig().readonly) {
        return null;
    }

    return new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        click: () => {
            // 获取书签文本内容，用于确认对话框显示
            const textElement = element.querySelector(".b3-list-item__text");
            const bookmarkText = textElement?.textContent || "";

            // 获取data-node-id，用于区分书签类型
            const id = element.getAttribute("data-node-id");

            // 显示删除确认对话框
            confirmDialog(siyuanI18n.deleteOpConfirm, siyuanI18n.removeBookmark.replace("${x}", `<b>${escapeHtml(bookmarkText || "")}</b>`), () => {
                if (id) {
                    // 处理块引用书签：清空块的bookmark属性
                    fetchPost("/api/attr/setBlockAttrs", { id, attrs: { bookmark: "" } }, () => {
                        bookmarkObj.update();
                    });

                    // 同时更新页面中所有对应的块元素，移除书签显示
                    document.querySelectorAll(`.protyle-wysiwyg [data-node-id="${id}"]`).forEach((item) => {
                        item.setAttribute("bookmark", "");
                        const bookmarkElement = item.querySelector(".protyle-attr--bookmark");
                        if (bookmarkElement) {
                            bookmarkElement.remove();
                        }
                    });
                }
                if (!id) {
                    // 处理纯书签：直接从书签列表中移除
                    fetchPost("/api/bookmark/removeBookmark", { bookmark: bookmarkText });
                }
            }, undefined, true);
        }
    });
};

/**
 * 初始化并显示上下文菜单
 *
 * 此函数负责设置菜单的标识属性并在指定位置显示菜单。通过调整坐标偏移量
 * 确保菜单显示在合适的位置，避免遮挡鼠标指针。
 *
 * @param options - 菜单显示配置选项
 * @param options.rect - 菜单显示的位置和尺寸信息
 * @param options.rect.x - 鼠标点击的X坐标
 * @param options.rect.y - 鼠标点击的Y坐标
 * @param options.rect.w - 菜单宽度（通常为固定值）
 * @param options.rect.h - 菜单高度（通常为固定值）
 * @param options.dataname - 菜单的数据标识名称，用于菜单管理
 *
 * @example
 * ```typescript
 * initializeAndShowMenu({
 *   rect: { x: 100, y: 200, w: 12, h: 22 },
 *   dataname: "bookmark-menu"
 * });
 * ```
 */
const initializeAndShowMenu = (options: { rect: { x: number, y: number, w: number, h: number }, dataname: string }) => {
    // 设置菜单的数据名称属性，用于菜单管理和识别
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", options.dataname);

    // 在指定位置显示菜单，通过偏移量调整确保菜单不会遮挡鼠标指针
    // x-11: 向左偏移11像素，y+11: 向下偏移11像素
    getSiyuanGlobalMenus().menu.popup({ x: options.rect.x - 11, y: options.rect.y + 11, h: options.rect.h, w: options.rect.w });
};

/**
 * 打开书签上下文菜单
 *
 * 此函数是书签dock右键菜单的主要入口函数，负责根据当前书签的类型和系统状态
 * 动态创建相应的菜单项，并在鼠标点击位置显示菜单。如果书签菜单已经显示，
 * 则会关闭菜单实现切换效果。
 *
 * @param element - 触发右键菜单的书签列表项DOM元素
 * @param event - 鼠标事件对象，包含点击位置信息
 * @param bookmarkObj - 书签管理对象实例，用于菜单操作后的状态更新
 *
 * @example
 * ```typescript
 * bookmarkElement.addEventListener('contextmenu', (e) => {
 *   e.preventDefault();
 *   openBookmarkMenu(bookmarkElement, e, bookmarkInstance);
 * });
 * ```
 */
export const openBookmarkMenu = (element: HTMLElement, event: MouseEvent, bookmarkObj: BookmarkDomain | MobileBookmarksDomain) => {
    // 检查书签菜单是否已经显示，如果是则关闭菜单实现切换效果
    if (!getSiyuanGlobalMenus().menu.element.classList.contains("fn__none") &&
        getSiyuanGlobalMenus().menu.element.getAttribute("data-name") === Constants.MENU_BOOKMARK) {
        getSiyuanGlobalMenus().menu.remove();
        return;
    }

    // 清空现有菜单内容
    getSiyuanGlobalMenus().menu.remove();

    // 根据书签类型动态创建重命名菜单项（仅纯书签显示）
    const renameMenuItem = createRenameBookmarkMenuItem(element);
    if (renameMenuItem) {
        getSiyuanGlobalMenus().menu.appendMenuItemLike(renameMenuItem);
    }

    // 根据书签类型动态创建复制菜单项（仅块引用书签显示）
    const copyMenuItem = createCopyBookmarkMenuItem(element);
    if (copyMenuItem) {
        getSiyuanGlobalMenus().menu.appendMenuItemLike(copyMenuItem);
    }

    // 创建删除菜单项（非只读模式下显示）
    const removeMenuItem = createRemoveBookmarkMenuItem(element, bookmarkObj);
    if (removeMenuItem) {
        getSiyuanGlobalMenus().menu.appendMenuItemLike(removeMenuItem);
    }

    // 在鼠标点击位置显示菜单
    initializeAndShowMenu({
        rect: {
            x: event.clientX,
            y: event.clientY,
            w: 12,  // 菜单宽度固定值
            h: 22   // 菜单高度固定值
        },
        dataname: Constants.MENU_BOOKMARK
    });
};
