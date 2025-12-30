/**
 * inlineMark 模块的类型定义
 */

/**
 * 添加内联标记处理结果
 */
export interface 添加标记结果 {
    newNodes: Node[];
    keepZWPS: boolean;
}

/**
 * 合并相邻的同类型元素
 * 当两个相邻元素具有相同的 data-type 和 text style 时，合并它们
 * 
 * 原始位置: index.ts L678-754
 * 
 * @returns 合并后需要更新的 range 位置信息
 */
export interface 合并结果 {
    startContainer?: Node;
    endContainer?: Node;
    startOffset?: number;
    endOffset?: number;
}

/**
 * 准备标记内容结果
 */
export interface 准备标记内容结果 {
    contents: DocumentFragment;
    html: string | undefined;
    needWrapTarget: HTMLElement | undefined;
    isEndSpan: boolean;
}


/**
 * 移除标记处理结果
 */
export interface 移除标记结果 {
    newNodes: Node[];
    startContainer?: Node | undefined;
    startOffset?: number | undefined;
    keepZWPS: boolean;
}
