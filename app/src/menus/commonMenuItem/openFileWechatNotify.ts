import * as dayjs from "dayjs";
import {fetchPost} from "./imports";
import { Constants } from "../../constants";
import { Dialog } from "../../dialog";
import { showMessage } from "../../dialog/message";
import { isMobile } from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";


export const openFileWechatNotify = (protyle: IProtyle) => {
    fetchPost("/api/block/getDocInfo", {
        id: protyle.block.rootID
    }, (response) => {
        const reminder = response.data.ial[Constants.CUSTOM_REMINDER_WECHAT];
        let reminderFormat = "";
        if (reminder) {
            reminderFormat = dayjs(reminder).format("YYYY-MM-DD HH:mm");
        }
        const dialog = new Dialog({
            width: isMobile() ? "92vw" : "50vw",
            title: siyuanI18n.wechatReminder,
            content: /*html */`<div class="b3-dialog__content custom-attr">
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
</div>`
        });
        dialog.element.setAttribute("data-key", Constants.DIALOG_WECHATREMINDER);
        const btnsElement = dialog.element.querySelectorAll(".b3-button");
        btnsElement[0].addEventListener("click", () => {
            dialog.destroy();
        });
        btnsElement[1].addEventListener("click", () => {
            fetchPost("/api/block/setBlockReminder", { id: protyle.block.rootID, timed: "0" }, () => {
                dialog.destroy();
            });
        });
        btnsElement[2].addEventListener("click", () => {
            const date = dialog.element.querySelector("input").value;
            if (date) {
                if (new Date(date) <= new Date()) {
                    showMessage(siyuanI18n.reminderTip);
                    return;
                }
                fetchPost("/api/block/setBlockReminder", {
                    id: protyle.block.rootID,
                    timed: dayjs(date).format("YYYYMMDDHHmmss")
                }, () => {
                    dialog.destroy();
                });
            } else {
                showMessage(siyuanI18n.notEmpty);
            }
        });
    });
};
