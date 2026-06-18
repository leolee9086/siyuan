/** 用途：网络请求。使用范围：转移块引用 API。解耦评估：通过 ./imports 转发。 */
import { fetchPost } from "./imports";
/** 用途：系统常量。使用范围：DIALOG_TRANSFERBLOCKREF 等。解耦评估：通过 ./imports 转发。 */
import { Constants } from "./imports";
/** 用途：对话框类。使用范围：创建转移块引用对话框。解耦评估：通过 ./imports 转发。 */
import { Dialog } from "./imports";
/** 用途：移动端判断。使用范围：适配对话框宽度。解耦评估：通过 ./imports 转发。 */
import { isMobile } from "./imports";
/** 用途：国际化文案。使用范围：对话框按钮和提示文案。解耦评估：通过 ./imports 转发。 */
import { siyuanI18n } from "./imports";

/** 执行块引用转移 */
function onTransferConfirm(fromID: string, toID: string, dialog: Dialog) {
    fetchPost("/api/block/transferBlockRef", { fromID, toID });
    dialog.destroy();
}

/** 打开转移块引用对话框 */
export const openTransferBlockRefDialog = async (id: string) => {
    const renameDialog = new Dialog({
        title: siyuanI18n.transferBlockRef,
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" placeholder="${siyuanI18n.targetBlockID}">
    <div class="b3-label__text">${siyuanI18n.transferBlockRefTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    renameDialog.element.setAttribute("data-key", Constants.DIALOG_TRANSFERBLOCKREF);
    const inputElement = renameDialog.element.querySelector("input");
    const cancelElement = renameDialog.element.querySelector(".b3-button--cancel");
    const textButtonElement = renameDialog.element.querySelector(".b3-button--text");

    if (!inputElement) {
        return;
    }
    renameDialog.bindInput(inputElement, () => {
        // 确保按钮元素类型安全后再触发点击
        if (textButtonElement instanceof HTMLButtonElement) {
            textButtonElement.click();
        }
    });
    inputElement.focus();
    if (cancelElement) {
        cancelElement.addEventListener("click", () => {
            renameDialog.destroy();
        });
    }
    if (textButtonElement) {
        textButtonElement.addEventListener("click", () => {
            onTransferConfirm(id, inputElement.value, renameDialog);
        });
    }
};


