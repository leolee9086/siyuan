/**
 * 处理知乎预览中的表格元素，将表头行移至表格体开头
 *
 * 此函数用于适配知乎平台的表格显示格式。知乎平台要求表格的表头行必须位于tbody内部，
 * 而不是单独的thead元素中。该函数会查找所有表格，将thead中的第一行移动到tbody的开头，
 * 然后移除thead元素。
 *
 * @param element - 预览容器元素，需要是导出格式的HTML，包含需要处理的表格
 *
 * @example
 * ```typescript
 * // 假设有一个包含表格的预览容器
 * const previewContainer = document.getElementById('preview');
 * processPreviewElementsZhihuTable(previewContainer);
 * ```
 *
 * @since 1.0.0
 */
export const processPreviewElementsZhihuTable = (element: HTMLElement) => {
    element.querySelectorAll("table").forEach(item => {
        const headElement = item.querySelector("thead");
        if (!headElement) {
            return;
        }
        const tbodyElement = item.querySelector("tbody");
        if (tbodyElement) {
            if (!headElement.firstElementChild) {
                return;
            }
            tbodyElement.insertAdjacentElement("afterbegin", headElement.firstElementChild);
        } else {
            item.innerHTML = `<tbody>${headElement.innerHTML}</tbody>`;
        }
        headElement.remove();
    });
};

/**
 * 递归处理知乎预览中的引用块元素，将连续的段落合并为引用块
 *
 * 此函数用于适配知乎平台的引用块显示格式。它会遍历元素的子节点，将连续的段落文本
 * 合并为一个blockquote元素，同时保留其他元素（如图片、嵌套引用块等）的独立性。
 *
 * @param element - 要处理的父元素，通常是一个包含多种内容类型的容器
 * @param elements - 用于收集处理后的元素数组，处理结果会被添加到这个数组中
 *
 * @example
 * ```typescript
 * // 处理一个包含段落和引用的容器
 * const container = document.getElementById('content');
 * const processedElements: HTMLElement[] = [];
 * processPreviewElementZhihuBlockquote(container, processedElements);
 * // processedElements 现在包含处理后的元素，其中连续段落被合并为引用块
 * ```
 *
 * @since 1.0.0
 */
export const processPreviewElementZhihuBlockquote = (element: HTMLElement, elements: HTMLElement[]) => {
    Array.from(element.children).forEach((item) => {
        if (item instanceof HTMLElement) {
            if (item.tagName === "BLOCKQUOTE") {
                // 递归处理嵌套的引用块
                processPreviewElementZhihuBlockquote(item, elements);
            } else if (item.tagName !== "P" || item.querySelector("img")) {
                // 非段落元素或包含图片的段落直接添加到结果中
                elements.push(item);
            } else {
                // 处理普通段落，尝试与前面的引用块合并
                const lastElement = elements[elements.length - 1];
                if (!lastElement || (lastElement && lastElement.tagName !== "BLOCKQUOTE")) {
                    // 如果没有前一个元素或前一个元素不是引用块，创建新的引用块
                    elements.push(document.createElement("blockquote"));
                }
                // 将当前段落添加到引用块中
                elements[elements.length - 1]?.append(item);
            }
        }
    });
};