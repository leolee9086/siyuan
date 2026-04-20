import { isMobile } from "../util/platform/functions";
import { Dialog } from "./index";
import { Constants } from "../constants";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 创建对话框点击事件处理器。
 *
 * 作用：生成处理确认对话框点击及快捷键事件的闭包函数。
 * 意图：统一管理“确认”和“取消”操作的触发逻辑，并将对话框实例及回调函数封装，便于事件监听引用。
 * 调用时机：在 `confirmDialog` 初始化时，绑定到对话框元素的 `click` 事件。
 *
 * @param {Dialog} dialog - 对话框实例。
 * @param {(dialog?: Dialog) => void} [confirm] - 用户点击确认或按下 Enter 后的回调。
 * @param {(dialog: Dialog) => void} [cancel] - 用户点击取消或按下 Escape 后的回调。
 * @returns {(event: MouseEvent) => void} 返回事件处理函数。
 */
const createDialogClickHandler = (
    dialog: Dialog,
    confirm?: (dialog?: Dialog) => void,
    cancel?: (dialog: Dialog) => void
) => (event: MouseEvent) => {
    const isDispatch = typeof event.detail === "string";
    if (isDispatch && event.detail === "Escape") {
        cancel?.(dialog);
        dialog.destroy();
        return;
    }
    if (isDispatch && event.detail === "Enter") {
        confirm?.(dialog);
        dialog.destroy();
        return;
    }

    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    let target: HTMLElement | null = event.target;
    while (target && target !== dialog.element) {
        if (target.id === "cancelDialogConfirmBtn") {
            cancel?.(dialog);
            dialog.destroy();
            break;
        }
        if (target.id === "confirmDialogConfirmBtn") {
            confirm?.(dialog);
            dialog.destroy();
            break;
        }
        target = target.parentElement;
    }
};

/**
 * 弹出确认对话框。
 *
 * 作用：显示一个带有标题、消息文本以及确认和取消按钮的交互式对话框。
 * 意图：简化常用的用户确认流程，支持普通确认和破坏性确认（如删除）的视觉区分。
 * 调用时机：在任何需要执行前置确认的任务中调用，如删除文档、重置设置等。
 * @同步豁免:UI构建 该函数直接创建并显示对话框，且回调函数由调用者提供，符合预期的同步交互模式，无需额外的异步处理。
 * @param {string} title - 对话框显示的标题。
 * @param {string} text - 对话框显示的正文内容（支持 HTML 字串）。
 * @param {(dialog?: Dialog) => void} [confirm] - 点击确定按钮或按下 Enter 键的回调。
 * @param {(dialog: Dialog) => void} [cancel] - 点击取消按钮、按下 Escape 或关闭对话框的回调。
 * @param {boolean} [isDelete=false] - 是否标记为“删除”操作，为 true 时确定按钮会呈现红色（危险动作标识）。
 */
export const confirmDialog = (
    title: string,
    text: string,
    confirm?: (dialog?: Dialog) => void,
    cancel?: (dialog: Dialog) => void,
    isDelete = false
) => {
    if (!text && !title && confirm) {
        confirm();
        return;
    }
    const dialog = new Dialog({
        title,
        content: /*html */`<div class="b3-dialog__content">
    <div class="ft__breakword">${text}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel" id="cancelDialogConfirmBtn">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button ${isDelete ? "b3-button--remove" : "b3-button--text"}" id="confirmDialogConfirmBtn">${siyuanI18n[isDelete ? "delete" : "confirm"]}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });

    dialog.element.addEventListener("click", createDialogClickHandler(dialog, confirm, cancel));
    dialog.element.setAttribute("data-key", Constants.DIALOG_CONFIRM);
};
