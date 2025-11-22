/**
 * 说明Mermaid图表创建的提示词
 * @returns 
 */

export function getMermaidSection(): string {
	return `## Mermaid 图表创建

使用 mermaid 代码块可以创建各种专业图表。支持多种 Mermaid 语法;

图形将在文档中自动渲染显示，当遇到适合使用mermaid表达的内容时，可以直接使用。
`;
}