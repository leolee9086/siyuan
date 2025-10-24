import { blockRender } from "../protyle/render/blockRender";
import { highlightRender } from "../protyle/render/highlightRender";
import { insertHTML } from "../protyle/util/insertHTML";
import { processRender } from "../protyle/util/processCode";
import { setLastNodeRange } from "../protyle/util/selection";
import { getContenteditableElement } from "../protyle/wysiwyg/getBlock";


/**
 * 填充内容到编辑器中
 *
 * 该函数用于将AI生成的内容插入到思源笔记的编辑器中，并完成必要的渲染处理。
 * 主要用于AI功能模块，当AI生成内容后调用此函数将内容填充到当前编辑位置。
 *
 * @param {IProtyle} protyle - 思源笔记的编辑器实例，包含编辑器的所有核心功能和状态
 * @param {string} data - 要插入的内容字符串，通常是AI生成的文本或HTML内容
 * @param {Element[]} elements - DOM元素数组，用于确定插入位置，通常使用最后一个元素作为插入点
 *
 * @returns {void} 无返回值
 *
 * @example
 * ```typescript
 * // 假设有一个编辑器实例和AI生成的内容
 * const editorInstance = getProtyleInstance();
 * const aiGeneratedContent = "这是AI生成的内容";
 * const currentElements = getCurrentSelectedElements();
 *
 * // 将AI内容填充到编辑器
 * fillContent(editorInstance, aiGeneratedContent, currentElements);
 * ```
 */
export const fillContent = (protyle: IProtyle, data: string, elements: Element[]) => {
    // 检查数据是否为空，如果为空则直接返回
    if (!data) {
        return;
    }
    
    // 设置最后一个节点的范围，确保插入位置正确
    setLastNodeRange(getContenteditableElement(elements[elements.length - 1]), protyle.toolbar.range);
    
    // 折叠选区到范围的末尾，确保新内容插入到正确位置
    protyle.toolbar.range.collapse(true);
    
    const blockDom  = protyle.lute.SpinBlockDOM(data)
    // 使用lute引擎将数据转换为块级DOM并插入到编辑器中
    insertHTML(blockDom, protyle, true, true);
    
    // 渲染块级元素，确保新插入的内容正确显示
    blockRender(protyle, protyle.wysiwyg.element);
    
    // 处理代码块等特殊元素的渲染
    processRender(protyle.wysiwyg.element);
    
    // 渲染代码高亮
    highlightRender(protyle.wysiwyg.element);
};
