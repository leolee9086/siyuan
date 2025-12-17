import { focusByRange } from "../../ai/imports";
import { Constants } from "../../constants";
import { Dialog } from "../../dialog";
import { escapeHtml } from "../escape";
import { fetchPost } from "../fetch";
import { isMobile } from "../functions";
import { setNoteBook } from "../pathName";
import { 创建对话框标题HTML, 创建对话框内容HTML } from "./movePathTo.template";
import { 渲染笔记本列表HTML } from "./movePathTo.notebook";
import { 绑定事件监听器, MovePathToOptions } from "./movePathTo.bindEvents";


/**
 * 检查并关闭已存在的移动路径对话框
 * @returns true 如果存在对话框（已关闭），false 如果不存在
 */
const 检查并关闭现有对话框 = (): boolean => {
    const existingDialog = window.siyuan.dialogs.find((item) => {
        if (item.element.querySelector("#foldList")) {
            item.destroy();
            return true;
        }
    });
    return !!existingDialog;
};

export const movePathTo = (options: MovePathToOptions) => {
    if (检查并关闭现有对话框()) {
        return;
    }
    const dialog = new Dialog({
        title: 创建对话框标题HTML(options.title),
        content: 创建对话框内容HTML(),
        width: isMobile() ? "92vw" : "50vw",
        height: isMobile() ? "80vh" : "70vh",
        destroyCallback() {
            if (options.range) {
                focusByRange(options.range);
            }
        }
    });
    const headerElement = dialog.element.querySelector(".b3-dialog__header");
    if (headerElement) {
        headerElement.setAttribute("style", "padding:0");
    }
    dialog.element.setAttribute("data-key", Constants.DIALOG_MOVEPATHTO);
    if (options.paths && options.paths.length > 0) {
        fetchPost("/api/filetree/getHPathsByPaths", { paths: options.paths }, (response) => {
            const smallerElement = dialog.element.querySelector(".b3-dialog__header .ft__smaller");
            if (smallerElement) {
                smallerElement.innerHTML = escapeHtml(response.data.join(" "));
            }
        });
    }
    const searchListElement = dialog.element.querySelector("#foldList") as HTMLElement;
    const searchTreeElement = dialog.element.querySelector("#foldTree") as HTMLElement;
    setNoteBook((notebooks) => {
        searchTreeElement.innerHTML = 渲染笔记本列表HTML(notebooks, options.flashcard);
    }, options.flashcard);

    const inputElement = dialog.element.querySelector(".b3-text-field") as HTMLInputElement;
    inputElement.value = window.siyuan.storage[Constants.LOCAL_MOVE_PATH].k;
    /// #if !MOBILE
    inputElement.select();
    /// #endif

    绑定事件监听器({
        inputElement,
        searchListElement,
        searchTreeElement,
        options,
        dialog
    });
};

