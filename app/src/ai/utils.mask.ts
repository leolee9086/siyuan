import { Dialog } from "../dialog";

/**
 * 为对话框设置背景色
 * @param dialog 对话框实例
 * @param color 背景颜色
 */
export const setDialogContainerColor = (dialog: Dialog, color: string): void => {
    // 获取对话框容器元素
    const dialogContainer = dialog.element.querySelector(".b3-dialog__container");
    if (dialogContainer instanceof HTMLElement) {
        dialogContainer.style.backgroundColor = color;
        dialogContainer.style.opacity = "0.95"; // 设置轻微透明度，保持可读性
    }
};

/**
 * 移除遮罩元素
 * @param maskElement 要移除的遮罩元素
 */
export const removeBlockMask = (maskElement: HTMLElement): void => {
    if (maskElement && maskElement.parentNode) {
        maskElement.parentNode.removeChild(maskElement);
    }
};