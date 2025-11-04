export const mergeNodes = (nodes: NodeListOf<ChildNode>): void => {
    // 由于节点列表是动态的，可能需要多次处理
    let previousLength = nodes.length;
    processNodes(nodes);
    // 如果节点数量发生变化，继续处理直到稳定
    while (nodes.length !== previousLength) {
        previousLength = nodes.length;
        processNodes(nodes);
    }
};
const processNodes = (nodes: NodeListOf<ChildNode>): void => {
    for (let i = 0; i < nodes.length; i++) {
        const currentNode = nodes[i];
        if (!currentNode) continue;
        // 处理 WBR 标签
        if (currentNode.nodeType !== Node.TEXT_NODE && currentNode.nodeName === "WBR") {
            currentNode.remove();
            i--; // 调整索引
            continue;
        }
        // 处理文本节点
        if (currentNode.nodeType === Node.TEXT_NODE) {
            const textNode = currentNode;
            // 移除空文本节点
            if (textNode.textContent?.trim() === "") {
                textNode.remove();
                i--;
                continue;
            }
            // 合并相邻文本节点
            const nextNode = nodes[i + 1];
            if (nextNode?.nodeType === Node.TEXT_NODE) {
                textNode.textContent !== null && (textNode.textContent += nextNode.textContent);
                nextNode.remove();
                i--;
            }
        }
    }
};
