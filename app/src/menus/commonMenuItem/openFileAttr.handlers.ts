import { Constants } from "../../constants";
import { Dialog } from "../../dialog";
import { showMessage } from "../../dialog/message";
import { Protyle } from "../../protyle";
import { renderAVAttribute } from "../../protyle/render/av/blockAttr";
import { escapeHtml } from "../../util/DOM/escape";
import { isMobile, isValidCustomAttrName } from "../../util/platform/functions";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { bindAttrInput } from "./util.bindAttrInput";
import { MenuItem } from "../Menu.Item";
import {fetchPost} from "./imports";


export const handleTabSwitch = (target: HTMLElement, dialog: Dialog, attrs: IObject, protyle?: IProtyle, ghostProtyle?: Protyle) => {
    target.parentElement?.querySelector(".item--focus")?.classList.remove("item--focus");
    target.classList.add("item--focus");
    dialog.element.querySelectorAll(".custom-attr").forEach((item) => {
        const htmlItem = item as HTMLElement;
        if (htmlItem.dataset.type === target.dataset.type) {
            if (htmlItem.dataset.type === "NodeAttributeView" && htmlItem.innerHTML === "" && attrs.id) {
                const currentProtyle = protyle || ghostProtyle?.protyle;
                if (currentProtyle) {
                    renderAVAttribute(htmlItem, attrs.id, currentProtyle);
                }
            }
            htmlItem.classList.remove("fn__none");
        } else {
            htmlItem.classList.add("fn__none");
        }
    });
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
        } else {
            response.data.forEach((item: string) => {
                window.siyuan.menus?.menu?.append(new MenuItem({
                    label: item,
                    click() {
                        const bookmarkInputElement = target.parentElement?.parentElement?.querySelector("input") as HTMLInputElement;
                        bookmarkInputElement.value = item;
                        bookmarkInputElement.dispatchEvent(new CustomEvent("change"));
                    }
                }).element);
            });
        }
        window.siyuan.menus?.menu?.element?.classList.add("b3-menu--list");
        window.siyuan.menus?.menu?.popup({ x: event.clientX, y: event.clientY + 16, w: 16 });
    });
    event.stopPropagation();
    event.preventDefault();
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
    const inputElement = addDialog.element.querySelector("input") as HTMLInputElement;
    const btnsElement = addDialog.element.querySelectorAll(".b3-button");
    addDialog.bindInput(inputElement, () => {
        (btnsElement[1] as HTMLButtonElement).click();
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
            if (!isValidCustomAttrName(inputElement.value)) {
                showMessage(siyuanI18n.attrName + " <b>" + escapeHtml(inputElement.value) + "</b> " + siyuanI18n.invalid);
                return false;
            }
            let existElement: HTMLElement | false = false;
            const value = inputElement.value;
            Array.from(dialog.element.querySelectorAll('.custom-attr[data-type="custom"] .b3-label .fn__flex-1')).find((labelItem) => {
                if ((labelItem as HTMLElement).textContent === value) {
                    existElement = (labelItem as HTMLElement).closest(".b3-label") as HTMLElement;
                    return true;
                }
            });
            if (existElement) {
                showMessage(window.siyuan.languages?.hasAttrName.replace("${x}", value));
            } else {
                target.parentElement?.insertAdjacentHTML("beforebegin", `<div class="b3-label b3-label--noborder">
    <div class="fn__flex">
        <span class="fn__flex-1">${value}</span>
        <span data-action="remove" class="block__icon block__icon--show"><svg><use xlink:href="#iconMin"></use></svg></span>
    </div>
    <div class="fn__hr"></div>
    <textarea style="resize: vertical" spellcheck="false" data-name="custom-${inputElement.value}" class="b3-text-field fn__block" rows="1" placeholder="${siyuanI18n.attrValue1}"></textarea>
</div>`);
                const newInputElement = target.parentElement?.previousElementSibling?.querySelector(".b3-text-field") as HTMLInputElement;
                newInputElement.focus();
                if (newInputElement && attrs.id) {
                    bindAttrInput(newInputElement, attrs.id);
                }
                addDialog.destroy();
            }
        });
    }
    event.stopPropagation();
    event.preventDefault();
};
