import { Constants } from "../../constants";
import { getIconByType } from "../../editor/getIcon";
import { unicode2Emoji } from "../../emoji";
import type {ProtyleDomain} from "../../protyle/protyle.types";
import { escapeAriaLabel, escapeLessThans, escapeHtml } from "../../util/DOM/escape";
import { getNotebookName, getDisplayName, getNotebookIcon } from "../../util/file/pathName";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getAttr, getArticle } from "../util";


export const onSearch = (data: IBlock[], edit: ProtyleDomain, element: Element, config: Config.IUILayoutTabSearchConfig,
    focusId?: {
        currentId?: string;
        newId?: string;
    }) => {
    let resultHTML = "";
    let currentData;
    let newData;
    data.forEach((item) => {
        const title = getNotebookName(item.box) + getDisplayName(item.hPath, false);
        let countHTML = "";
        if (item.children) {
            resultHTML += `<div class="b3-list-item">
<span class="b3-list-item__toggle b3-list-item__toggle--hl">
    <svg class="b3-list-item__arrow b3-list-item__arrow--open"><use xlink:href="#iconRight"></use></svg>
</span>
${unicode2Emoji(getNotebookIcon(item.box) || window.siyuan.storage[Constants.LOCAL_IMAGES].note, "b3-list-item__graphic", true)}
<span class="b3-list-item__text ariaLabel" style="color: var(--b3-theme-on-surface)" aria-label="${escapeAriaLabel(title)}">${escapeLessThans(title)}</span>
</div><div>`;
            item.children.forEach((childItem) => {
                if (focusId) {
                    if (childItem.id === focusId.currentId) {
                        currentData = childItem;
                    }
                    if (childItem.id === focusId.newId) {
                        newData = childItem;
                    }
                }
                if (childItem.refCount) {
                    countHTML = `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.ref}">${childItem.refCount}</span>`;
                }
                resultHTML += `<div style="padding-left: 36px" data-type="search-item" class="b3-list-item" data-node-id="${childItem.id}" data-root-id="${childItem.rootID}">
<svg class="b3-list-item__graphic popover__block" data-id="${childItem.id}"><use xlink:href="#${getIconByType(childItem.type)}"></use></svg>
${unicode2Emoji(childItem.ial.icon, "b3-list-item__graphic", true)}
<span class="b3-list-item__text">${childItem.content}</span>
${getAttr(childItem)}
${childItem.tag ? `<span class="b3-list-item__meta b3-list-item__meta--ellipsis">${childItem.tag.replace(/#/g, "")}</span>` : ""}
${countHTML}
</div>`;
            });
            resultHTML += "</div>";
        } else {
            if (focusId) {
                if (item.id === focusId.currentId) {
                    currentData = item;
                }
                if (item.id === focusId.newId) {
                    newData = item;
                }
            }
            if (item.refCount) {
                countHTML = `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.ref}">${item.refCount}</span>`;
            }
            resultHTML += `<div data-type="search-item" class="b3-list-item" data-node-id="${item.id}" data-root-id="${item.rootID}">
<svg class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type)}"></use></svg>
${unicode2Emoji(item.ial.icon, "b3-list-item__graphic", true)}
<span class="b3-list-item__text">${item.content}</span>
${getAttr(item)}
${item.tag ? `<span class="b3-list-item__meta b3-list-item__meta--ellipsis">${item.tag.replace(/#/g, "")}</span>` : ""}
<span class="b3-list-item__meta b3-list-item__meta--ellipsis ariaLabel" aria-label="${escapeAriaLabel(title)}">${escapeLessThans(title)}</span>
${countHTML}
</div>`;
        }
    });
    if (!currentData) {
        currentData = newData;
    }
    if (!currentData && data.length > 0) {
        if (data[0].children) {
            currentData = data[0].children[0];
        } else {
            currentData = data[0];
        }
    }
    if (currentData) {
        edit.protyle.element.classList.remove("fn__none");
        element.querySelector(".search__drag").classList.remove("fn__none");
        getArticle({
            edit,
            id: currentData.id,
            config,
            value: (element.querySelector("#searchInput") as HTMLInputElement).value,
        });
    } else {
        edit.protyle.element.classList.add("fn__none");
        element.querySelector(".search__drag").classList.add("fn__none");
    }
    element.querySelector("#searchList").innerHTML = resultHTML || (
        config.method === 0 ? `<div class="b3-list-item b3-list-item--focus" data-type="search-new">
    <svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg>
    <span class="b3-list-item__text">
        ${siyuanI18n.newFile} <mark>${escapeHtml((element.querySelector("#searchInput") as HTMLInputElement).value)}</mark>
    </span>
    <kbd class="b3-list-item__meta">${siyuanI18n.enterNew}</kbd>
</div>
<div class="search__empty">
    ${siyuanI18n.enterNewTip}
</div>` : `<div class="b3-list-item b3-list-item--focus" data-type="search-new">
    <span class="b3-list-item__text">
        ${siyuanI18n.emptyContent}
    </span>
</div>`);
    if (currentData) {
        const currentList = element.querySelector(`[data-node-id="${currentData.id}"]`) as HTMLElement;
        if (currentList) {
            currentList.classList.add("b3-list-item--focus");
            if (!currentList.previousElementSibling && currentList.parentElement.previousElementSibling) {
                currentList.parentElement.previousElementSibling.scrollIntoView();
            } else {
                currentList.scrollIntoView();
            }
        }
    }
};
