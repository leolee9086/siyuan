/**
 * 导出 getHtmlSection 供提示词构建器拼接使用。
 * 说明HTML块渲染的提示词
 * @同步豁免: 性能考虑 - 纯字符串返回函数，异步化会引入不必要的 Promise 开销且调用方在模板字符串中同步拼接。
 * @显式返回类型原因: 固定返回常量字符串，显式标注便于调用方在模板字面量中直接使用。
 */
export function getHtmlSection(): string {
	return `
# 以下渲染内容不要使用代码块包裹    
## HTML 渲染

**直接**使用 html标签可以渲染自定义 HTML 内容：

<div class="custom-container">
    <h2>自定义标题</h2>
    <p>这是一个自定义HTML块，可以包含任何有效的HTML标签和内容。</p>
    <ul>
        <li>支持列表</li>
        <li>支持表格</li>
        <li>支持图片</li>
    </ul>
</div>

## HTML块特点：

**不要**用代码块包裹需要渲染的HTML内容，这些内容将会直接渲染。
HTML块将在文档中直接渲染，显示为交互式的HTML内容。
当需要嵌入在线地图、网站等等时你可以使用html。
`;
}