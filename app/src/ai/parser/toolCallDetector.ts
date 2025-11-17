
/**
 * 另一个检测函数,
 * 不止检测第一个块,
 * 提取特定语言代码块中
 * 第一个符合指定条件的代码块
 * @param domElement 包含可能工具调用的DOM元素
 * @param language 要检测的语言名
 * @param conditionCallback 条件判断函数，接收代码块元素和内容，返回是否满足条件
 * @returns 检测到的工具调用代码，如果没有检测到则返回null
 */
export function 从块DOM提取首个符合条件的特定语言代码块内容(
    domElement: Element,
    language: string,
    conditionCallback?: (codeElement: Element, codeContent: string) => boolean
): string | null {
    // 获取所有语言标识元素
    const languageSpans = domElement.querySelectorAll('.protyle-action__language');

    // 遍历所有语言标识元素
    for (let i = 0; i < languageSpans.length; i++) {
        const span = languageSpans[i];

        // 确保span存在
        if (!span) continue;

        // 检查语言是否匹配
        if (span.textContent === language) {
            // 检查是否是完整的工具调用
            const blockElement = span.parentElement?.parentElement
            const codeContent = span.parentElement?.nextElementSibling?.textContent;
            if (codeContent) {
                // 如果没有提供条件回调函数，默认返回第一个匹配的代码块
                if (!conditionCallback) {
                    return codeContent;
                }
                // 获取代码块元素进行条件判断
                const codeElement = span.parentElement?.nextElementSibling;
                if (codeElement &&blockElement&& conditionCallback(blockElement, codeContent)) {
                    return codeContent;
                }
            }
        }
    }

    return null;
}