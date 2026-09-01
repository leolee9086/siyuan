import { getSiyuanStorage } from "../siyuanEnvironments/getSiyuanConfig.environment";
import { siyuanI18n } from "../siyuanEnvironments/i18n.getI18n.environment";
import { unicode2Emoji } from "../../emoji/emoji.render";
import { Constants } from "../../constants";
import { getDocDisplayName } from "./path/operations";
import { escapeAriaLabel } from "../DOM/escape";

/**
 * 生成文件项的计数HTML
 * @param item 文件项
 * @param flashcard 是否为闪卡模式
 * @returns 计数HTML字符串
 */
export const generateCountHTML = (item: IFile, flashcard: boolean): string => {
    if (flashcard) {
        return `<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardNewCard}">${item.newFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardDueCard}">${item.dueFlashcardCount}</span>
<span class="counter counter--right b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.flashcardCard}">${item.flashcardCount}</span>`;
    }

    if (item.count && item.count > 0) {
        return `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.ref}">${item.count}</span>`;
    }

    return "";
};

/**
 * 生成文件项的aria-label内容
 * @param item 文件项
 * @returns aria-label内容数组
 */
const generateAriaLabelParts = (item: IFile): string[] => {
    const displayName = getDocDisplayName(item.name, item.titleEmpty, true);
    // @内联数组 - 数组元素依赖运行时参数 item，无法提取为静态顶层常量
    return [
        `${displayName} <small class='ft__on-surface'>${item.hSize}</small>`,
        item.bookmark ? `<br>${siyuanI18n.bookmark} ${escapeAriaLabel(item.bookmark)}` : "",
        item.name1 ? `<br>${siyuanI18n.name} ${escapeAriaLabel(item.name1)}` : "",
        item.alias ? `<br>${siyuanI18n.alias} ${escapeAriaLabel(item.alias)}` : "",
        item.memo ? `<br>${siyuanI18n.memo} ${escapeAriaLabel(item.memo)}` : "",
        item.subFileCount !== 0 ? siyuanI18n.includeSubFile.replace("x", item.subFileCount.toString()) : "",
        `<br>${siyuanI18n.modifiedAt} ${item.hMtime}`,
        `<br>${siyuanI18n.createdAt} ${item.hCtime}`
    ];
};

/**
 * 生成文件项的HTML
 * @param item 文件项
 * @param notebookId 笔记本ID
 * @param flashcard 是否为闪卡模式
 * @returns 文件项HTML字符串
 */
const generateFileItemHTMLBase = (item: IFile, notebookId: string, flashcard: boolean): string => {
    const storage = getSiyuanStorage();
    const localImages = storage[Constants.LOCAL_IMAGES];
    const iconPath = item.icon || (item.subFileCount === 0 ? localImages.file : localImages.folder);

    const displayName = getDocDisplayName(item.name, item.titleEmpty, true);
    const ariaLabelParts = generateAriaLabelParts(item);
    const countHTML = generateCountHTML(item, flashcard);

    return `<li data-box="${notebookId}" class="b3-list-item" data-path="${item.path}">
    <span style="padding-left: ${item.path.split("/").length * 8}px" class="b3-list-item__toggle b3-list-item__toggle--hl${item.subFileCount === 0 ? " fn__hidden" : ""}">
        <svg class="b3-list-item__arrow"><use xlink:href="#iconRight"></use></svg>
    </span>
    ${unicode2Emoji(iconPath, "b3-list-item__graphic", true)}
    <span class="b3-list-item__text ariaLabel" data-position="parentE" aria-label="${ariaLabelParts.join("")}">${displayName}</span>
    ${countHTML}
</li>`;
};

/**
 * 生成文件项的HTML
 * @param item 文件项
 * @param notebookId 笔记本ID
 * @returns 文件项HTML字符串
 */
export const generateFileItemHTML = (item: IFile, notebookId: string): string => {
    return generateFileItemHTMLBase(item, notebookId, false);
};

/**
 * 生成闪卡文件项的HTML
 * @AIDONE 已创建 no-trivial-wrapper 规则来禁止只有一行的包装函数，规则建议使用柯里化或在调用处直接使用原函数
 * @param item 文件项
 * @param notebookId 笔记本ID
 * @returns 闪卡文件项HTML字符串
 */
export const generateFlashcardFileItemHTML = (item: IFile, notebookId: string): string => {
    return generateFileItemHTMLBase(item, notebookId, true);
};
