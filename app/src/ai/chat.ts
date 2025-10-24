import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { handleAIChatConfirm } from "./chat.confirm";

export const AIChat = (protyle: IProtyle, element: Element) => {
    const dialog = new Dialog({
        title: "✨ " + window.siyuan.languages.aiWriting,
        content: `<div class="b3-dialog__content"><textarea class="b3-text-field fn__block"></textarea></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    const inputElement = dialog.element.querySelector("textarea");
    const btnsElement = dialog.element.querySelectorAll(".b3-button");

    dialog.bindInput(inputElement, () => {
        (btnsElement[1] as HTMLButtonElement).click();
    });
    inputElement.focus();
    btnsElement[0].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => handleAIChatConfirm(inputElement, dialog, protyle, element));
};


