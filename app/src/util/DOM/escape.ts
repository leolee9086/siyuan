/**
 * 转义普通 HTML 文本中的基础危险字符，避免文案直接插入标签内容时破坏结构。
 * 调用时机：菜单、搜索结果、历史记录等把文本拼进 HTML 模板时同步调用。
 * 问题/改进：当前只覆盖项目里最常见的字符组合，如未来需要更完整策略可统一升级。
 * @同步豁免: 性能考虑
 */
export const escapeHtml = (html: string): string => {
    const hasHtml = !!html;
    if (!hasHtml) {
        return html;
    }
    let escapedHtml = html.replace(/&/g, "&amp;");
    escapedHtml = escapedHtml.replace(/</g, "&lt;");
    return escapedHtml;
};

/**
 * 仅转义 `<`，用于调用方已经自行处理其余字符、只需要防止标签展开的场景。
 * 调用时机：部分搜索与关系面板会在已有转义链路中追加轻量安全处理时调用。
 * 问题/改进：重命名为 escapeLessThans 以更准确描述函数行为。
 * @同步豁免: 性能考虑
 */
export const escapeLessThans = (html: string): string => {
    const hasHtml = !!html;
    if (!hasHtml) {
        return html;
    }
    const escapedHtml = html.replace(/</g, "&lt;");
    return escapedHtml;
};

/**
 * 转义 HTML 属性值中的引号字符，避免动态属性拼接时提前闭合。
 * 调用时机：构造 `aria-label`、`value`、`data-*` 等属性字符串时调用。
 * 问题/改进：当前不处理 `<`，因为多数调用方只把它用于属性上下文。
 * @同步豁免: 性能考虑
 */
export const escapeAttr = (html: string): string => {
    const hasHtml = !!html;
    if (!hasHtml) {
        return html;
    }
    let escapedHtml = html.replace(/"/g, "&quot;");
    escapedHtml = escapedHtml.replace(/'/g, "&apos;");
    return escapedHtml;
};

/**
 * 转义 ARIA 标签文本，避免屏幕阅读器读取到被拼进标签的危险字符组合。
 * 调用时机：菜单项、按钮提示等会把动态文本写入 `aria-label` 时调用。
 * 问题/改进：这里保留了项目已有的 `<` 双重转义策略，避免改变既有读屏输出。
 * @同步豁免: 性能考虑
 */
export const escapeAriaLabel = (html: string): string => {
    const hasHtml = !!html;
    if (!hasHtml) {
        return html;
    }
    let escapedHtml = html.replace(/"/g, "&quot;");
    escapedHtml = escapedHtml.replace(/'/g, "&apos;");
    escapedHtml = escapedHtml.replace(/</g, "&amp;lt;");
    escapedHtml = escapedHtml.replace(/&lt;/g, "&amp;lt;");
    return escapedHtml;
};

/**
 * 将 HTML 实体反解码回纯文本。
 * 调用时机：需要把 contenteditable 中的 innerHTML 还原为文本内容时调用。
 * @同步豁免: 性能考虑
 */
export const decodeHTML = (html: string): string => {
    const textAreaElement = document.createElement("textarea");
    textAreaElement.innerHTML = html;
    return textAreaElement.value;
};
