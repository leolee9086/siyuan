import {Constants} from "./imports";
import {unicode2Emoji} from "./imports";
import {escapeHtml} from "./imports";
import {fetchPost} from "./imports";
import {siyuanI18n} from "./imports";
import {getSiyuanStorage} from "./imports";
import type {SearchResultItem} from "./model/movePathTo.types";

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
        // 如果正在进行中文等输入法的组合输入（如拼音未上屏），则不触发搜索
        if (event && event.isComposing) {
            return;
        }
        /**
         * 当输入框内容为空（或仅包含空白字符）时，恢复显示默认的树状导航，并隐藏搜索结果列表。
         * 生效场景：用户清空了搜索输入框的内容，例如通过退格键删除所有字符或使用全选删除。
         */
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
        }, (response) => {
            渲染搜索结果列表(searchListElement, response, options.flashcard);
        });
    };
}

/**
 * 渲染搜索结果列表到指定的 DOM 容器中。
 *
 * - 作用：根据搜索响应数据生成 HTML 结构，包括文件图标、路径和（可选的）抽认卡计数，并填充到列表中。
 * - 意图：将抽象的搜索数据可视化，供用户选择目标路径。
 * - 调用时机：在用户输入触发的文件树搜索请求（/api/filetree/searchDocs）成功回调中被调用。
 * - 问题/改进：通过 innerHTML 全量更新，大数据量下可能有性能压力；依赖 escapeHtml 确保安全性。
 *
 * @param searchListElement 显示结果的容器元素
 * @param response 包含搜索结果数据的响应对象
 * @param flashcard 是否显示抽认卡复习数据
 */
function 渲染搜索结果列表(searchListElement: HTMLElement, response: { data?: SearchResultItem[] }, flashcard: boolean) {
    let fileHTML = "";
    const siyuanStorage = getSiyuanStorage();
    const localImages = siyuanStorage?.[Constants.LOCAL_IMAGES];
    const defaultNoteIcon = localImages?.note;
    for (const item of response.data || []) {
        let countHTML = "";
        // 如果开启了抽认卡模式，显示新卡、待复习卡和总卡数的统计信息
        if (flashcard) {
            countHTML = `<span class="fn__flex-1"></span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardNewCard}">${item.newFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardDueCard}">${item.dueFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardCard}">${item.flashcardCount}</span>`;
        }
        fileHTML += `<li class="b3-list-item${fileHTML === "" ? " b3-list-item--focus" : ""}" data-path="${item.path}" data-box="${item.box}">
    ${unicode2Emoji(item.boxIcon || defaultNoteIcon, "b3-list-item__graphic", true)}
    <span class="b3-list-item__showall" style="padding: 4px 0">${escapeHtml(item.hPath)}</span>
    ${countHTML}
</li>`;
    }
    searchListElement.innerHTML = fileHTML;
}
