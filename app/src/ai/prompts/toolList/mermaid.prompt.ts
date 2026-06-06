/**
 * 导出 getMermaidSection 供提示词构建器拼接使用。
 * 说明Mermaid图表创建的提示词
 * @同步豁免: 生命周期 - 作为同步字符串流水线的一环，在 getPublicPrompts 的模板字面量中被同步调用。
 */
export function getMermaidSection() {
	return `## Mermaid 图表创建

使用 mermaid 代码块可以创建各种专业图表。支持多种 Mermaid 语法;

图形将在文档中自动渲染显示，当遇到适合使用mermaid表达的内容时，可以直接使用。
`;
}