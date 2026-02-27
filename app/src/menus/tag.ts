import { MenuItem } from "./Menu.Item";
import {fetchPost} from "../util/network/fetch";
import {confirmDialog} from "../dialog/confirmDialog";
import {escapeHtml} from "../util/DOM/escape";
import {renameTag} from "../util/platform/noRelyPCFunction";
import {getDockByType} from "../layout/tabUtil";
import {Tag} from "../layout/dock/Tag";
import {Constants} from "../constants";
import {isMobile} from "../platform";

export const openTagMenu = (element: HTMLElement, event: MouseEvent, labelName: string) => {
    if (!window.siyuan.menus.menu.element.classList.contains("fn__none") &&
        window.siyuan.menus.menu.element.getAttribute("data-name") === Constants.MENU_TAG) {
        window.siyuan.menus.menu.remove();
        return;
    }
    window.siyuan.menus.menu.remove();
    window.siyuan.menus.menu.append(new MenuItem({
        icon: "iconEdit",
        label: window.siyuan.languages.rename,
        click: () => {
            renameTag(labelName);
        }
    }).element);
    window.siyuan.menus.menu.append(new MenuItem({
        icon: "iconTrashcan",
        label: window.siyuan.languages.remove,
        click: () => {
            confirmDialog(window.siyuan.languages.deleteOpConfirm, `${window.siyuan.languages.confirmDelete} <b>${escapeHtml(labelName)}</b>?`, () => {
                fetchPost("/api/tag/removeTag", {label: labelName}, () => {
                    // 移动端使用移动端标签面板更新
                    if (isMobile) {
                        window.siyuan.mobile.docks.tag.update();
                        return;
                    }
                    // 桌面端使用 dock 标签面板更新
                    const dockTag = getDockByType("tag");
                    (dockTag.data.tag as Tag).update();
                });
            }, undefined, true);
        }
    }).element);
    window.siyuan.menus.menu.element.setAttribute("data-name", Constants.MENU_TAG);
    window.siyuan.menus.menu.popup({x: event.clientX - 11, y: event.clientY + 11, h: 22, w: 12});
};
