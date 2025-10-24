import { fetchPost } from "../util/fetch";
import { focusByRange } from "../protyle/util/selection";
import { Dialog } from "../dialog";
import { isMobile } from "../util/functions";
import { Constants } from "../constants";
import { setStorageVal } from "../protyle/util/compatibility";
import { escapeAriaLabel, escapeAttr, escapeHtml } from "../util/escape";
import { showMessage } from "../dialog/message";
import { Menu } from "../plugin/Menu";
import { upDownHint } from "../util/upDownHint";
import { getElementsBlockId } from "../util/DOM/blockLikeElements";
import { switchFnNoneByFlag } from "../util/DOM/fnClasses";
import { fillContent } from "./actions.fillContent";
import { AIMenuContext, AIMenuRequest, handleAIMenuItemClick } from "./actions.handleAIMenuItemClick";

export const customDialog = (protyle: IProtyle, ids: string[], elements: Element[]) => {
    const dialog = new Dialog({
        title: window.siyuan.languages.aiCustomAction,
        content: `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="" placeholder="${window.siyuan.languages.memo}">
    <div class="fn__hr"></div>
    <textarea class="b3-text-field fn__block" placeholder="${window.siyuan.languages.aiCustomAction}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.use}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${window.siyuan.languages.save}</button>
</div>`,
        width: isMobile() ? "92vw" : "520px",
    });
    dialog.element.setAttribute("data-key", Constants.DIALOG_AICUSTOMACTION);
    const nameElement = dialog.element.querySelector("input");
    const customElement = dialog.element.querySelector("textarea");
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    dialog.bindInput(customElement, () => {
        (btnsElement[1] as HTMLButtonElement).click();
    });
    btnsElement[0].addEventListener("click", () => {
        dialog.destroy();
    });
    btnsElement[1].addEventListener("click", () => {
        if (!customElement.value) {
            showMessage(window.siyuan.languages["_kernel"][142]);
            return;
        }
        fetchPost("/api/ai/chatGPTWithAction", {
            ids,
            action: customElement.value,
        }, (response) => {
            dialog.destroy();
            fillContent(protyle, response.data, elements);
        });
    });
    btnsElement[2].addEventListener("click", () => {
        if (!nameElement.value && !customElement.value) {
            showMessage(window.siyuan.languages["_kernel"][142]);
            return;
        }
        window.siyuan.storage[Constants.LOCAL_AI].push({
            name: nameElement.value,
            memo: customElement.value
        });
        setStorageVal(Constants.LOCAL_AI, window.siyuan.storage[Constants.LOCAL_AI]);
        dialog.destroy();
    });
    nameElement.focus();
};

const filterAI = (element: HTMLElement, inputElement: HTMLInputElement) => {
    element.querySelectorAll(".b3-list-item").forEach(item => {
        const hasText = item.textContent.indexOf(inputElement.value) > -1;
        switchFnNoneByFlag(item, !hasText);
    });
    element.querySelectorAll(".b3-menu__separator").forEach(item => {
        switchFnNoneByFlag(item, !!inputElement.value);
    });
    element.querySelector(".b3-list-item--focus").classList.remove("b3-list-item--focus");
    element.querySelector(".b3-list-item:not(.fn__none)").classList.add("b3-list-item--focus");
};
export const AIActions = (elements: Element[], protyle: IProtyle) => {
    window.siyuan.menus.menu.remove();
    const ids = getElementsBlockId(elements)
    const menu = new Menu("ai", () => {
        focusByRange(protyle.toolbar.range);
    });
    let customHTML = "";
    window.siyuan.storage[Constants.LOCAL_AI].forEach((item: { name: string, memo: string }, index: number) => {
        customHTML += `<div data-action="${escapeAttr(item.memo || item.name)}" data-index="${index}" class="b3-list-item b3-list-item--narrow ariaLabel" aria-label="${escapeAriaLabel(item.memo)}">
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    <span data-type="edit" class="b3-list-item__action"><svg><use xlink:href="#iconEdit"></use></svg></span>
</div>`;
    });
    if (customHTML) {
        customHTML = `<div class="b3-menu__separator"></div>${customHTML}`;
    }
    const clearContext = "Clear context";
    menu.addItem({
        iconHTML: "",
        type: "empty",
        label: `<div class="fn__flex-column b3-menu__filter">
    <input class="b3-text-field fn__flex-shrink" placeholder="${window.siyuan.languages.ai}"/>
    <div class="fn__hr"></div>
    <div class="b3-list fn__flex-1 b3-list--background">
       <div class="b3-list-item b3-list-item--narrow b3-list-item--focus" data-action="Continue writing">
            ${window.siyuan.languages.aiContinueWrite}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiExtractSummary}">
            ${window.siyuan.languages.aiExtractSummary}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiBrainStorm}">
            ${window.siyuan.languages.aiBrainStorm}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${window.siyuan.languages.aiFixGrammarSpell}">
            ${window.siyuan.languages.aiFixGrammarSpell}
        </div>
        <div class="b3-list-item b3-list-item--narrow" data-action="${clearContext}">
            ${window.siyuan.languages.clearContext}
        </div>
        <div class="b3-menu__separator"></div>
        <div class="b3-list-item b3-list-item--narrow" data-type="custom">
            ${window.siyuan.languages.aiCustomAction}
        </div>
        ${customHTML}
    </div>
</div>`,
        bind(element) {
            /// #if MOBILE
            element.setAttribute("style", "height: 100%;padding: 0 16px;");
            element.querySelectorAll(".b3-menu__separator").forEach(item => {
                item.remove();
            });
            /// #endif
            const listElement = element.querySelector(".b3-list");
            const inputElement = element.querySelector("input");
            inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
                if (event.isComposing) {
                    return;
                }
                const currentElement = upDownHint(listElement, event);
                if (currentElement) {
                    event.stopPropagation();
                }
                if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    const currentElement = listElement.querySelector(".b3-list-item--focus") as HTMLElement;
                    if (currentElement.dataset.type === "custom") {
                        customDialog(protyle, ids, elements);
                        menu.close();
                    } else {
                        fetchPost("/api/ai/chatGPTWithAction", {
                            ids,
                            action: currentElement.dataset.action
                        }, (response) => {
                            fillContent(protyle, response.data, elements);
                        });
                        if (currentElement.dataset.action === clearContext) {
                            showMessage(window.siyuan.languages.clearContextSucc);
                        } else {
                            menu.close();
                        }
                    }
                }
            });
            inputElement.addEventListener("compositionend", () => {
                filterAI(element, inputElement);
            });
            inputElement.addEventListener("input", (event: KeyboardEvent) => {
                if (event.isComposing) {
                    return;
                }
                filterAI(element, inputElement);
            });
            element.addEventListener("click", (event) => {
                const target = event.target;
                if (target instanceof HTMLElement) {
                    const context: AIMenuContext = {
                        protyle,
                        ids,
                        elements: elements,
                        menu,
                        clearContext
                    };
                    const request: AIMenuRequest = {
                        target,
                        element,
                        event
                    };

                    handleAIMenuItemClick(context, request);
                }
            });
        }
    });
    menu.element.querySelector(".b3-menu__items").setAttribute("style", "overflow: initial");
    /// #if MOBILE
    menu.fullscreen();
    /// #else
    const rect = elements[elements.length - 1].getBoundingClientRect();
    menu.open({
        x: rect.left,
        y: rect.bottom,
        h: rect.height,
    });
    menu.element.querySelector("input").focus();
    /// #endif
};
