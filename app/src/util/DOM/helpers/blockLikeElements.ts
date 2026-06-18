/**
 * 读取块级 DOM 元素上的 `data-node-id`，供需要回推块标识的工具使用。
 * 调用时机：AI 选择、批量节点处理等场景需要从元素反查块 ID 时调用。
 * 问题/改进：若未来需要支持更多块类元素来源，可以在这里统一扩展属性回退逻辑。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getElementBlockId = (element: Element) => {
    const blockId = element.getAttribute("data-node-id");
    return blockId;
};

/**
 * 批量提取元素列表中的块 ID，避免调用方重复处理空值过滤逻辑。
 * 调用时机：AI 菜单和批量节点操作需要把选中元素映射成块 ID 数组时调用。
 * 问题/改进：当前保持原始顺序且不过滤重复值，如未来需要去重可在此处扩展。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const getElementsBlockId = (elements: Element[]) => {
    const ids: string[] = [];
    for (const element of elements) {
        const blockId = getElementBlockId(element);
        const hasBlockId = !!blockId;
        if (!hasBlockId) {
            continue;
        }
        ids.push(blockId);
    }
    return ids;
};
