import { fetchPost } from "../ai/imports";
import { Constants } from "../constants";
import { Dialog } from ".";
import { isMobile } from "../util/platform/functions";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

export const openTransferBlockRefDialog = (id: string) => {
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

    if (inputElement) {
        renameDialog.bindInput(inputElement, () => {
            if (textButtonElement instanceof HTMLButtonElement) {
                textButtonElement.click();
            }
        });
        inputElement.focus();
        cancelElement && cancelElement.addEventListener("click", () => {
            renameDialog.destroy();
        });
        textButtonElement && textButtonElement.addEventListener("click", () => {
            fetchPost("/api/block/transferBlockRef", {
                fromID: id,
                toID: inputElement.value,
            });
            renameDialog.destroy();
        });
    }
};
