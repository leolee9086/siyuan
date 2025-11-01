/**
 * 说明Graphviz图形创建的提示词
 * @returns 
 */

export function getGraphvizSection(): string {
	return `## Graphviz 图形创建

使用 graph 代码块可以创建图形图表。支持标准 DOT 语言语法：

\`\`\`graph
digraph G {
    A -> B -> C
    A -> D
    D -> C
    D -> E
    E -> F
    F -> G
}
\`\`\`
`;
}