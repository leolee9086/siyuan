import {Constants} from "./imports";
import {unicode2Emoji} from "./imports";
import {escapeHtml} from "./imports";
import {siyuanI18n} from "./imports";
import {getSiyuanStorage} from "./imports";
import type {NotebookItem} from "./model/movePathTo.types";

/**
 * 渲染笔记本列表HTML
 */
export const 渲染笔记本列表HTML = (notebooks: NotebookItem[], flashcard: boolean): string => {
    let html = "";
    const localImages = getSiyuanStorage()[Constants.LOCAL_IMAGES];
    for (const item of notebooks) {
        // 过滤已关闭的笔记本
        if (item.closed) {
            continue;
        }
        let countHTML = "";
        // 如果开启了闪卡模式，渲染闪卡计数
        if (flashcard) {
            countHTML = `<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardNewCard}">${item.newFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardDueCard}">${item.dueFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardCard}">${item.flashcardCount}</span>`;
        }
        html += `<ul class="b3-list b3-list--background">
<li class="b3-list-item${html === "" ? " b3-list-item--focus" : ""}" data-path="/" data-box="${item.id}">
    <span class="b3-list-item__toggle b3-list-item__toggle--hl">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${unicode2Emoji(item.icon || localImages.note, "b3-list-item__graphic", true)}
    <span class="b3-list-item__text">${escapeHtml(item.name)}</span>
    ${countHTML}
</li></ul>`;
    }
    return html;
};
