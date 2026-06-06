/**
 * 说明流程图创建的提示词
 * @同步豁免: 生命周期 - 作为同步字符串流水线的一环，在 getPublicPrompts 的模板字面量中被同步调用。
 */
export function getFlowchartSection() {
	return `## 流程图创建

使用 flowchart 代码块可以创建流程图。支持 Mermaid 流程图语法：

\`\`\`flowchart
TD
    A[开始] --> B{判断条件}
    B -->|是| C[执行操作1]
    B -->|否| D[执行操作2]
    C --> E[结束]
    D --> E
\`\`\`

流程图将在文档中自动渲染显示。
`;
}