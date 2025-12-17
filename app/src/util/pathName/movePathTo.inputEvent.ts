import { Constants } from "../../constants";
import { unicode2Emoji } from "../../emoji";
import { escapeHtml } from "../escape";
import { fetchPost } from "../fetch";

/**
 * 创建搜索输入事件处理函数
 */
export function 创建搜索输入处理器(
    inputElement: HTMLInputElement,
    searchListElement: HTMLElement,
    searchTreeElement: HTMLElement,
    options: {
        flashcard: boolean;
        rootIDs?: string[];
    }
) {
    return (event?: InputEvent) => {
        if (event && event.isComposing) {
            return;
        }
        if (inputElement.value.trim() === "") {
            searchListElement.classList.add("fn__none");
            searchTreeElement.classList.remove("fn__none");
            return;
        }
        searchTreeElement.classList.add("fn__none");
        searchListElement.classList.remove("fn__none");
        searchListElement.scrollTo(0, 0);
        fetchPost("/api/filetree/searchDocs", {
            k: inputElement.value,
            flashcard: options.flashcard,
            excludeIDs: options.rootIDs,
        }, (data) => {
            let fileHTML = "";
            for (const item of data.data as Array<{
                boxIcon: string;
                box: string;
                hPath: string;
                path: string;
                newFlashcardCount: string;
                dueFlashcardCount: string;
                flashcardCount: string;
            }>) {
                let countHTML = "";
                if (options.flashcard) {
                    countHTML = `<span class="fn__flex-1"></span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardNewCard}">${item.newFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardDueCard}">${item.dueFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${window.siyuan.languages.flashcardCard}">${item.flashcardCount}</span>`;
                }
                fileHTML += `<li class="b3-list-item${fileHTML === "" ? " b3-list-item--focus" : ""}" data-path="${item.path}" data-box="${item.box}">
    ${unicode2Emoji(item.boxIcon || window.siyuan.storage[Constants.LOCAL_IMAGES].note, "b3-list-item__graphic", true)}
    <span class="b3-list-item__showall" style="padding: 4px 0">${escapeHtml(item.hPath)}</span>
    ${countHTML}
</li>`;
            }
            searchListElement.innerHTML = fileHTML;
        });
    };
}
