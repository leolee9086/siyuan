/**
 * 按原节点顺序序列化 Range 克隆内容中的文本与元素。
 * @同步豁免: UI构建 - 必须在调用异步内核转换前同步快照当前选区 DOM，避免后续编辑改变请求内容。
 */
export const serializeInlineRangeHTML = (range: Range) => {
    let html = "";
    for (const item of Array.from(range.cloneContents().childNodes)) {
        // 文本节点直接保留其文本值，与原实现的 DOM 拼接语义一致。
        if (item.nodeType === 3) {
            html += item.textContent;
            continue;
        }
        // 元素节点保留完整 outerHTML，其他节点类型沿用原逻辑跳过。
        if (item instanceof HTMLElement) {
            html += item.outerHTML;
        }
    }
    return html;
};
