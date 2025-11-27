import * as dayjs from "dayjs";
import { focusByRange, fetchPost } from "../ai/imports";
import { Constants } from "../constants";
import { Dialog } from "../dialog";
import { showMessage } from "../dialog/message";
import { getEditorRange } from "../protyle/util/selection";
import { isMobile } from "../util/functions";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n";

/**
 * @todo btnsElement[1]等应该具有明确的变量名
 * @param nodeElement 
 */
export const openWechatNotify = (nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const range = getEditorRange(nodeElement);
    const reminder = nodeElement.getAttribute(Constants.CUSTOM_REMINDER_WECHAT);
    let reminderFormat = "";
    if (reminder) {
        reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
    }
    const dialog = new Dialog({
        width: isMobile() ? "92vw" : "50vw",
        title: siyuanI18n.wechatReminder,
        content:/*html */ `<div class="b3-dialog__content custom-attr">
    <div class="fn__flex">
        <span class="ft__on-surface fn__flex-center" style="text-align: right;white-space: nowrap;width: 100px">${siyuanI18n.notifyTime}</span>
        <div class="fn__space"></div>
        <input class="b3-text-field fn__flex-1" type="datetime-local" max="9999-12-31 23:59" value="${reminderFormat}">
    </div>
    <div class="b3-label__text" style="text-align: center">${siyuanI18n.wechatTip}</div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.remove}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        destroyCallback() {
            focusByRange(range);
        }
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_WECHATREMINDER);
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const cancelButton = btnsElement[0] as HTMLButtonElement;
    const removeButton = btnsElement[1] as HTMLButtonElement;
    const confirmButton = btnsElement[2] as HTMLButtonElement;
    
    cancelButton.addEventListener("click", () => {
        dialog.destroy();
    });
    
    removeButton.addEventListener("click", () => {
        if (removeButton.getAttribute("disabled")) {
            return;
        }
        removeButton.setAttribute("disabled", "disabled");
        fetchPost("/api/block/setBlockReminder", { id, timed: "0" }, () => {
            nodeElement.removeAttribute(Constants.CUSTOM_REMINDER_WECHAT);
            dialog.destroy();
        });
    });
    
    confirmButton.addEventListener("click", () => {
        const dateInput = dialog.element.querySelector("input") as HTMLInputElement;
        if (!dateInput) {
            showMessage(siyuanI18n.notEmpty);
            return;
        }
        
        const date = dateInput.value;
        if (date) {
            if (new Date(date) <= new Date()) {
                showMessage(siyuanI18n.reminderTip);
                return;
            }
            if (confirmButton.getAttribute("disabled")) {
                return;
            }
            confirmButton.setAttribute("disabled", "disabled");
            const timed = dayjs(date).format("YYYYMMDDHHmmss");
            fetchPost("/api/block/setBlockReminder", { id, timed }, () => {
                nodeElement.setAttribute(Constants.CUSTOM_REMINDER_WECHAT, timed);
                dialog.destroy();
            });
        } else {
            showMessage(siyuanI18n.notEmpty);
        }
    });
};
