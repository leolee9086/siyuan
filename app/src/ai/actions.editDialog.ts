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
export const editDialog = (customName: string, customMemo: string) => {
    const dialog = new Dialog({
        title: window.siyuan.languages.update,
        content: genEditDialogHtml(),
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_AIUPDATECUSTOMACTION);
    const nameElement = dialog.element.querySelector("input");
    nameElement.value = customName;
    const customElement = dialog.element.querySelector("textarea");
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    dialog.bindInput(customElement, () => {
        (btnsElement[2] as HTMLButtonElement).click();
    });
    customElement.value = customMemo;
    btnsElement[1].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[2].addEventListener("click", () => {
        window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
            name: string;
            memo: string;
        }) => {
            if (customName === subItem.name && customMemo === subItem.memo) {
                subItem.name = nameElement.value;
                subItem.memo = customElement.value;
                setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
                return true;
            }
        });
        dialog.destroy();
    });
    btnsElement[0].addEventListener("click", () => {
        window.siyuan.storage[Constants.LOCAL_AI].find((subItem: {
            name: string;
            memo: string;
        }, index: number) => {
            if (customName === subItem.name && customMemo === subItem.memo) {
                window.siyuan.storage[Constants.LOCAL_AI].splice(index, 1);
                setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
                return true;
            }
        });
        dialog.destroy();
    });
    nameElement.focus();
};
