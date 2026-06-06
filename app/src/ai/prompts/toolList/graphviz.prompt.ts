/**
 * 导出 getGraphvizSection 供提示词构建器拼接使用。
 * 说明Graphviz图形创建的提示词
 * @同步豁免: 性能考虑 - 纯字符串返回函数，异步化会引入不必要的 Promise 开销且调用方在模板字符串中同步拼接。
 * @显式返回类型原因: 固定返回常量字符串，显式标注便于调用方在模板字面量中直接使用。
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