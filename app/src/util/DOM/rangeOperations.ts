/**
 * 处理单个节点，返回索引调整值
 *
 * 处理规则：
 * 1. WBR 标签 - 直接移除
 * 2. 空文本节点 - 移除
 * 3. 相邻文本节点 - 合并到当前节点
 *
 * @param currentNode 当前处理的节点
 * @param nextNode 下一个节点（用于合并判断）
 * @returns 索引调整值（节点被移除时返回 -1，否则返回 0）
 */
const processSingleNodeWhenMerge = (currentNode: ChildNode, nextNode: ChildNode | undefined): number => {
    // 处理 WBR 标签
    if (currentNode.nodeType !== Node.TEXT_NODE && currentNode.nodeName === "WBR") {
        currentNode.remove();
        return -1;
    }
    // 非文本节点不处理
    if (currentNode.nodeType !== Node.TEXT_NODE) {
        return 0;
    }
    // 以下只处理文本节点
    const textNode = currentNode;
    // 移除空文本节点
    if (textNode.textContent?.trim() === "") {
        textNode.remove();
        return -1;
    }
    // 合并相邻文本节点
    if (nextNode?.nodeType !== Node.TEXT_NODE) {
        return 0;
    }

    if (textNode.textContent !== null) {
        textNode.textContent += nextNode.textContent;
    }
    nextNode.remove();
    return -1;
};

/**
 * 合并节点列表中的相邻文本节点，并清理 WBR 标签和空文本节点
 *
 * 由于节点列表是动态的（NodeListOf 是 live 的），
 * 需要多次迭代直到节点数量稳定
 *
 * @param nodes 要处理的节点列表
 */
export const mergeNodes = (nodes: NodeListOf<ChildNode>): void => {
    let previousLength = nodes.length;
    // 第一次处理
    for (let i = 0; i < nodes.length; i++) {
        const currentNode = nodes[i];
        if (!currentNode) {
            continue;
        }
        const nextNode = nodes[i + 1];
        i += processSingleNodeWhenMerge(currentNode, nextNode);
    }
    // 如果节点数量发生变化，继续处理直到稳定
    while (nodes.length !== previousLength) {
        previousLength = nodes.length;
        for (let i = 0; i < nodes.length; i++) {
            const currentNode = nodes[i];
            if (!currentNode) {
                continue;
            }
            const nextNode = nodes[i + 1];
            i += processSingleNodeWhenMerge(currentNode, nextNode);
        }
    }
};

/**
 * 补充 BR 换行处英文之间的空格
 *
 * 在 PDF 等场景中，BR 标签表示换行，但换行处可能缺少必要的空格。
 * 此函数检查 BR 前后的文本，在必要时补充空格。
 *
 * 处理规则：
 * 1. 仅处理前后都有元素的 BR 标签
 * 2. 仅处理前后都是英文字母的情况
 * 3. 连字符换行（前文以 "-" 结尾）：删除连字符，不添加空格
 * 4. 普通英文换行：在 BR 后添加空格
 * 5. 中文场景不添加空格（中文字符会在前置检查中被过滤）
 *
 * @param item 要检查的元素，如果不是 BR 则直接返回
 * @see https://github.com/siyuan-note/siyuan/issues/8152
 */
export const 补充BR换行空格 = (item: Element) => {
    if (item.tagName !== "BR" || !item.previousElementSibling || !item.nextElementSibling) {
        return;
    }

    const previousText = item.previousElementSibling.textContent;
    const nextText = item.nextElementSibling.textContent;
    if (!previousText || !nextText) {
        return;
    }

    // 检查前后是否都是英文字母
    const 前文末尾是英文 = /^[A-Za-z]$/.test(previousText.substring(previousText.length - 2, previousText.length - 1));
    const 后文开头是英文 = /^[A-Za-z]$/.test(nextText.substring(0, 1));
    if (!前文末尾是英文 || !后文开头是英文) {
        return;
    }

    // 连字符换行：删除连字符即可，单词会自然连接
    if (previousText.endsWith("-")) {
        item.previousElementSibling.textContent = previousText.substring(0, previousText.length - 1);
        return;
    }

    // 普通英文换行：补充空格
    item.insertAdjacentText("afterend", " ");
};

/**
 * 从 Range 提取清理后的转义文本
 *
 * 用于获取用户选区的纯文本内容，适用于标注、复制等场景。
 * 返回的文本经过清理和 HTML 转义，可安全用于存储或展示。
 *
 * 处理流程：
 * 1. 克隆 Range 内容（不影响原始 DOM）
 * 2. 处理 BR 换行符（补充必要空格）
 * 3. 提取纯文本内容
 * 4. 移除 NULL 字符（\0）和换行符（\n）
 * 5. HTML 转义（防止 XSS）
 *
 * @param range 要提取文本的选区
 * @returns HTML 转义后的纯文本
 * @see https://github.com/siyuan-note/siyuan/issues/5213
 */
export const 提取Range为转义文本 = (range: Range) => {
    const rangeContents = range.cloneContents();
    for (const item of Array.from(rangeContents.children)) {
        补充BR换行空格(item);
    }
    const textContent = rangeContents.textContent ?? "";
    // 移除 NULL 字符和换行符
    const NULL_CHAR = String.fromCharCode(0);
    const cleanedText = textContent.replaceAll(NULL_CHAR, "").replaceAll("\n", "");
    return Lute.EscapeHTMLStr(cleanedText);
};

// 英文别名导出
export const processBrElement = 补充BR换行空格;
export const processRangeContents = 提取Range为转义文本;
