/**
 * 说明流程图创建的提示词
 * @returns 
 * @同步豁免: 性能考虑 - 纯字符串返回函数，异步化会引入不必要的 Promise 开销且调用方在模板字符串中同步拼接。
 * @显式返回类型原因: 固定返回常量字符串，显式标注便于调用方在模板字面量中直接使用。
 */
export function getFlowchartSection(): string {
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