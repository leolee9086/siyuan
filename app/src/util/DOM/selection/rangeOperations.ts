/**
 * 处理相邻节点时负责移除无效节点、合并连续文本节点，并返回遍历索引需要回退的步数。
 * 调用时机：`mergeNodes` 在清理 live NodeList 时每次循环调用。
 * 问题/改进：当前只覆盖 `WBR` 与文本节点，如后续还有更多轻量归一化规则可在这里扩展。
 * @显式返回类型原因: 返回索引回退步数（-1 或 0），调用方依赖返回值调整遍历游标，显式类型可防止意外返回 undefined 导致死循环。
 */
const processSingleNodeWhenMerge = (currentNode: ChildNode, nextNode: ChildNode | undefined): number => {
    const isWbrElement = currentNode.nodeType !== Node.TEXT_NODE && currentNode.nodeName === "WBR";
    if (isWbrElement) {
        currentNode.remove();
        return -1;
    }
    const isTextNode = currentNode.nodeType === Node.TEXT_NODE;
    if (!isTextNode) {
        return 0;
    }
    const isEmptyTextNode = currentNode.textContent?.trim() === "";
    if (isEmptyTextNode) {
        currentNode.remove();
        return -1;
    }
    const nextIsTextNode = nextNode?.nodeType === Node.TEXT_NODE;
    if (!nextIsTextNode) {
        return 0;
    }
    const currentTextContent = currentNode.textContent;
    const hasCurrentTextContent = currentTextContent !== null;
    if (!hasCurrentTextContent) {
        return 0;
    }
    currentNode.textContent = currentTextContent + nextNode.textContent;
    nextNode.remove();
    return -1;
};

/**
 * 遍历 live NodeList 并持续合并相邻文本节点，同时移除 `WBR` 与空文本节点。
 * 调用时机：内联标记清理、复制处理等需要标准化 DOM 片段时调用。
 * 问题/改进：当前通过重复扫描保证稳定性，节点规模很大时可再考虑更细粒度的游标优化。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const mergeNodes = (nodes: NodeListOf<ChildNode>) => {
    let previousLength = -1;
    while (nodes.length !== previousLength) {
        previousLength = nodes.length;
        for (let i = 0; i < nodes.length; i++) {
            const currentNode = nodes[i];
            const hasCurrentNode = !!currentNode;
            if (!hasCurrentNode) {
                continue;
            }
            const nextNode = nodes[i + 1];
            i += processSingleNodeWhenMerge(currentNode, nextNode);
        }
    }
};

/**
 * 在 `BR` 断行前后补齐英文空格，避免复制或标注文本时丢失英文单词边界。
 * 调用时机：`processRangeContents` 提取 Range 文本前，会先遍历克隆节点并调用本函数。
 * 问题/改进：当前仅处理英文字符场景，其他语种换行规则后续可继续补充。
 */
const normalizeBrSpacing = (item: Element) => {
    const isBrElement = item.tagName === "BR";
    const hasSiblingElements = !!item.previousElementSibling && !!item.nextElementSibling;
    if (!isBrElement || !hasSiblingElements) {
        return;
    }
    const previousText = item.previousElementSibling.textContent;
    const nextText = item.nextElementSibling.textContent;
    const hasTexts = !!previousText && !!nextText;
    if (!hasTexts) {
        return;
    }
    const previousEndsWithLetter = /^[A-Za-z]$/.test(previousText.substring(previousText.length - 2, previousText.length - 1));
    const nextStartsWithLetter = /^[A-Za-z]$/.test(nextText.substring(0, 1));
    const isEnglishBreak = previousEndsWithLetter && nextStartsWithLetter;
    if (!isEnglishBreak) {
        return;
    }
    const previousEndsWithHyphen = previousText.endsWith("-");
    if (previousEndsWithHyphen) {
        item.previousElementSibling.textContent = previousText.substring(0, previousText.length - 1);
        return;
    }
    item.insertAdjacentText("afterend", " ");
};

/**
 * 从 Range 提取清理后的转义文本，统一处理换行空格、NULL 字符和 HTML 转义。
 * 调用时机：PDF 标注等需要把当前选区内容保存为纯文本时调用。
 * 问题/改进：当前仍依赖全局 `Lute`，若未来有更明确的转义服务可通过网关接入。
 * @同步豁免: 需要绝对同步的DOM访问
 * @显式返回类型原因: 返回清理后的转义文本字符串，调用方直接用于保存/写入操作。显式标注确保类型安全，避免隐式 undefined 污染数据。
 */
export const processRangeContents = (range: Range): string => {
    const rangeContents = range.cloneContents();
    for (const item of Array.from(rangeContents.children)) {
        normalizeBrSpacing(item);
    }
    const textContent = rangeContents.textContent ?? "";
    const nullChar = String.fromCharCode(0);
    const cleanedText = textContent.replaceAll(nullChar, "").replaceAll("\n", "");
    return Lute.EscapeHTMLStr(cleanedText);
};
