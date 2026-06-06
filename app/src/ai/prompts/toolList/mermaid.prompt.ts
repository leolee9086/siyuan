/**
 * 导出 getMermaidSection 供提示词构建器拼接使用。
 * 说明Mermaid图表创建的提示词
 * @同步豁免: 性能考虑 - 纯字符串返回函数，异步化会引入不必要的 Promise 开销且调用方在模板字符串中同步拼接。
 * @显式返回类型原因: 固定返回常量字符串，显式标注便于调用方在模板字面量中直接使用。
 */
export function getMermaidSection(): string {
	return `## Mermaid 图表创建

使用 mermaid 代码块可以创建各种专业图表。支持多种 Mermaid 语法;

图形将在文档中自动渲染显示，当遇到适合使用mermaid表达的内容时，可以直接使用。
`;
}