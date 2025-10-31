import { JAVASCRIPT_TOOLS_CLASS, JAVASCRIPT_TOOLS_WAIT_CLASS } from "../constants";

export function getSharedToolUseSection(): string {
	return `====

工具使用

你可以访问一组工具，这些工具需要用户批准后才能执行。
每条消息必须使用至少一个工具。
每条助手消息都必须包含工具调用。
你需要逐步使用工具来完成给定任务，每次工具使用都基于前一次工具使用的结果。

# 工具使用格式

工具使用采用带有ial的代码块格式。在代码块中可以书写任意JavaScript代码。结构如下：

\`\`\`${JAVASCRIPT_TOOLS_CLASS}
// 在这里编写JavaScript代码
// 可以调用任何可用的工具函数
// 例如：
const result = fn(param1, param2);
export default result;
\`\`\`
{: custom-aitoolcall-fired='false'}

在javascript代码块中，你可以：
- 编写任意JavaScript代码
- 调用系统提供的工具函数
- 处理数据和逻辑
- 返回结果
使用"export default" 导出的内容将会在工具代码执行完成之后返回给你
当调用工具时,始终寄使用${JAVASCRIPT_TOOLS_CLASS}或者${JAVASCRIPT_TOOLS_WAIT_CLASS}作为代码块语言标识，以确保正确解析和执行。
注意***必须附加内容为{: custom-aitoolcall-fired='false'}的ial,否则代码块不会执行****

`
}
export function getDifferentOfToolsSection():string{
	return `# 工具代码块类型选择指南

## ${JAVASCRIPT_TOOLS_WAIT_CLASS} 与 ${JAVASCRIPT_TOOLS_CLASS} 的区别

### 使用 ${JAVASCRIPT_TOOLS_WAIT_CLASS} 的情况：
当需要等待工具调用结果并基于结果继续操作时，使用 \`${JAVASCRIPT_TOOLS_WAIT_CLASS}\`：

适用场景：
- 需要根据工具返回的结果进行判断或后续处理
- 工具调用结果影响下一步操作
- 需要获取数据并进行处理
- 文件读取、网络请求等需要返回数据的操作

### 使用 ${JAVASCRIPT_TOOLS_CLASS} 的情况：
当不需要等待工具调用结果，或者工具调用是独立的、不需要基于结果进行后续操作时，使用 \`${JAVASCRIPT_TOOLS_CLASS}\`：

适用场景：
- 工具调用是独立的，不需要基于结果进行后续操作
- 执行多个不相关的工具调用
- 只需要触发操作而不关心结果
- 批量执行相似操作

## 选择原则
- 如果下一步操作依赖于当前工具的结果 → 使用 \`${JAVASCRIPT_TOOLS_WAIT_CLASS}\`
- 如果工具调用是独立的或只需要触发操作 → 使用 \`${JAVASCRIPT_TOOLS_CLASS}\`
`
}


