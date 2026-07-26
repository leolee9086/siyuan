import * as dayjs from "dayjs";
import {focusByRange} from "./imports";
import {fetchPost} from "./imports";
import { Constants } from "../../constants";
import { Dialog } from "../../dialog";
import { showMessage } from "../../dialog/message";
import { getEditorRange } from "../../protyle/util/selection";
import { isMobile } from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 格式化提醒日期
 * @param reminder 提醒时间字符串
 * @returns 格式化后的日期字符串 (YYYY-MM-DD HH:mm)
 */
const formatReminderDate = (reminder: string | null): string => {
    if (!reminder) {
        return "";
    }
    return dayjs(reminder).format("YYYY-MM-DD HH:mm");
};

/**
 * 创建微信提醒对话框
 * @param reminderFormat 格式化后的提醒时间
 * @param range 编辑器范围
 * @returns Dialog 实例
 */
const createWechatNotifyDialog = (reminderFormat: string, range: Range) => {
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
    return dialog;
};


/**
 * 处理删除按钮点击事件
 * @param dialog Dialog 实例
 * @param removeButton 删除按钮元素
 * @param id 节点ID
 * @param nodeElement 节点元素
 */
const handleRemoveButtonClick = (dialog: Dialog, removeButton: HTMLButtonElement, id: string | null, nodeElement: Element) => {
    if (removeButton.getAttribute("disabled") || !id) {
        return;
    }
    removeButton.setAttribute("disabled", "disabled");
    fetchPost("/api/block/setBlockReminder", { id, timed: "0" }, () => {
        nodeElement.removeAttribute(Constants.CUSTOM_REMINDER_WECHAT);
        dialog.destroy();
    });
};

/**
 * 验证日期输入
 * @param dateInput 日期输入元素
 * @returns 验证结果和错误信息
 */
const validateDateInput = (dateInput: HTMLInputElement | null): { isValid: boolean; errorMessage?: string } => {
    if (!dateInput) {
        return { isValid: false, errorMessage: siyuanI18n.notEmpty };
    }

    const date = dateInput.value;
    if (!date) {
        return { isValid: false, errorMessage: siyuanI18n.notEmpty };
    }

    if (new Date(date) <= new Date()) {
        return { isValid: false, errorMessage: siyuanI18n.reminderTip };
    }

    return { isValid: true };
};

/**
 * 处理确认按钮点击事件
 * @param dialog Dialog 实例
 * @param confirmButton 确认按钮元素
 * @param id 节点ID
 * @param nodeElement 节点元素
 */
const handleConfirmButtonClick = (dialog: Dialog, confirmButton: HTMLButtonElement, id: string | null, nodeElement: Element) => {
    const dateInput = dialog.element.querySelector("input") as HTMLInputElement;
    const validation = validateDateInput(dateInput);

    if (!validation.isValid) {
        showMessage(validation.errorMessage || siyuanI18n.notEmpty);
        return;
    }

    if (confirmButton.getAttribute("disabled") || !id) {
        return;
    }

    confirmButton.setAttribute("disabled", "disabled");
    const timed = dayjs(dateInput.value).format("YYYYMMDDHHmmss");
    fetchPost("/api/block/setBlockReminder", { id, timed }, () => {
        nodeElement.setAttribute(Constants.CUSTOM_REMINDER_WECHAT, timed);
        dialog.destroy();
    });
};

/**
 * 打开微信提醒对话框
 * @param nodeElement 节点元素
 */
export const openWechatNotify = (nodeElement: Element) => {
    const id = nodeElement.getAttribute("data-node-id");
    const range = getEditorRange(nodeElement);
    const reminder = nodeElement.getAttribute(Constants.CUSTOM_REMINDER_WECHAT);
    const reminderFormat = formatReminderDate(reminder);
    const dialog = createWechatNotifyDialog(reminderFormat, range);
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    const cancelButton = btnsElement[0] as HTMLButtonElement;
    const removeButton = btnsElement[1] as HTMLButtonElement;
    const confirmButton = btnsElement[2] as HTMLButtonElement;

    cancelButton.addEventListener("click", () => {
        dialog.destroy();
    });

    removeButton.addEventListener("click", () => {
        handleRemoveButtonClick(dialog, removeButton, id, nodeElement);
    });

    confirmButton.addEventListener("click", () => {
        handleConfirmButtonClick(dialog, confirmButton, id, nodeElement);
    });
};
