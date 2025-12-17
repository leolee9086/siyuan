import { Constants } from "../../constants";
import { unicode2Emoji } from "../../emoji";
import { escapeHtml } from "../escape";

interface NotebookItem {
    id: string;
    name: string;
    icon: string;
    closed: boolean;
    newFlashcardCount?: number;
    dueFlashcardCount?: number;
    flashcardCount?: number;
}

/**
 * 渲染笔记本列表HTML
 */
export const 渲染笔记本列表HTML = (notebooks: NotebookItem[], flashcard: boolean): string => {
    let html = "";
    for (const item of notebooks) {
        if (item.closed) {
            continue;
        }
        let countHTML = "";
        if (flashcard) {
            countHTML = `<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardNewCard}">${item.newFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardDueCard}">${item.dueFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardCard}">${item.flashcardCount}</span>`;
        }
        html += `<ul class="b3-list b3-list--background">
<li class="b3-list-item${html === "" ? " b3-list-item--focus" : ""}" data-path="/" data-box="${item.id}">
    <span class="b3-list-item__toggle b3-list-item__toggle--hl">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${unicode2Emoji(item.icon || window.siyuan.storage[Constants.LOCAL_IMAGES].note, "b3-list-item__graphic", true)}
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    ${countHTML}
</li></ul>`;
    }
    return html;
};
