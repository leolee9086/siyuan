/**
 * 导出 getGraphvizSection 供提示词构建器拼接使用。
 * 说明Graphviz图形创建的提示词
 * @同步豁免: 生命周期 - 作为同步字符串流水线的一环，在 getPublicPrompts 的模板字面量中被同步调用。
 */
export function getGraphvizSection() {
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