/**
 * 转义普通 HTML 文本中的基础危险字符，避免文案直接插入标签内容时破坏结构。
 * 调用时机：菜单、搜索结果、历史记录等把文本拼进 HTML 模板时同步调用。
 * 问题/改进：当前只覆盖项目里最常见的字符组合，如未来需要更完整策略可统一升级。
 * @同步豁免: 性能考虑
 */
export const escapeHtml = (html: string) => {
    const hasHtml = !!html;
    if (!hasHtml) {
        return html;
    }
    let escapedHtml = html.replace(/&/g, "&amp;");
    escapedHtml = escapedHtml.replace(/</g, "&lt;");
    return escapedHtml;
};

/** 剥离内核插入的搜索高亮标签，用于回填纯文本引用名。 */
export const stripSearchMark = (html: string) => {
    return html.replace(/<\/?mark>/g, "");
};

/** 仅保留严格的搜索高亮标签，并转义其余标签起始字符。 */
export const escapeSearchHighlight = (html: string) => {
    return html.replace(/<(?!\/?mark>)/g, "&lt;");
};

/**
 * 仅转义 `<`，用于调用方已经自行处理其余字符、只需要防止标签展开的场景。
 * 调用时机：部分搜索与关系面板会在已有转义链路中追加轻量安全处理时调用。
 * 问题/改进：重命名为 escapeLessThans 以更准确描述函数行为。
 * @同步豁免: UI构建 - 纯字符串转义函数，在 UI 渲染管线中同步调用，用于构造安全的标签字符串。异步化会破坏模板字面量拼接的同步契约。
 */
export const escapeLessThans = (html: string) => {
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
 * @同步豁免: UI构建 - 在构造 HTML 属性字符串时同步调用，负责转义引号以防止属性注入。异步化无法在动态属性拼接表达式中使用。
 */
export const escapeAttr = (html: string) => {
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
 * @同步豁免: UI构建 - 在构造菜单项的 aria-label 时同步调用，需要立即返回转义后的字符串用于属性赋值。异步化会延迟屏幕阅读器可访问性更新。
 */
export const escapeAriaLabel = (html: string) => {
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
 * @同步豁免: UI构建 - 在 contenteditable 渲染管线中同步调用，需要立即读取 textarea.value 进行 HTML 解码。异步化会在 DOM 元素被回收后丢失内容。
 */
export const decodeHTML = (html: string) => {
    const textAreaElement = document.createElement("textarea");
    textAreaElement.innerHTML = html;
    return textAreaElement.value;
};
