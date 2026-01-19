import { Outline } from "./Outline";
import { getPreviousBlock } from "../../../protyle/wysiwyg/getBlock";
import { fetchPost } from "../../../util/fetch";
import { Constants } from "../../../constants";
import { isHTMLElement } from "../../../util/DOM/element.guard";
import { getSafeSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";

const 标题标签 = ["H1", "H2", "H3", "H4", "H5", "H6"];

/**
 * 作用：根据给定的编辑器节点元素设置大纲高亮。
 * 意图：在大纲中定位并高亮与编辑器当前焦点对应的标题节点，如果当前节点不是标题则向上查找最近的标题。
 * 调用时机：编辑器光标位置变更或点击块时。
 * @param outline Outline 实例
 * @param nodeElement 编辑器中的块元素。
 * @同步豁免: DOM访问
 */
export function setCurrent(outline: Outline, nodeElement: HTMLElement) {
    if (!nodeElement) {
        return;
    }
    /**
     * 作用：检查当前元素是否为标题类型。
     * 意图：如果是标题节点，则直接使用其 ID 进行高亮，避免进一步的 DOM 遍历。
     * 生效场景：当 `nodeElement` 是一个标题块（NodeHeading）时。
     */
    const currentId = nodeElement.getAttribute("data-node-id");
    /**
     * 作用：检查当前节点是否为带 ID 的标题。
     * 意图：如果是，直接高亮并结束。
     * 生效场景：当前节点是 NodeHeading 且有 ID。
     */
    if (nodeElement.getAttribute("data-type") === "NodeHeading" && currentId) {
        setCurrentById(outline, currentId);
        return;
    }
    /**
     * 作用：如果是无 ID 的标题节点，则停止查找。
     * 意图：避免将无 ID 的标题错误地关联到上一个标题的高亮。
     * 生效场景：当前节点是 Heading 但缺少 data-node-id。
     */
    if (nodeElement.getAttribute("data-type") === "NodeHeading") {
        return;
    }

    let previousElement = getPreviousBlock(nodeElement);
    while (previousElement && previousElement.getAttribute("data-type") !== "NodeHeading") {
        previousElement = getPreviousBlock(previousElement);
    }

    const prevId = previousElement ? previousElement.getAttribute("data-node-id") : null;
    /**
     * 作用：检查查找到的上一级标题是否有 ID。
     * 意图：如果有 ID，高亮并结束。
     * 生效场景：查找到上一级 NodeHeading 且有 ID。
     */
    if (previousElement && prevId) {
        setCurrentById(outline, prevId);
        return;
    }
    /**
     * 作用：如果找到的上一级标题没有 ID，则停止。
     * 意图：同上，防止高亮错误的目标。
     * 生效场景：找到上一级 Heading 但缺少 data-node-id。
     */
    if (previousElement) {
        return;
    }

    // @内联回调
    fetchPost("/api/block/getBlockBreadcrumb", { id: nodeElement.getAttribute("data-node-id"), excludeTypes: [] }, (response) => {
        response.data.reverse().find((item: IBreadcrumb) => {
            /**
             * 作用：检查面包屑项是否为标题。
             * 意图：在面包屑路径中找到最近的标题节点并高亮。
             * 生效场景：通过 API 获取的面包屑数据中包含标题类型时。
             */
            if (item.type === "NodeHeading") {
                setCurrentById(outline, item.id);
                return true;
            }
        });
    });
}

/**
 * 作用：在预览模式下根据元素设置大纲高亮。
 * 意图：在预览模式滚动或交互时，同步大纲的高亮状态。
 * 调用时机：预览视图滚动或交互时。
 * @param outline Outline 实例
 * @param nodeElement 预览视图中的元素。
 * @同步豁免: DOM访问
 */
export function setCurrentByPreview(outline: Outline, nodeElement: Element) {
    if (!nodeElement) {
        return;
    }
    let previousElement: Element | null = nodeElement;
    // 使用 && 合并条件，避免循环内 if
    while (previousElement && !previousElement.classList.contains("b3-typography") && !标题标签.includes(previousElement.tagName)) {
        previousElement = previousElement.previousElementSibling || previousElement.parentElement;
    }
    /**
     * 作用：检查找到的标题元素是否具有 ID。
     * 意图：如果有 ID，则高亮对应的大纲节点。
     * 生效场景：找到最近的标题元素后。
     */
    if (previousElement?.id) {
        setCurrentById(outline, previousElement.id);
    }
}

/**
 * 作用：根据 ID 高亮大纲节点并滚动到可视区域。
 * 意图：实现具体的高亮逻辑，包括移除旧高亮、查找新节点、处理自动展开父级以及计算滚动位置。
 * 调用时机：内部调用，或明确知道目标 ID 时调用。
 * @param outline Outline 实例
 * @param id 目标大纲节点的 ID。
 * @同步豁免: DOM访问
 */
export function setCurrentById(outline: Outline, id: string) {
    const focusElements = outline.element.querySelectorAll(".b3-list-item.b3-list-item--focus");
    for (const item of focusElements) {
        item.classList.remove("b3-list-item--focus");
    }
    let currentElement = outline.element.querySelector(`.b3-list-item[data-node-id="${id}"]`);
    if (!isHTMLElement(currentElement)) {
        return;
    }

    const outlineStorage = getSafeSiyuanStorage()?.[Constants.LOCAL_OUTLINE];

    /**
     * 作用：保持当前大纲的展开状态。
     * 意图：当配置了 keepCurrentExpand 时，自动展开当前高亮节点的所有父级，并显示出来。
     * 生效场景：`window.siyuan.storage` 中配置了 `keepCurrentExpand` 为 true。
     */
    if (outlineStorage?.keepCurrentExpand) {
        let ulElement = currentElement.parentElement;
        while (ulElement && !ulElement.classList.contains("b3-list") && ulElement.tagName === "UL") {
            ulElement.classList.remove("fn__none");
            const previousSibling = ulElement.previousElementSibling;
            const arrowElement = previousSibling?.querySelector(".b3-list-item__arrow");
            if (arrowElement) {
                arrowElement.classList.add("b3-list-item__arrow--open");
            }
            ulElement = ulElement.parentElement;
        }
        outline.saveExpendIds();
    }

    /**
     * 作用：当不保持展开状态时，确保找到可见的节点。
     * 意图：如果当前高亮节点不可见（折叠状态），则向上查找直到找到一个可见的父级节点，以便高亮该可见节点。
     * 生效场景：`keepCurrentExpand` 未开启且当前节点高度为 0（隐藏）时。
     */
    if (!outlineStorage?.keepCurrentExpand) {
        while (currentElement && currentElement.clientHeight === 0 && currentElement.parentElement) {
            const prev: Element | null = currentElement.parentElement.previousElementSibling;
            if (!isHTMLElement(prev)) {
                break;
            }
            currentElement = prev;
        }
    }

    if (currentElement) {
        currentElement.classList.add("b3-list-item--focus");
        const elementRect = outline.element.getBoundingClientRect();
        const currentRect = currentElement.getBoundingClientRect();
        const offset = currentRect.top - (elementRect.top + elementRect.height / 2);
        outline.element.scrollTop += offset;
    }
}
