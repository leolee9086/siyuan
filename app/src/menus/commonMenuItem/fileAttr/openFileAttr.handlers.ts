import {Constants, Dialog, isHTMLInputElement, isHTMLElement} from "./imports";
import type {ProtyleDomain} from "./imports";
import {showMessage} from "./imports";
import {renderAVAttribute} from "./imports";
import {escapeHtml} from "./imports";
import {isMobile, isValidCustomAttrName} from "./imports";
import {siyuanI18n} from "./imports";
import {fetchPost} from "./imports";
import {MenuItem} from "./imports";
import {bindAttrInput} from "./bindAttrInput";


export const handleTabSwitch = (target: HTMLElement, dialog: Dialog, attrs: IObject, protyle?: IProtyle, ghostProtyle?: ProtyleDomain) => {
    target.parentElement?.querySelector(".item--focus")?.classList.remove("item--focus");
    target.classList.add("item--focus");
    for (const item of dialog.element.querySelectorAll(".custom-attr")) {
        if (!isHTMLElement(item)) {
            continue;
        }
        const selected = item.dataset.type === target.dataset.type;
        item.classList.toggle("fn__none", !selected);
        if (!selected || item.dataset.type !== "NodeAttributeView" || item.innerHTML !== "" || !attrs.id) {
            continue;
        }
        const currentProtyle = protyle || ghostProtyle?.protyle;
        if (currentProtyle) {
            renderAVAttribute(item, attrs.id, currentProtyle);
        }
    }
};

export const handleRemoveAction = (target: HTMLElement, attrs: IObject, event: Event) => {
    fetchPost("/api/attr/setBlockAttrs", {
        id: attrs.id,
        attrs: { ["custom-" + target.previousElementSibling?.textContent]: "" }
    });
    target.parentElement?.parentElement?.remove();
    event.stopPropagation();
    event.preventDefault();
};

export const handleBookmarkAction = (target: HTMLElement, event: MouseEvent) => {
    fetchPost("/api/attr/getBookmarkLabels", {}, (response) => {
        window.siyuan.menus?.menu?.remove();
        if (response.data.length === 0) {
            window.siyuan.menus?.menu?.append(new MenuItem({
                id: "emptyContent",
                iconHTML: "",
                label: siyuanI18n.emptyContent,
                type: "readonly",
            }).element);
        }
        for (const item of response.data) {
            window.siyuan.menus?.menu?.append(new MenuItem({
                label: item,
                click() {
                    const bookmarkInputElement = target.parentElement?.parentElement?.querySelector("input");
                    if (!isHTMLInputElement(bookmarkInputElement)) {
                        return;
                    }
                    bookmarkInputElement.value = item;
                    bookmarkInputElement.dispatchEvent(new CustomEvent("change"));
                }
            }).element);
        }
        window.siyuan.menus?.menu?.element?.classList.add("b3-menu--list");
        window.siyuan.menus?.menu?.popup({ x: event.clientX, y: event.clientY + 16, w: 16 });
    });
    event.stopPropagation();
    event.preventDefault();
};

const insertCustomAttribute = (target: HTMLElement, attrs: IObject, value: string, addDialog: Dialog) => {
    target.parentElement?.insertAdjacentHTML("beforebegin", `<div class="b3-label b3-label--noborder">
    <div class="fn__flex">
        <span class="fn__flex-1">${value}</span>
        <span data-action="remove" class="block__icon block__icon--show"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__hr"></div>
    <textarea style="resize: vertical" spellcheck="false" data-name="custom-${value}" class="b3-text-field fn__block" rows="1" placeholder="${siyuanI18n.attrValue1}"></textarea>
</div>`);
    const newInputElement = target.parentElement?.previousElementSibling?.querySelector(".b3-text-field");
    if (!isHTMLInputElement(newInputElement)) {
        return;
    }
    newInputElement.focus();
    if (attrs.id) {
        bindAttrInput(newInputElement, attrs.id);
    }
    addDialog.destroy();
};

const submitCustomAttribute = (target: HTMLElement, dialog: Dialog, attrs: IObject, inputElement: HTMLInputElement, addDialog: Dialog) => {
    if (!isValidCustomAttrName(inputElement.value)) {
        showMessage(siyuanI18n.attrName + " <b>" + escapeHtml(inputElement.value) + "</b> " + siyuanI18n.invalid);
        return;
    }
    const value = inputElement.value;
    const existingLabel = Array.from(dialog.element.querySelectorAll('.custom-attr[data-type="custom"] .b3-label .fn__flex-1')).find((labelItem) => {
        return isHTMLElement(labelItem) && labelItem.textContent === value;
    });
    if (existingLabel) {
        showMessage(window.siyuan.languages?.hasAttrName.replace("${x}", value));
        return;
    }
    insertCustomAttribute(target, attrs, value, addDialog);
};

export const handleAddCustomAction = (target: HTMLElement, dialog: Dialog, attrs: IObject, event: MouseEvent) => {
    const addDialog = new Dialog({
        title: siyuanI18n.attrName,
        content: `<div class="b3-dialog__content"><input spellcheck="false" class="b3-text-field fn__block" value=""></div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    addDialog.element.setAttribute("data-key", Constants.DIALOG_SETCUSTOMATTR);
    const inputElement = addDialog.element.querySelector("input");
    if (!isHTMLInputElement(inputElement)) {
        addDialog.destroy();
        return;
    }
    const btnsElement = addDialog.element.querySelectorAll(".b3-button");
    addDialog.bindInput(inputElement, () => {
        if (isHTMLElement(btnsElement[1])) {
            btnsElement[1].click();
        }
    });
    inputElement.focus();
    inputElement.select();
    if (btnsElement[0]) {
        btnsElement[0].addEventListener("click", () => {
            addDialog.destroy();
        });
    }
    if (btnsElement[1]) {
        btnsElement[1].addEventListener("click", () => {
            submitCustomAttribute(target, dialog, attrs, inputElement, addDialog);
        });
    }
    event.stopPropagation();
    event.preventDefault();
};
