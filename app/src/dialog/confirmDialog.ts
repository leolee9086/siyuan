import { isMobile } from "../util/functions";
import { Dialog } from "./index";
import { Constants } from "../constants";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";

const createDialogClickHandler = (
    dialog: Dialog,
    confirm?: (dialog?: Dialog) => void,
    cancel?: (dialog: Dialog) => void
) => (event: MouseEvent) => {
    if (!(event.target instanceof HTMLElement)) {
        return;
    }
    let target: HTMLElement = event.target;
    const isDispatch = typeof event.detail === "string";
    while (target && target !== dialog.element || isDispatch) {
        if (target.id === "cancelDialogConfirmBtn" || (isDispatch && event.detail === "Escape")) {
            cancel?.(dialog);
            dialog.destroy();
            break;
        }
        if (target.id === "confirmDialogConfirmBtn" || (isDispatch && event.detail === "Enter")) {
            confirm?.(dialog);
            dialog.destroy();
            break;
        }
        if (!target.parentElement) {
            break;
        }
        target = target.parentElement;
    }
};

export const confirmDialog = (title: string, text: string,
    confirm?: (dialog?: Dialog) => void,
    cancel?: (dialog: Dialog) => void,
    isDelete = false) => {
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
