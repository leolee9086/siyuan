import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { setStorageVal } from "../protyle/util/compatibility";
import { isMobile } from "../util/functions";
const genEditDialogHtml = () => {

    return `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" placeholder="${window.siyuan.languages.memo}">
    <div class="fn__hr"></div>
    <textarea class="b3-text-field fn__block" placeholder="${window.siyuan.languages.aiCustomAction}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--remove">${window.siyuan.languages.delete}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`
}
// 取消按钮回调函数
const handleCancelClick = (dialog: Dialog) => {
    dialog.destroy();
};

// 确认按钮回调函数
const handleConfirmClick = (
    dialog: Dialog,
    nameElement: HTMLInputElement,
    customElement: HTMLTextAreaElement,
    originalName: string,
    originalMemo: string
) => {
    window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
        name: string;
        memo: string;
    }) => {
        if (originalName === subItem.name && originalMemo === subItem.memo) {
            subItem.name = nameElement.value;
            subItem.memo = customElement.value;
            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
            return true;
        }
    });
    dialog.destroy();
};

// 删除按钮回调函数
const handleDeleteClick = (
    dialog: Dialog,
    originalName: string,
    originalMemo: string
) => {
    window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
        name: string;
        memo: string;
    }, index: number) => {
        if (originalName === subItem.name && originalMemo === subItem.memo) {
            window.siyuan.storage[Constants.LOCAL_AI].splice(index, 1);
            setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
            return true;
        }
    });
    dialog.destroy();
};

export const editDialog = (customName: string, customMemo: string) => {
    const dialog = new Dialog({
        title: window.siyuan.languages.update,
        content: genEditDialogHtml(),
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_AIUPDATECUSTOMACTION);
    const nameElement = dialog.element.querySelector("input") as HTMLInputElement;
    const customElement = dialog.element.querySelector("textarea") as HTMLTextAreaElement;
    const deleteButton = dialog.element.querySelector(".b3-button--remove") as HTMLButtonElement;
    const cancelButton = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
    const confirmButton = dialog.element.querySelector(".b3-button--text") as HTMLButtonElement;

    nameElement.value = customName;
    dialog.bindInput(customElement, () => {
        if (confirmButton instanceof HTMLButtonElement) {
            confirmButton.click();
        }
    });
    customElement.value = customMemo;

    cancelButton.addEventListener("click", () => {
        handleCancelClick(dialog);
    });

    confirmButton.addEventListener("click", () => {
        handleConfirmClick(dialog, nameElement, customElement, customName, customMemo);
    });

    deleteButton.addEventListener("click", () => {
        handleDeleteClick(dialog, customName, customMemo);
    });
    nameElement.focus();
};
