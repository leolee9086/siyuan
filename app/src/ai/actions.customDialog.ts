import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { showMessage } from "../dialog/message";
import { setStorageVal } from "../protyle/util/compatibility";
import { fetchPost } from "../util/fetch";
import { isMobile } from "../util/functions";
import { fillContent } from "./actions.fillContent";

const genCustomDialogHtml = () => {
    return `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="" placeholder="${window.siyuan.languages.memo}">
    <div class="fn__hr"></div>
    <textarea class="b3-text-field fn__block" placeholder="${window.siyuan.languages.aiCustomAction}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.use}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.save}</button>
</div>`;
};

// 取消按钮回调函数
const handleCancelClick = (dialog: Dialog) => {
    dialog.destroy();
};

// 使用按钮回调函数
const handleUseClick = (
    dialog: Dialog,
    protyle: IProtyle,
    ids: string[],
    elements: Element[],
    customElement: HTMLTextAreaElement
) => {
    if (!customElement.value) {
        showMessage(window.siyuan.languages["_kernel"][142]);
        return;
    }
    fetchPost("/api/ai/chatGPTWithAction", {
        ids,
        action: customElement.value,
    }, (response) => {
        dialog.destroy();
        fillContent(protyle, response.data, elements);
    });
};

// 保存按钮回调函数
const handleSaveClick = (
    dialog: Dialog,
    nameElement: HTMLInputElement,
    customElement: HTMLTextAreaElement
) => {
    if (!nameElement.value && !customElement.value) {
        showMessage(window.siyuan.languages["_kernel"][142]);
        return;
    }
    window.siyuan.storage[Constants.LOCAL_AI].push({
        name: nameElement.value,
        memo: customElement.value
    });
    setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
    dialog.destroy();
};

export const customDialog = (protyle: IProtyle, ids: string[], elements: Element[]) => {
    const dialog = new Dialog({
        title: window.siyuan.languages.aiCustomAction,
        content: genCustomDialogHtml(),
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_AICUSTOMACTION);
    
    const nameElement = dialog.element.querySelector("input") as HTMLInputElement;
    const customElement = dialog.element.querySelector("textarea") as HTMLTextAreaElement;
    const cancelButton = dialog.element.querySelector(".b3-button--cancel") as HTMLButtonElement;
    const useButton = dialog.element.querySelectorAll(".b3-button--text")[0] as HTMLButtonElement;
    const saveButton = dialog.element.querySelectorAll(".b3-button--text")[1] as HTMLButtonElement;
    
    dialog.bindInput(customElement, () => {
        if (useButton instanceof HTMLButtonElement) {
            useButton.click();
        }
    });

    cancelButton.addEventListener("click", () => {
        handleCancelClick(dialog);
    });

    useButton.addEventListener("click", () => {
        handleUseClick(dialog, protyle, ids, elements, customElement);
    });

    saveButton.addEventListener("click", () => {
        handleSaveClick(dialog, nameElement, customElement);
    });
    
    nameElement.focus();
};
