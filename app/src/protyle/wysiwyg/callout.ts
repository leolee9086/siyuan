import { hasClosestBlock } from "../util/hasClosest";
import { updateTransaction } from "./transaction";
import { focusBlock } from "../util/selection";
import { Dialog } from "../../dialog";
import { Menu } from "../../plugin/Menu";
import { isMobile } from "../../util/functions";
import { Constants } from "../../constants";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const updateCalloutType = (titleElement: HTMLElement, protyle: IProtyle) => {
    const blockElement = hasClosestBlock(titleElement);
    if (!blockElement) {
        return;
    }
    const dialog = new Dialog({
        title: siyuanI18n.callout,
        content: getCalloutDialogHTML(blockElement.getAttribute("data-subtype") || ""),
        width: isMobile() ? "92vw" : "520px",
    });
    const btnElements = dialog.element.querySelectorAll(".b3-button");
    const textElements: NodeListOf<HTMLInputElement> = dialog.element.querySelectorAll(".b3-text-field");
    const cancelBtn = btnElements[0];
    const confirmBtn = btnElements[1];
    const inputElement = textElements[0];
    const titleInputElement = textElements[1];

    if (!cancelBtn || !confirmBtn || !inputElement || !titleInputElement || !protyle.lute) {
        return;
    }

    let updateIcon = "";

    const iconElement = dialog.element.querySelector(".b3-form__icona-icon");

    cancelBtn.addEventListener("click", () => {
        dialog.destroy();
    });
    confirmBtn.addEventListener("click", () => {
        confirmCalloutUpdate(protyle, blockElement, titleElement, textElements, updateIcon);
        dialog.destroy();
    });
    dialog.bindInput(titleInputElement, () => {
        confirmBtn.dispatchEvent(new CustomEvent("click"));
    });
    bindTypeInput(textElements, dialog);

    inputElement.focus();
    inputElement.select();
    titleInputElement.value = protyle.lute.BlockDOM2StdMd(titleElement.innerHTML);

    if (iconElement) {
        iconElement.addEventListener("click", (event) => {
            showCalloutTypeMenu(event, textElements, (icon) => {
                updateIcon = icon;
            });
        });
    }
};

const getCalloutDialogHTML = (subtype: string) => {
    return `<div class="b3-dialog__content">
    <label class="fn__flex">
        <div class="fn__flex-center">
            ${siyuanI18n.type}
        </div>
        <span class="fn__space"></span>
        <div class="b3-form__icona fn__flex-1">
            <input value="${subtype}" type="text" class="b3-text-field fn__block b3-form__icona-input">
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
</div>`;
};

const formatCalloutTitle = (protyle: IProtyle, title: string) => {
    if (!protyle.lute) {
        return title;
    }
    const template = document.createElement("template");
    template.innerHTML = protyle.lute.Md2BlockDOM(title);
    const firstChild = template.content.firstElementChild;
    if (firstChild?.firstElementChild) {
        return firstChild.firstElementChild.innerHTML;
    }
    return title;
};

const confirmCalloutUpdate = (
    protyle: IProtyle,
    blockElement: Element,
    titleElement: HTMLElement,
    textElements: NodeListOf<HTMLInputElement>,
    updateIcon: string
) => {
    const inputElement = textElements[0];
    const titleInputElement = textElements[1];

    if (!inputElement || !titleInputElement || !protyle.lute) {
        return;
    }

    const oldHTML = blockElement.outerHTML;
    blockElement.setAttribute("data-subtype", inputElement.value.trim());
    let title = titleInputElement.value.trim();
    if (title) {
        title = formatCalloutTitle(protyle, title);
    }
    titleElement.innerHTML = title ||
        (inputElement.value.trim().substring(0, 1).toUpperCase() + inputElement.value.trim().substring(1).toLowerCase());
    const iconContainer = blockElement.querySelector(".callout-icon");
    if (updateIcon && iconContainer) {
        iconContainer.textContent = updateIcon;
    }
    updateTransaction(protyle, blockElement.getAttribute("data-node-id") || "", blockElement.outerHTML, oldHTML);
    focusBlock(blockElement);
};

const handleTypeInputKeydown = (event: KeyboardEvent, textElements: NodeListOf<HTMLInputElement>, dialog: Dialog) => {
    if (event.isComposing) {
        return;
    }
    if (event.key.startsWith("Arrow")) {
        const iconElement = dialog.element.querySelector(".b3-form__icona-icon");
        iconElement?.dispatchEvent(new CustomEvent("click"));
        const inputElement = textElements[0];
        inputElement?.blur();
        event.preventDefault();
        event.stopPropagation();
    }
};

const bindTypeInput = (textElements: NodeListOf<HTMLInputElement>, dialog: Dialog) => {
    const inputElement = textElements[0];
    if (inputElement) {
        inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
            handleTypeInputKeydown(event, textElements, dialog);
        });
    }
};

const showCalloutTypeMenu = (event: Event, textElements: NodeListOf<HTMLInputElement>, setUpdateIcon: (icon: string) => void) => {
    const inputElement = textElements[0];
    const titleElement = textElements[1];
    if (!inputElement || !titleElement) {
        return;
    }
    const menu = new Menu(Constants.MENU_CALLOUT_SELECT, () => {
        if (document.activeElement?.tagName === "BODY") {
            inputElement.focus();
        }
    });
    if (menu.isOpen) {
        menu.close();
        return;
    }
    const items = [{
        icon: "✏️", type: "Note", color: "var(--b3-callout-note)"
    }, {
        icon: "💡", type: "Tip", color: "var(--b3-callout-tip)"
    }, {
        icon: "❗", type: "Important", color: "var(--b3-callout-important)"
    }, {
        icon: "⚠️", type: "Warning", color: "var(--b3-callout-warning)"
    }, {
        icon: "🚨", type: "Caution", color: "var(--b3-callout-caution)"
    }];
    for (const item of items) {
        menu.addItem({
            iconHTML: `<span class="b3-menu__icon">${item.icon.toUpperCase()}</span>`,
            label: `<span style="color: ${item.color}">${item.type}</span>`,
            click() {
                if (inputElement.value.toLowerCase() === titleElement.value.toLowerCase()) {
                    titleElement.value = item.type;
                }
                inputElement.value = item.type.toUpperCase();
                setUpdateIcon(item.icon);
                titleElement.focus();
                titleElement.select();
            }
        });
    }
    const inputRect = inputElement.getBoundingClientRect();
    menu.open({
        x: inputRect.left,
        y: inputRect.bottom
    });
    event.stopPropagation();
    event.preventDefault();
};


