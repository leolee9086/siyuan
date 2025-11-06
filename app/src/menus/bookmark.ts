import { MenuItem } from "./Menu.Item";
import {Dialog} from "../dialog";
import {fetchPost} from "../util/fetch";
import {confirmDialog} from "../dialog/confirmDialog";
import {escapeHtml} from "../util/escape";
import {copySubMenu} from "./commonMenuItem";
import {Bookmark} from "../layout/dock/Bookmark";
import {isMobile} from "../util/functions";
import {MobileBookmarks} from "../mobile/dock/MobileBookmarks";
import {Constants} from "../constants";
import { getGlobalMenus } from "../util/siyuanEnvironments/getMenu";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";
import { getSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig";
export const openBookmarkMenu = (element: HTMLElement, event: MouseEvent, bookmarkObj: Bookmark | MobileBookmarks) => {
    if (!getGlobalMenus().menu.element.classList.contains("fn__none") &&
        getGlobalMenus().menu.element.getAttribute("data-name") === Constants.MENU_BOOKMARK) {
        getGlobalMenus().menu.remove();
        return;
    }
    getGlobalMenus().menu.remove();
    const id = element.getAttribute("data-node-id");
    if (!id && !getSiyuanConfig().readonly) {
        getGlobalMenus().menu.append(new MenuItem({
            id: "rename",
            icon: "iconEdit",
            label: siyuanI18n.rename,
            click: () => {
                const oldBookmark = element.querySelector(".b3-list-item__text").textContent;
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
                btnsElement[0].addEventListener("click", () => {
                    dialog.destroy();
                });
                const inputElement = dialog.element.querySelector("input");
                dialog.bindInput(inputElement, () => {
                    (btnsElement[1] as HTMLButtonElement).click();
                });
                inputElement.value = oldBookmark;
                inputElement.focus();
                inputElement.select();
                btnsElement[1].addEventListener("click", () => {
                    fetchPost("/api/bookmark/renameBookmark", {
                        oldBookmark,
                        newBookmark: inputElement.value
                    }, () => {
                        dialog.destroy();
                    });
                });
            }
        }).element);
    }
    if (id) {
        getGlobalMenus().menu.append(new MenuItem({
            id: "copy",
            label: siyuanI18n.copy,
            type: "submenu",
            icon: "iconCopy",
            submenu: copySubMenu([element.getAttribute("data-node-id")], false)
        }).element);
    }

    if (!getSiyuanConfig().readonly) {
        getGlobalMenus().menu.append(new MenuItem({
            id: "remove",
            icon: "iconTrashcan",
            label: siyuanI18n.remove,
            click: () => {
                const bookmarkText = element.querySelector(".b3-list-item__text")?.textContent;
                confirmDialog(siyuanI18n.deleteOpConfirm, siyuanI18n.removeBookmark.replace("${x}", `<b>${escapeHtml(bookmarkText)}</b>`), () => {
                    if (id) {
                        fetchPost("/api/attr/setBlockAttrs", {id, attrs: {bookmark: ""}}, () => {
                            bookmarkObj.update();
                        });
                        document.querySelectorAll(`.protyle-wysiwyg [data-node-id="${id}"]`).forEach((item) => {
                            item.setAttribute("bookmark", "");
                            const bookmarkElement = item.querySelector(".protyle-attr--bookmark");
                            if (bookmarkElement) {
                                bookmarkElement.remove();
                            }
                        });
                    } else {
                        fetchPost("/api/bookmark/removeBookmark", {bookmark: bookmarkText});
                    }
                }, undefined, true);
            }
        }).element);
    }
    getGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_BOOKMARK);
    getGlobalMenus().menu.popup({x: event.clientX - 11, y: event.clientY + 11, h: 22, w: 12});
};
