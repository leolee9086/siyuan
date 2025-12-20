import {hasClosestBlock} from "../util/hasClosest";
import {updateTransaction} from "./transaction";
import {focusBlock} from "../util/selection";
import {Dialog} from "../../dialog";
import {Menu} from "../../plugin/Menu";
import {isMobile} from "../../util/functions";
import {Constants} from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const updateCalloutType = (titleElement: HTMLElement, protyle: IProtyle) => {
    const blockElement = hasClosestBlock(titleElement);
    if (!blockElement) {
        return;
    }
    const dialog = new Dialog({
        title: siyuanI18n.callout,
        content: `<div class="b3-dialog__content">
    <label class="fn__flex">
        <div class="fn__flex-center">
            ${siyuanI18n.type}
        </div>
        <span class="fn__space"></span>
        <div class="b3-form__icona fn__flex-1">
            <input value="${blockElement.getAttribute("data-subtype")}" type="text" class="b3-text-field fn__block b3-form__icona-input">
            <svg class="b3-form__icona-icon"><use xlink:href="#iconDown"></use></svg>
        </div>
    </label>
    <div class="fn__hr"></div>
    <label class="fn__flex">
        <div class="fn__flex-center">
            ${siyuanI18n.title}
        </div>
        <span class="fn__space"></span>
        <input class="b3-text-field fn__flex-1" type="text">
    </label>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    const btnElements = dialog.element.querySelectorAll(".b3-button");
    btnElements[0].addEventListener("click", () => {
        dialog.destroy();
    });
    btnElements[1].addEventListener("click", () => {
        const oldHTML = blockElement.outerHTML;
        blockElement.setAttribute("data-subtype", textElements[0].value.trim());
        let title = textElements[1].value.trim();
        if (title) {
            const template = document.createElement("template");
            template.innerHTML = protyle.lute.Md2BlockDOM(textElements[1].value.trim());
            title = template.content.firstElementChild.firstElementChild.innerHTML;
        }
        titleElement.innerHTML = title ||
            (textElements[0].value.trim().substring(0, 1).toUpperCase() + textElements[0].value.trim().substring(1).toLowerCase());
        if (updateIcon) {
            blockElement.querySelector(".callout-icon").textContent = updateIcon;
        }
        updateTransaction(protyle, blockElement.getAttribute("data-node-id"), blockElement.outerHTML, oldHTML);
        focusBlock(blockElement);
        dialog.destroy();
    });
    const textElements: NodeListOf<HTMLInputElement> = dialog.element.querySelectorAll(".b3-text-field");
    dialog.bindInput(textElements[1], () => {
        btnElements[1].dispatchEvent(new CustomEvent("click"));
    });
    textElements[0].addEventListener("keydown", (event) => {
        if (event.isComposing) {
            return;
        }
        if (event.key.startsWith("Arrow")) {
            dialog.element.querySelector(".b3-form__icona-icon").dispatchEvent(new CustomEvent("click"));
            textElements[0].blur();
            event.preventDefault();
            event.stopPropagation();
        }
    });
    textElements[0].focus();
    textElements[0].select();
    textElements[1].value = protyle.lute.BlockDOM2StdMd(titleElement.innerHTML);
    let updateIcon = "";
    dialog.element.querySelector(".b3-form__icona-icon").addEventListener("click", (event) => {
        const menu = new Menu(Constants.MENU_CALLOUT_SELECT, () => {
            if (document.activeElement.tagName === "BODY") {
                textElements[0].focus();
            }
        });
        if (menu.isOpen) {
            menu.close();
            return;
        }
        [{
            icon: "✏️", type: "Note", color: "var(--b3-callout-note)"
        }, {
            icon: "💡", type: "Tip", color: "var(--b3-callout-tip)"
        }, {
            icon: "❗", type: "Important", color: "var(--b3-callout-important)"
        }, {
            icon: "⚠️", type: "Warning", color: "var(--b3-callout-warning)"
        }, {
            icon: "🚨", type: "Caution", color: "var(--b3-callout-caution)"
        }].forEach((item) => {
            menu.addItem({
                iconHTML: `<span class="b3-menu__icon">${item.icon.toUpperCase()}</span>`,
                label: `<span style="color: ${item.color}">${item.type}</span>`,
                click() {
                    if (textElements[0].value.toLowerCase() === textElements[1].value.toLowerCase()) {
                        textElements[1].value = item.type;
                    }
                    textElements[0].value = item.type.toUpperCase();
                    updateIcon = item.icon;
                    textElements[1].focus();
                    textElements[1].select();
                }
            });
        });
        const inputRect = textElements[0].getBoundingClientRect();
        menu.open({
            x: inputRect.left,
            y: inputRect.bottom
        });
        event.stopPropagation();
        event.preventDefault();
    });
};
