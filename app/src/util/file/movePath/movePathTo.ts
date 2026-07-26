import {focusByRange} from "./imports";
import {Constants} from "./imports";
import {Dialog} from "./imports";
import {escapeHtml} from "./imports";
import {fetchPost} from "./imports";
import {isMobile} from "./imports";
import {platform} from "./imports";
import {setNoteBook} from "./imports";
import { 创建对话框标题HTML, 创建对话框内容HTML } from "./movePathTo.template";
import { 渲染笔记本列表HTML } from "./movePathTo.notebook";
import { 绑定事件监听器 } from "./movePathTo.bindEvents";
import type {MovePathToOptions} from "./model/movePathTo.types";
import {getSiyuanDialogs} from "./imports";
import {getSiyuanStorage} from "./imports";


/**
 * 检查并关闭已存在的移动路径对话框
 * @returns true 如果存在对话框（已关闭），false 如果不存在
 */
const 检查并关闭现有对话框 = (): boolean => {
    // 如果在 dialogs 列表中找到了包含 #foldList 元素的对话框（即移动路径对话框），则将其视为已存在并销毁。
    // 这是为了避免重复打开多个移动/复制对话框。
    const existingDialog = getSiyuanDialogs().find((item) => {
        // 通过检查 #foldList 元素是否存在来判定当前遍历到的对话框是否为移动路径对话框
        if (item.element.querySelector("#foldList")) {
            item.destroy();
            return true;
        }
    });
    return !!existingDialog;
};

/**
 * 更新对话框标题以显示路径摘要
 * 当操作涉及多个路径时，此函数从后端获取路径的可读形式并显示在对话框标题中。
 */
const 更新对话框标题以显示路径 = (dialogElement: HTMLElement, paths: string[]) => {
    fetchPost("/api/filetree/getHPathsByPaths", { paths }, (response) => {
        const smallerElement = dialogElement.querySelector(".b3-dialog__header .ft__smaller");
        if (smallerElement) {
            smallerElement.innerHTML = escapeHtml(response.data.join(" "));
        }
    });
};

/**
 * 打开移动路径/复制路径的对话框
 * 该函数负责创建一个新的 Dialog 实例，初始化其内容，并绑定相关事件。
 * 
 * @param options - 配置选项，包含回调函数、初始路径、标题等
 */
export const movePathTo = (options: MovePathToOptions) => {
    if (检查并关闭现有对话框()) {
        return;
    }
    const dialog = new Dialog({
        title: 创建对话框标题HTML(options.title),
        content: 创建对话框内容HTML(),
        width: isMobile() ? "92vw" : "50vw",
        height: isMobile() ? "80vh" : "70vh",
        /**
         * 对话框销毁时的回调函数
         * 用于在对话框关闭后恢复编辑器光标位置（如果之前有传入 range）
         */
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
    // 如果传入了 paths，说明是针对特定路径（如批量操作）进行移动/复制。
    // 此时需要调用后端接口获取这些路径的可读形式（hPaths）显示在标题旁。
    if (options.paths && options.paths.length > 0) {
        更新对话框标题以显示路径(dialog.element, options.paths);
    }
    const searchListElement = dialog.element.querySelector<HTMLElement>("#foldList");
    const searchTreeElement = dialog.element.querySelector<HTMLElement>("#foldTree");
    if (!searchListElement || !searchTreeElement) {
        return;
    }
    setNoteBook((notebooks) => {
        searchTreeElement.innerHTML = 渲染笔记本列表HTML(notebooks, options.flashcard);
    }, options.flashcard);

    const inputElement = dialog.element.querySelector<HTMLInputElement>(".b3-text-field");
    if (!inputElement) {
        return;
    }
    const localMovePath = getSiyuanStorage()[Constants.LOCAL_MOVE_PATH];
    inputElement.value = localMovePath?.k || "";
    if (platform !== "browser-mobile") {
        inputElement.select();
    }

    绑定事件监听器({
        inputElement,
        searchListElement,
        searchTreeElement,
        options,
        dialog
    });
};

