import { Constants } from "../../constants";
import { getIconByType } from "../../editor/getIcon";
import { unicode2Emoji } from "../../emoji";
import type {ProtyleDomain} from "../../protyle/protyle.types";
import { escapeAriaLabel, escapeLessThans, escapeHtml } from "../../util/DOM/escape";
import { getNotebookName, getDisplayName, getNotebookIcon } from "../../util/file/pathName";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSafeSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import {getArticle} from "../article/getArticle";
import {getAttr} from "../result/getAttr";

/**
 * 生成子项（带 padding）的 HTML
 * @description 用于渲染分组内的子项，带有左侧缩进
 * @param item - 块数据
 * @param countHTML - 引用计数 HTML 片段
 * @returns 子项 HTML 字符串
 */
const 生成子项HTML = (item: IBlock, countHTML: string): string => {
    return `<div style="padding-left: 36px" data-type="search-item" class="b3-list-item" data-node-id="${item.id}" data-root-id="${item.rootID}">
<svg class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type ?? "")}"></use></svg>
${unicode2Emoji(item.ial.icon ?? "", "b3-list-item__graphic", true)}
<span class="b3-list-item__text">${item.content}</span>
${getAttr(item)}
${item.tag ? `<span class="b3-list-item__meta b3-list-item__meta--ellipsis">${item.tag.replace(/#/g, "")}</span>` : ""}
${countHTML}
</div>`;
};

/**
 * 生成顶级项（带 title）的 HTML
 * @description 用于渲染不分组时的顶级搜索结果项
 * @param item - 块数据
 * @param countHTML - 引用计数 HTML 片段
 * @param title - 文档路径标题
 * @returns 顶级项 HTML 字符串
 */
const 生成顶级项HTML = (item: IBlock, countHTML: string, title: string): string => {
    return `<div data-type="search-item" class="b3-list-item" data-node-id="${item.id}" data-root-id="${item.rootID}">
<svg class="b3-list-item__graphic popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type ?? "")}"></use></svg>
${unicode2Emoji(item.ial.icon ?? "", "b3-list-item__graphic", true)}
<span class="b3-list-item__text">${item.content}</span>
${getAttr(item)}
${item.tag ? `<span class="b3-list-item__meta b3-list-item__meta--ellipsis">${item.tag.replace(/#/g, "")}</span>` : ""}
<span class="b3-list-item__meta b3-list-item__meta--ellipsis ariaLabel" aria-label="${escapeAriaLabel(escapeHtml(title))}">${title}</span>
${countHTML}
</div>`;
};

/**
 * 生成引用计数的 HTML
 * @description 渲染带有 tooltip 的引用计数徽章
 * @param refCount - 引用计数，undefined 或 0 时返回空字符串
 * @returns 引用计数 HTML 片段，或空字符串
 */
const 生成计数HTML = (refCount: number | undefined): string => {
    if (!refCount) {
        return "";
    }
    return `<span class="popover__block counter b3-tooltips b3-tooltips__w" aria-label="${siyuanI18n.ref}">${refCount}</span>`;
};

/**
 * 生成分组头部的 HTML
 * @description 用于渲染分组模式下的文档分组头部，包含折叠箭头和笔记本图标
 * @param item - 分组对应的块数据（通常是文档级别）
 * @param title - 文档路径标题
 * @returns 分组头部 HTML 字符串，末尾包含未闭合的 `<div>` 用于包裹子项
 */
const 生成分组头部HTML = (item: IBlock, title: string): string => {
    const 笔记本图标 = getNotebookIcon(item.box ?? "");
    const siyuanStorage = getSafeSiyuanStorage();
    const 本地图片设置 = siyuanStorage?.[Constants.LOCAL_IMAGES];
    const 默认图标 = 本地图片设置?.note ?? "";
    const 图标: string = 笔记本图标 || 默认图标;
    return `<div class="b3-list-item">
<span class="b3-list-item__toggle b3-list-item__toggle--hl">
    <svg class="b3-list-item__arrow b3-list-item__arrow--open"><use xlink:href="#iconRight"></use></svg>
</span>
${unicode2Emoji(图标, "b3-list-item__graphic", true)}
<span class="b3-list-item__text ariaLabel" style="color: var(--b3-theme-on-surface)" aria-label="${escapeAriaLabel(escapeHtml(title))}">${title}</span>
</div><div>`;
};

/**
 * 生成空结果的 HTML
 * @description 当搜索无结果时显示的提示内容
 * @param method - 搜索方法类型，0 表示普通搜索（显示新建文件入口）
 * @param inputValue - 用户输入的搜索关键词
 * @returns 空结果提示 HTML 字符串
 */
const 生成空结果HTML = (method: number, inputValue: string): string => {
    if (method === 0) {
        return `<div class="b3-list-item b3-list-item--focus" data-type="search-new">
    <svg class="b3-list-item__graphic"><use xlink:href="#iconFile"></use></svg>
    <span class="b3-list-item__text">
        ${siyuanI18n.newFile} <mark>${escapeHtml(inputValue)}</mark>
    </span>
    <kbd class="b3-list-item__meta">${siyuanI18n.enterNew}</kbd>
</div>
<div class="search__empty">
    ${siyuanI18n.enterNewTip}
</div>`;
    }
    return `<div class="b3-list-item b3-list-item--focus" data-type="search-new">
    <span class="b3-list-item__text">
        ${siyuanI18n.emptyContent}
    </span>
</div>`;
};

/**
 * 查找匹配的焦点数据项
 * @description 根据 focusId 在搜索结果中查找对应的块数据，优先返回 currentId 匹配项
 * @param data - 搜索结果数据数组
 * @param focusId - 焦点 ID 配置，包含 currentId 和 newId
 * @returns 匹配的块数据，未找到时返回 undefined
 */
const 查找焦点数据 = (
    data: IBlock[],
    focusId?: { currentId?: string; newId?: string }
): IBlock | undefined => {
    if (!focusId) {
        return undefined;
    }

    let currentData: IBlock | undefined;
    let newData: IBlock | undefined;

    for (const item of data) {
        if (item.children) {
            for (const child of item.children) {
                if (child.id === focusId.currentId) {
                    currentData = child;
                }
                if (child.id === focusId.newId) {
                    newData = child;
                }
            }
            continue;
        }
        if (item.id === focusId.currentId) {
            currentData = item;
        }
        if (item.id === focusId.newId) {
            newData = item;
        }
    }

    return currentData || newData;
};

/**
 * 获取默认的当前数据
 * @description 当没有指定焦点时，返回搜索结果中的第一个可选中项
 * @param data - 搜索结果数据数组
 * @returns 默认选中的块数据，数据为空时返回 undefined
 */
const 获取默认数据 = (data: IBlock[]): IBlock | undefined => {
    if (data.length === 0) {
        return undefined;
    }
    const 第一项 = data[0];
    if (!第一项) {
        return undefined;
    }
    if (第一项.children) {
        return 第一项.children[0];
    }
    return 第一项;
};

/**
 * 生成搜索结果 HTML
 * @description 遍历搜索结果数据，生成完整的搜索结果列表 HTML
 * @param data - 搜索结果数据数组
 * @returns 搜索结果列表 HTML 字符串
 */
const 生成结果HTML = (data: IBlock[]): string => {
    let resultHTML = "";
    for (const item of data) {
        const title = escapeHtml(getNotebookName(item.box ?? "")) + getDisplayName(item.hPath ?? "", false);

        if (item.children) {
            resultHTML += 生成分组头部HTML(item, title);
            for (const childItem of item.children) {
                resultHTML += 生成子项HTML(childItem, 生成计数HTML(childItem.refCount));
            }
            resultHTML += "</div>";
            continue;
        }
        resultHTML += 生成顶级项HTML(item, 生成计数HTML(item.refCount), title);
    }
    return resultHTML;
};

/**
 * 滚动到当前列表项
 * @description 为选中项添加焦点样式，并滚动到可视区域
 * @param element - 搜索面板容器元素
 * @param currentData - 当前选中的块数据
 */
const 滚动到当前项 = (element: Element, currentData: IBlock): void => {
    const currentList = element.querySelector(`[data-node-id="${currentData.id}"]`);
    if (!(currentList instanceof HTMLElement)) {
        return;
    }

    currentList.classList.add("b3-list-item--focus");
    if (!currentList.previousElementSibling && currentList.parentElement?.previousElementSibling) {
        currentList.parentElement.previousElementSibling.scrollIntoView();
        return;
    }
    currentList.scrollIntoView();
};

/**
 * 搜索结果处理主函数
 * @description 处理搜索结果数据，更新搜索面板 UI，包括结果列表、预览编辑器和焦点状态
 * @param data - 搜索结果数据数组
 * @param edit - Protyle 编辑器实例，用于预览选中的块
 * @param element - 搜索面板容器元素
 * @param config - 搜索配置
 * @param focusId - 可选的焦点 ID 配置，用于指定需要聚焦的项
 */
export const onSearch = (data: IBlock[], edit: ProtyleDomain, element: Element, config: Config.IUILayoutTabSearchConfig,
    focusId?: {
        currentId?: string;
        newId?: string;
    }) => {
    const resultHTML = 生成结果HTML(data);

    // 确定当前选中的数据
    const currentData = 查找焦点数据(data, focusId) || 获取默认数据(data);

    // 更新编辑器显示状态
    const searchInputElement = element.querySelector("#searchInput");
    if (!(searchInputElement instanceof HTMLInputElement)) {
        return;
    }

    const searchDrag = element.querySelector(".search__drag");
    if (currentData) {
        edit.protyle.element.classList.remove("fn__none");
        searchDrag?.classList.remove("fn__none");
        getArticle({
            edit,
            id: currentData.id ?? "",
            config,
            value: searchInputElement.value,
        });
    }
    if (!currentData) {
        edit.protyle.element.classList.add("fn__none");
        searchDrag?.classList.add("fn__none");
    }

    // 更新列表内容
    const searchList = element.querySelector("#searchList");
    if (searchList) {
        searchList.innerHTML = resultHTML || 生成空结果HTML(config.method ?? 0, searchInputElement.value);
    }

    // 滚动到当前项
    if (currentData) {
        滚动到当前项(element, currentData);
    }
};
