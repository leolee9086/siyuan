import {Dialog} from "../dialog";
import {fetchPost} from "../util/network/fetch";
import {isMobile} from "../util/platform/functions";
import {Constants} from "../constants";
import {getDockByType} from "../layout/query/dockByType";
import {isTagDomain} from "../layout/dock/tag/tag.types";
import {platform} from "../platform";
import {upDownHint} from "../util/DOM/upDownHint";
import {escapeHtml} from "../util/DOM/escape";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {isNotCtrl} from "../protyle/util/compatibility";
import {electronUndo} from "../protyle/undo/keyboard/electronUndo";
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";

const getTagListItemValue = (listItemElement: HTMLElement): string => {
    if (listItemElement.dataset.type !== "new") {
        return listItemElement.textContent.trim();
    }
    const markElement = listItemElement.querySelector<HTMLElement>("mark");
    if (!markElement) {
        throw new Error("[tag.actions] New-tag list item is missing its mark element");
    }
    return markElement.textContent.trim();
};

const refreshTagModel = () => {
    if (platform === "browser-mobile") {
        const tagModel = window.siyuan.mobile?.docks?.tag;
        if (!tagModel) {
            throw new Error("[tag.actions] Mobile tag model is unavailable after rename");
        }
        tagModel.update();
        return;
    }

    const tagModel = getDockByType("tag")?.data.tag;
    if (typeof tagModel !== "object" || tagModel === null || !isTagDomain(tagModel)) {
        throw new Error("[tag.actions] Desktop tag model is unavailable after rename");
    }
    tagModel.update();
};

export const genTagList = (listElement: Element, k: string) => {
    listElement.classList.remove("fn__none");
    fetchPost("/api/search/searchTag", {
        k,
    }, (response) => {
        let searchHTML = "";
        let hasKey = false;
        response.data.tags.forEach((item: string, index: number) => {
            searchHTML += `<div class="b3-list-item${index === 0 ? " b3-list-item--focus" : ""}">
    <div class="fn__flex-1">${item}</div>
</div>`;
            if (item === `<mark>${response.data.k}</mark>`) {
                hasKey = true;
            }
        });
        if (!hasKey && response.data.k) {
            searchHTML = `<div data-type="new" class="b3-list-item${searchHTML ? "" : " b3-list-item--focus"}"><div class="fn__flex-1">${siyuanI18n.new} <mark>${escapeHtml(response.data.k)}</mark></div></div>` + searchHTML;
        }
        listElement.innerHTML = searchHTML;
    });
};

export const renameTag = (labelName: string) => {
    const dialog = new Dialog({
        title: siyuanI18n.rename,
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block">
    <div class="b3-list fn__flex-1 b3-list--background fn__none protyle-hint" style="position: absolute;width: calc(100% - 48px);">
        <img style="margin: 0 auto;display: block;width: 64px;height: 64px" src="/stage/loading-pure.svg">
    </div>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${siyuanI18n.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${siyuanI18n.confirm}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_RENAMETAG);
    const cancelButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--cancel");
    const confirmButton = dialog.element.querySelector<HTMLButtonElement>(".b3-button--text");
    const inputElement = dialog.element.querySelector<HTMLInputElement>("input");
    const listElement = dialog.element.querySelector<HTMLElement>(".b3-list--background");
    if (!cancelButton || !confirmButton || !inputElement || !listElement) {
        dialog.destroy();
        throw new Error("[tag.actions] Rename dialog template is missing required controls");
    }
    cancelButton.addEventListener("click", () => {
        dialog.destroy();
    });
    confirmButton.addEventListener("click", () => {
        fetchPost("/api/tag/renameTag", {oldLabel: labelName, newLabel: inputElement.value}, () => {
            dialog.destroy();
            refreshTagModel();
        });
    });
    inputElement.value = labelName;
    inputElement.focus();
    inputElement.select();
    inputElement.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        upDownHint(listElement, event);
        if (event.key === "Escape") {
            if (listElement.classList.contains("fn__none")) {
                dialog.destroy();
            } else {
                listElement.classList.add("fn__none");
            }
            event.preventDefault();
        } else if (!event.shiftKey && isNotCtrl(event) && event.key === "Enter") {
            if (listElement.classList.contains("fn__none")) {
                confirmButton.click();
            } else {
                const currentElement = listElement.querySelector<HTMLElement>(".b3-list-item--focus");
                if (!currentElement) {
                    event.preventDefault();
                    return;
                }
                inputElement.value = getTagListItemValue(currentElement);
                listElement.classList.add("fn__none");
            }
            event.preventDefault();
        } else {
            electronUndo(event);
        }
    });
    inputElement.addEventListener("input", (event) => {
        event.stopPropagation();
        if (event instanceof InputEvent && event.isComposing) {
            return;
        }
        genTagList(listElement, inputElement.value.trim());
    });
    inputElement.addEventListener("compositionend", () => {
        genTagList(listElement, inputElement.value.trim());
    });
    listElement.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Node)) {
            throw new Error("[tag.actions] Tag-list click event has no DOM target");
        }
        const listItemElement = hasClosestByClassName(target, "b3-list-item");
        if (!listItemElement) {
            return;
        }
        inputElement.value = getTagListItemValue(listItemElement);
        listElement.classList.add("fn__none");
    });
};
