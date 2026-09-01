/**
 * 文件列表HTML渲染模块
 *
 * @description
 * 作用：处理文件树中文件列表的HTML渲染和动画效果
 * 意图：将复杂的DOM操作逻辑从主类中分离，提高代码可维护性
 */

import { hasClosestByClassName } from "../../../protyle/util/hasClosest";
import { genFileHTML } from "./htmlGenerators";
import {expandFileTree} from "../fileTreeAnimation";

/**
 * 保持已展开文件夹的状态
 *
 * @description
 * 作用：在刷新文件列表时，将已展开文件夹的子列表迁移到新模板中
 * 意图：避免刷新时丢失用户已展开的文件夹状态
 * 调用时机：当文件列表需要刷新且存在已展开的子文件夹时
 *
 * @param nextElement - 当前的子文件列表UL元素
 * @param tempElement - 新生成的模板元素
 */
function preserveOpenFolderState(nextElement: Element, tempElement: HTMLTemplateElement): void {
    const openArrows = nextElement.querySelectorAll(":scope > .b3-list-item > .b3-list-item__toggle> .b3-list-item__arrow--open");
    for (const item of openArrows) {
        const openLiElement = hasClosestByClassName(item, "b3-list-item");
        // openLiElement 不存在时跳过
        if (!openLiElement) {
            continue;
        }
        const nodeId = openLiElement.getAttribute("data-node-id");
        const tempOpenLiElement = tempElement.content.querySelector(`.b3-list-item[data-node-id="${nodeId}"]`);
        // tempOpenLiElement 不存在时跳过（可能文件已被删除）
        if (!tempOpenLiElement) {
            continue;
        }
        const nextSibling = openLiElement.nextElementSibling;
        // nextSibling 不存在时跳过
        if (!nextSibling) {
            continue;
        }
        tempOpenLiElement.after(nextSibling);
        const arrowElement = tempOpenLiElement.querySelector(".b3-list-item__arrow");
        // arrowElement 存在时添加展开状态
        if (arrowElement) {
            arrowElement.classList.add("b3-list-item__arrow--open");
        }
    }
}

/**
 * 刷新已展开的文件列表
 *
 * @description
 * 作用：当文件夹已展开时，刷新其子文件列表内容
 * 意图：保持文件列表与后端数据同步，同时保留展开状态
 * 调用时机：当 onLsHTML 检测到文件夹已展开时调用
 *
 * @param nextElement - 当前的子文件列表UL元素
 * @param fileHTML - 新生成的文件列表HTML
 * @param containerElement - 文件树容器元素，用于滚动
 * @param scrollTop - 可选的滚动位置
 *
 * @同步豁免: UI构建 - 此函数执行同步DOM操作以刷新文件列表，需要保证DOM更新的原子性
 */
export function refreshExpandedFileList(
    nextElement: Element,
    fileHTML: string,
    containerElement: HTMLElement,
    scrollTop?: number
): void {
    const tempElement = document.createElement("template");
    tempElement.innerHTML = fileHTML;
    preserveOpenFolderState(nextElement, tempElement);
    nextElement.innerHTML = tempElement.innerHTML;
    // 指定了滚动位置时，平滑滚动到该位置
    if (typeof scrollTop === "number") {
        containerElement.scroll({ top: scrollTop, behavior: "smooth" });
    }
}

/**
 * 展开文件夹并显示子文件列表
 *
 * @description
 * 作用：首次展开文件夹时，插入子文件列表并播放展开动画
 * 意图：提供流畅的展开动画效果，提升用户体验
 * 调用时机：当 onLsHTML 检测到文件夹未展开时调用
 *
 * @param liElement - 文件夹对应的列表项元素
 * @param fileHTML - 新生成的文件列表HTML
 * @param containerElement - 文件树容器元素，用于滚动和查询
 * @param scrollTop - 可选的滚动位置
 *
 * @同步豁免: UI构建 - 此函数执行同步DOM操作以展开文件列表，需要保证DOM更新的原子性和动画的连贯性
 */
export function expandFileList(
    liElement: Element,
    fileHTML: string,
    containerElement: HTMLElement,
    scrollTop?: number
): void {
    const arrowElement = liElement.querySelector(".b3-list-item__arrow");
    // arrowElement 存在时添加展开状态
    if (arrowElement) {
        arrowElement.classList.add("b3-list-item__arrow--open");
    }
    liElement.insertAdjacentHTML("afterend", `<ul>${fileHTML}</ul>`);
    const nextElement = liElement.nextElementSibling;
    // nextElement 不存在时直接返回（理论上不会发生）
    if (!nextElement) {
        return;
    }
    if (!(nextElement instanceof HTMLElement)) {
        return;
    }
    nextElement.setAttribute("style", "top: -1px;position: relative;");
    expandFileTree(nextElement, () => {
        nextElement.removeAttribute("style");
        if (typeof scrollTop === "number") {
            containerElement.scroll({top: scrollTop, behavior: "smooth"});
        }
    });
}

/**
 * 处理文件列表HTML渲染
 *
 * @description
 * 作用：根据后端返回的文件列表数据，渲染或刷新文件树中指定路径下的子文件列表
 * 意图：展开文件夹时显示其子文件，或刷新已展开文件夹的内容
 * 调用时机：当用户展开文件夹或需要刷新文件列表时由 getLeaf 或 selectItem 调用
 *
 * @param containerElement - 文件树容器元素
 * @param data - 文件列表数据，包含 files（文件数组）、box（笔记本ID）、path（路径）
 * @param scrollTop - 可选的滚动位置，渲染完成后滚动到指定位置
 *
 * @同步豁免: UI构建 - 此函数协调DOM操作以渲染文件列表，需要保证DOM更新的原子性
 */
export function onLsHTMLHandler(
    containerElement: HTMLElement,
    data: { files: IFile[], box: string, path: string },
    scrollTop?: number,
    afterRender?: (listElement: Element) => void
): void {
    // 没有文件时直接返回
    if (data.files.length === 0) {
        return;
    }
    const liElement = containerElement.querySelector(`ul[data-url="${data.box}"] li[data-path="${data.path}"]`);
    // 找不到对应的列表项时直接返回（可能已被删除或未加载）
    if (!liElement) {
        return;
    }
    let fileHTML = "";
    for (const item of data.files) {
        fileHTML += genFileHTML(item);
    }
    const nextElement = liElement.nextElementSibling;
    // 如果下一个兄弟元素是 UL，说明文件夹已展开，需要刷新内容
    if (nextElement && nextElement.tagName === "UL") {
        refreshExpandedFileList(nextElement, fileHTML, containerElement, scrollTop);
        afterRender?.(nextElement);
        return;
    }
    expandFileList(liElement, fileHTML, containerElement, scrollTop);
    const expandedListElement = liElement.nextElementSibling;
    if (expandedListElement) {
        afterRender?.(expandedListElement);
    }
}
