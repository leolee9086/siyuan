/**
 * 代码语言选择功能
 * 从 Toolbar 类中拆分出来以减少文件大小
 */
import { Constants } from "../../constants";
import { getEditorRange, focusByRange, getSelectionPosition } from "../util/selection";
import { hasClosestBlock, hasClosestByClassName } from "../util/hasClosest";
import { hideElements } from "../ui/hideElements";
import { isMobile } from "../../platform";
import { setPosition } from "../../util/DOM/positioning/setPosition";
import { upDownHint } from "../../util/DOM/upDownHint";
import { escapeHtml } from "../../util/DOM/escape";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 显示代码语言选择面板
 */
export function 显示代码语言选择(
    protyle: IProtyle,
    languageElements: HTMLElement[],
    subElement: HTMLElement,
    toolbarElement: HTMLElement,
    setRange: (range: Range) => void,
    updateLanguage: (languageElements: HTMLElement[], protyle: IProtyle, selectedLang: string | null) => void
): void {
    const nodeElement = hasClosestBlock(languageElements[0]);
    if (!nodeElement) {
        return;
    }
    hideElements(["hint"], protyle);
    window.siyuan.menus?.menu.remove();
    const range = getEditorRange(nodeElement);
    setRange(range);

    subElement.style.width = "";
    subElement.style.padding = "";
    subElement.innerHTML = `<div data-id="codeLanguage" class="fn__flex-column" style="max-height:50vh">
    <input placeholder="${siyuanI18n.search}" style="margin: 0 8px 4px 8px" class="b3-text-field"/>
    <div class="b3-list fn__flex-1 b3-list--background" style="position: relative"></div>
</div>`;
    const listElement = subElement.lastElementChild?.lastElementChild as HTMLElement;
    if (!listElement) {
        return;
    }

    let html = `<div data-id="clearLanguage" class="b3-list-item">${siyuanI18n.clear}</div>`;
    let hljsLanguages = Constants.ALIAS_CODE_LANGUAGES.concat(window.hljs?.listLanguages() ?? []).sort();

    const eventDetail = { languages: hljsLanguages, type: "init", listElement };
    if (protyle.app && protyle.app.plugins) {
        for (const plugin of protyle.app.plugins) {
            plugin.eventBus.emit("code-language-update", eventDetail);
        }
    }

    hljsLanguages = eventDetail.languages;
    for (const item of hljsLanguages) {
        html += `<div data-id="${item}" class="b3-list-item">${item}</div>`;
    }

    listElement.innerHTML = html;
    const nextSibling = listElement.firstElementChild?.nextElementSibling;
    if (nextSibling) {
        nextSibling.classList.add("b3-list-item--focus");
    }

    const inputElement = subElement.querySelector("input");
    if (!inputElement) {
        return;
    }

    const 高亮匹配文本 = (text: string, search: string): string => {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escapedSearch, "gi");
        return text.replace(regex, match => `<b>${match}</b>`);
    };

    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) {
            return;
        }
        upDownHint(listElement, event);
        if (event.key === "Enter") {
            const focusedItem = subElement.querySelector(".b3-list-item--focus");
            updateLanguage(languageElements, protyle, focusedItem?.textContent ?? null);
            event.preventDefault();
            return;
        }
        if (event.key === "Escape") {
            subElement.classList.add("fn__none");
            focusByRange(range);
        }
    });

    inputElement.addEventListener("input", (event) => {
        const value = inputElement.value.trim();
        let matchLanguages: string[];
        let innerHtml = `<div data-id="clearLanguage" class="b3-list-item">${siyuanI18n.clear}</div>`;
        let isMatchLanguages = false;

        if (value) {
            const lowerCaseValue = value.toLowerCase();
            matchLanguages = hljsLanguages.filter(
                item => item.toLowerCase().includes(lowerCaseValue)
            ).sort((a, b) => {
                const aStartsWith = a.toLowerCase().startsWith(lowerCaseValue);
                const bStartsWith = b.toLowerCase().startsWith(lowerCaseValue);
                if (aStartsWith && bStartsWith) {
                    return a.length - b.length;
                }
                if (aStartsWith) {
                    return -1;
                }
                if (bStartsWith) {
                    return 1;
                }
                return 0;
            });
            if (window.hljs?.getLanguage(value)) {
                matchLanguages = [value].concat(matchLanguages.filter(item => item !== value));
            }
        } else {
            matchLanguages = hljsLanguages;
        }

        const pluginEventDetail = { languages: matchLanguages, type: "match", value, listElement };
        if (protyle.app && protyle.app.plugins) {
            for (const plugin of protyle.app.plugins) {
                plugin.eventBus.emit("code-language-update", pluginEventDetail);
            }
        }

        matchLanguages = pluginEventDetail.languages;
        if (value) {
            for (const item of matchLanguages) {
                if (value === item) {
                    isMatchLanguages = true;
                    innerHtml += `<div data-id="${item}" class="b3-list-item"><b>${item}</b></div>`;
                } else {
                    innerHtml += `<div data-id="${item}" class="b3-list-item">${高亮匹配文本(item, value)}</div>`;
                }
            }
        } else {
            for (const item of matchLanguages) {
                innerHtml += `<div data-id="${item}" class="b3-list-item">${item}</div>`;
            }
        }
        if (value && !isMatchLanguages) {
            innerHtml += `<div data-id="customLanguage" class="b3-list-item"><b>${escapeHtml(value.replace(/`| /g, "_"))}</b></div>`;
        }
        listElement.innerHTML = innerHtml;
        const focusNextSibling = listElement.firstElementChild?.nextElementSibling;
        if (focusNextSibling) {
            focusNextSibling.classList.add("b3-list-item--focus");
        }
        event.stopPropagation();
    });

    listElement.addEventListener("click", (event) => {
        const target = event.target as HTMLElement;
        const clickedListItem = hasClosestByClassName(target, "b3-list-item");
        if (!clickedListItem) {
            return;
        }
        updateLanguage(languageElements, protyle, clickedListItem.textContent);
    });

    subElement.style.zIndex = (++window.siyuan.zIndex).toString();
    subElement.classList.remove("fn__none");
    if (!isMobile) {
        const nodeRect = languageElements[0].getBoundingClientRect();
        setPosition(subElement, nodeRect.left, nodeRect.bottom, nodeRect.height);
    }
    if (isMobile) {
        setPosition(subElement, 0, 0);
    }
    toolbarElement.classList.add("fn__none");
    inputElement.select();
}
